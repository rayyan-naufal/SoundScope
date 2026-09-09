const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { exec, spawn } = require('child_process');

const {
  BASE_DIR,
  loadSettings,
  saveSettings
} = require('./config');

const {
  initDb,
  upsertScannedTrack,
  getTrack,
  updateTrackAiTags,
  markTrackSaved,
  queryTracks,
  getTaxonomies,
  getStats,
  clearAllTracks,
  backfillMissingParentGenres,
  toggleTrackLike,
  createPlaylist,
  getPlaylists,
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
  addTracksToPlaylist,
  removeTrackFromPlaylist,
  exportPlaylistM3u
} = require('./database');

const {
  scanDirectory,
  extractCoverBytes,
  invalidateCoverCache,
  clearCoverCache
} = require('./tag_reader');

const { writeTagsToFile } = require('./tag_writer');
const { analyzeTrackMetadata, analyzeTrackAudio, RateLimitError } = require('./ai_analyzer');
const { resolveGenreHierarchy } = require('./taxonomy');
const { streamAudioFile } = require('./audio_streamer');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- API Endpoints ---

// Settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = loadSettings();
    const masked = { ...settings };
    const key = masked.gemini_api_key || "";
    masked.gemini_api_key_masked = key.length > 10 ? `${key.substring(0, 6)}...${key.slice(-4)}` : (key ? "Configured" : "");
    masked.has_api_key = Boolean(key);
    res.json(masked);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const filtered = {};
    for (const [k, v] of Object.entries(req.body)) {
      if (v !== undefined && v !== null) {
        filtered[k] = v;
      }
    }
    const saved = saveSettings(filtered);
    if (filtered.gemini_api_key) {
      process.env.GEMINI_API_KEY = filtered.gemini_api_key;
    }
    res.json({ status: "ok", settings: saved });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Stats & Taxonomies
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/taxonomies', async (req, res) => {
  try {
    const taxonomies = await getTaxonomies();
    res.json(taxonomies);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Clear library
app.post('/api/clear', async (req, res) => {
  try {
    clearCoverCache();
    await clearAllTracks();
    res.json({
      status: "success",
      message: "Library cleared",
      stats: await getStats(),
      taxonomies: await getTaxonomies()
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Native folder browser dialog (PowerShell on Windows, fallback elsewhere)
app.post('/api/browse-folder', (req, res) => {
  try {
    const settings = loadSettings();
    let initialDir = settings.default_music_dir || "";
    if (!initialDir || !fs.existsSync(initialDir)) {
      initialDir = path.join(process.env.USERPROFILE || process.env.HOME || "", "Music");
    }

    const b64Initial = Buffer.from(initialDir, 'utf8').toString('base64');
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = "Select Music Folder (SoundScope)"
try {
  $initPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${b64Initial}"))
  if (Test-Path $initPath) { $dlg.SelectedPath = $initPath }
} catch {}
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $dlg.SelectedPath
}
`.trim();

    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded]);

    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ps.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ps.on('error', (err) => {
      console.error("Browse folder spawn error:", err.message);
      return res.json({ status: "error", error: err.message, directory: null });
    });

    ps.on('close', (code) => {
      const selected = (stdout || "").trim();
      if (selected && fs.existsSync(selected)) {
        return res.json({ status: "ok", directory: path.normalize(selected) });
      }
      return res.json({ status: "cancelled", directory: null });
    });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message, directory: null });
  }
});

// Scan folder
app.post('/api/scan', async (req, res) => {
  try {
    const folderPath = (req.body.directory || "").trim();
    if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return res.status(400).json({ detail: `Directory does not exist: ${folderPath}` });
    }

    if (req.body.clear_previous) {
      clearCoverCache();
      await clearAllTracks();
    }

    const tracks = await scanDirectory(folderPath);
    let count = 0;
    for (const t of tracks) {
      await upsertScannedTrack(t);
      count++;
    }

    await backfillMissingParentGenres();
    saveSettings({ default_music_dir: folderPath });

    res.json({
      status: "success",
      scanned_count: count,
      stats: await getStats(),
      taxonomies: await getTaxonomies()
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Tracks query
app.get('/api/tracks', async (req, res) => {
  try {
    const {
      search,
      decade,
      parent_genre,
      genre,
      sub_genre,
      tempo,
      is_liked,
      status,
      sort_by = "id",
      sort_order = "ASC"
    } = req.query;

    const tracks = await queryTracks({
      search,
      decade,
      parent_genre,
      genre,
      sub_genre,
      tempo,
      is_liked,
      status,
      sort_by,
      sort_order
    });

    res.json(tracks);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Single Track Get
app.get('/api/track/:track_id', async (req, res) => {
  try {
    const trackId = parseInt(req.params.track_id, 10);
    const track = await getTrack(trackId);
    if (!track) {
      return res.status(404).json({ detail: "Track not found" });
    }
    res.json(track);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Single Track Update
app.put('/api/track/:track_id', async (req, res) => {
  try {
    const trackId = parseInt(req.params.track_id, 10);
    const track = await getTrack(trackId);
    if (!track) {
      return res.status(404).json({ detail: "Track not found" });
    }

    const updateData = {};
    for (const [k, v] of Object.entries(req.body)) {
      if (v !== undefined && v !== null) {
        updateData[k] = v;
      }
    }

    if (updateData.release_year) {
      const yr = parseInt(updateData.release_year, 10);
      if (!isNaN(yr)) {
        updateData.decade = `${Math.floor(yr / 10) * 10}s`;
      }
    }

    await updateTrackAiTags(trackId, updateData, "analyzed");
    const updated = await getTrack(trackId);
    res.json({ status: "ok", track: updated });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Toggle Like
app.post('/api/track/:track_id/like', async (req, res) => {
  try {
    const trackId = parseInt(req.params.track_id, 10);
    const track = await getTrack(trackId);
    if (!track) {
      return res.status(404).json({ detail: "Track not found" });
    }

    const desired = req.body && req.body.is_liked !== undefined ? req.body.is_liked : null;
    const newVal = await toggleTrackLike(trackId, desired);
    res.json({ status: "ok", track_id: trackId, is_liked: newVal });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Batch Like
app.post('/api/tracks/batch-like', async (req, res) => {
  try {
    const trackIds = req.body.track_ids || [];
    const isLiked = req.body.is_liked !== undefined ? req.body.is_liked : 1;
    let count = 0;
    for (const tid of trackIds) {
      await toggleTrackLike(tid, isLiked);
      count++;
    }
    res.json({ status: "ok", count, is_liked: isLiked });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Backfill parent genres
app.post('/api/backfill-parents', async (req, res) => {
  try {
    const count = await backfillMissingParentGenres();
    res.json({
      status: "success",
      backfilled_count: count,
      stats: await getStats(),
      taxonomies: await getTaxonomies()
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Single Track Metadata AI Analysis
app.post('/api/analyze/:track_id', async (req, res) => {
  try {
    const trackId = parseInt(req.params.track_id, 10);
    const track = await getTrack(trackId);
    if (!track) {
      return res.status(404).json({ detail: "Track not found" });
    }

    try {
      const aiRes = await analyzeTrackMetadata(track);
      await updateTrackAiTags(trackId, aiRes, "analyzed");
      const updated = await getTrack(trackId);
      res.json({ status: "success", ai_data: aiRes, track: updated });
    } catch (aiErr) {
      if (aiErr instanceof RateLimitError) {
        res.setHeader("Retry-After", String(aiErr.retryAfter || 15));
        return res.status(429).json({
          detail: aiErr.message,
          is_daily_limit: Boolean(aiErr.isDailyLimit),
          retry_after: aiErr.retryAfter || 15
        });
      }
      return res.status(500).json({ detail: aiErr.message });
    }
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Single Track Audio AI Analysis
app.post('/api/analyze-audio/:track_id', async (req, res) => {
  try {
    const trackId = parseInt(req.params.track_id, 10);
    const track = await getTrack(trackId);
    if (!track) {
      return res.status(404).json({ detail: "Track not found" });
    }

    try {
      const aiRes = await analyzeTrackAudio(track);
      await updateTrackAiTags(trackId, aiRes, "analyzed");
      const updated = await getTrack(trackId);
      res.json({ status: "success", ai_data: aiRes, track: updated });
    } catch (aiErr) {
      if (aiErr instanceof RateLimitError) {
        res.setHeader("Retry-After", String(aiErr.retryAfter || 15));
        return res.status(429).json({
          detail: aiErr.message,
          is_daily_limit: Boolean(aiErr.isDailyLimit),
          retry_after: aiErr.retryAfter || 15
        });
      }
      return res.status(500).json({ detail: aiErr.message });
    }
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Batch AI Analysis
app.post('/api/batch-analyze', async (req, res) => {
  try {
    const trackIds = req.body.track_ids || [];
    const results = [];
    const errors = [];

    for (const tid of trackIds) {
      const t = await getTrack(tid);
      if (!t) continue;
      try {
        const aiRes = await analyzeTrackMetadata(t);
        await updateTrackAiTags(tid, aiRes, "analyzed");
        results.push({ id: tid, title: t.title, success: true });
      } catch (err) {
        errors.push({ id: tid, title: t.title, error: err.message });
      }
    }

    res.json({
      status: "completed",
      processed: results.length,
      failed: errors.length,
      results,
      errors,
      taxonomies: await getTaxonomies()
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Apply tags to file
app.post('/api/apply-tags/:track_id', async (req, res) => {
  try {
    const trackId = parseInt(req.params.track_id, 10);
    const t = await getTrack(trackId);
    if (!t) {
      return res.status(404).json({ detail: "Track not found" });
    }

    try {
      writeTagsToFile(t.file_path, t);
      await markTrackSaved(trackId);
      invalidateCoverCache(t.file_path);
      const updated = await getTrack(trackId);
      res.json({ status: "success", message: `Tags saved to ${t.file_name}`, track: updated });
    } catch (wErr) {
      res.status(500).json({ detail: `Failed writing tags: ${wErr.message}` });
    }
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Batch apply tags to files
app.post('/api/batch-apply-tags', async (req, res) => {
  try {
    const trackIds = req.body.track_ids || [];
    let successCount = 0;
    const errors = [];

    for (const tid of trackIds) {
      let t = await getTrack(tid);
      if (!t) continue;
      try {
        const [p, g, s] = resolveGenreHierarchy(t.parent_genre, t.genre, t.sub_genre);
        if (p && p !== t.parent_genre) {
          await updateTrackAiTags(tid, { parent_genre: p, genre: g, sub_genre: s }, t.status || "saved");
          t = await getTrack(tid);
        }
        writeTagsToFile(t.file_path, t);
        await markTrackSaved(tid);
        invalidateCoverCache(t.file_path);
        successCount++;
      } catch (err) {
        errors.push({ id: tid, title: t.title, error: err.message });
      }
    }

    res.json({
      status: "completed",
      saved_count: successCount,
      failed_count: errors.length,
      errors,
      taxonomies: await getTaxonomies()
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Cover Art Image
app.get('/api/cover/:track_id', async (req, res) => {
  try {
    const trackId = parseInt(req.params.track_id, 10);
    const track = await getTrack(trackId);
    if (!track) {
      return res.status(404).json({ detail: "Track not found" });
    }

    const cover = await extractCoverBytes(track.file_path);
    if (!cover || !cover.data) {
      return res.status(404).json({ detail: "No cover art found" });
    }

    // Content-based ETag using MD5 hash of cover bytes
    const etag = `"${crypto.createHash('md5').update(cover.data).digest('hex').substring(0, 16)}"`;
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.set({
      "Content-Type": cover.mime,
      "Cache-Control": req.query.v ? "public, max-age=86400, immutable" : "public, max-age=3600, must-revalidate",
      "ETag": etag
    });
    return res.send(cover.data);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Audio Stream (with HTTP 206 Partial Content range support)
app.get('/api/stream/:track_id', async (req, res) => {
  try {
    const trackId = parseInt(req.params.track_id, 10);
    const track = await getTrack(trackId);
    if (!track) {
      return res.status(404).json({ detail: "Track not found" });
    }
    return streamAudioFile(req, res, track.file_path);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// --- Playlist Endpoints ---

app.get('/api/playlists', async (req, res) => {
  try {
    const playlists = await getPlaylists();
    res.json(playlists);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/playlists', async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ detail: "Playlist name cannot be empty" });
    }
    const pid = await createPlaylist(name, req.body.description || "");
    const playlist = await getPlaylist(pid);
    res.json({ status: "ok", id: pid, playlist });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/playlists/:playlist_id', async (req, res) => {
  try {
    const playlistId = parseInt(req.params.playlist_id, 10);
    const playlist = await getPlaylist(playlistId);
    if (!playlist) {
      return res.status(404).json({ detail: "Playlist not found" });
    }
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.put('/api/playlists/:playlist_id', async (req, res) => {
  try {
    const playlistId = parseInt(req.params.playlist_id, 10);
    const playlist = await getPlaylist(playlistId);
    if (!playlist) {
      return res.status(404).json({ detail: "Playlist not found" });
    }
    const newName = req.body.name !== undefined ? req.body.name : playlist.name;
    const newDesc = req.body.description !== undefined ? req.body.description : playlist.description;
    await updatePlaylist(playlistId, newName, newDesc);
    const updated = await getPlaylist(playlistId);
    res.json({ status: "ok", playlist: updated });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/playlists/:playlist_id', async (req, res) => {
  try {
    const playlistId = parseInt(req.params.playlist_id, 10);
    const playlist = await getPlaylist(playlistId);
    if (!playlist) {
      return res.status(404).json({ detail: "Playlist not found" });
    }
    await deletePlaylist(playlistId);
    res.json({ status: "ok", message: "Playlist deleted" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/playlists/:playlist_id/tracks', async (req, res) => {
  try {
    const playlistId = parseInt(req.params.playlist_id, 10);
    const playlist = await getPlaylist(playlistId);
    if (!playlist) {
      return res.status(404).json({ detail: "Playlist not found" });
    }
    const trackIds = req.body.track_ids || [];
    const added = await addTracksToPlaylist(playlistId, trackIds);
    const updated = await getPlaylist(playlistId);
    res.json({ status: "ok", added_count: added, playlist: updated });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/playlists/:playlist_id/tracks/:track_id', async (req, res) => {
  try {
    const playlistId = parseInt(req.params.playlist_id, 10);
    const trackId = parseInt(req.params.track_id, 10);
    const playlist = await getPlaylist(playlistId);
    if (!playlist) {
      return res.status(404).json({ detail: "Playlist not found" });
    }
    await removeTrackFromPlaylist(playlistId, trackId);
    const updated = await getPlaylist(playlistId);
    res.json({ status: "ok", playlist: updated });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/playlists/:playlist_id/export-m3u', async (req, res) => {
  try {
    const playlistId = parseInt(req.params.playlist_id, 10);
    const playlist = await getPlaylist(playlistId);
    if (!playlist) {
      return res.status(404).json({ detail: "Playlist not found" });
    }
    const content = await exportPlaylistM3u(playlistId);
    const filename = `${playlist.name.replace(/\s+/g, '_')}.m3u`;
    res.set({
      "Content-Type": "audio/x-mpegurl",
      "Content-Disposition": `attachment; filename="${filename}"`
    });
    res.send(content);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Serve frontend static assets
const staticDir = path.join(BASE_DIR, 'static');
app.use(express.static(staticDir));

// Fallback to index.html for root or SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// Server launcher helper function
function startServer(port = null) {
  return new Promise(async (resolve, reject) => {
    try {
      await initDb();
      const settings = loadSettings();
      const listenPort = port || settings.port || 8765;
      const server = app.listen(listenPort, '127.0.0.1', () => {
        console.log(`[SoundScope Node] Server listening at http://127.0.0.1:${listenPort}`);
        resolve({ server, port: listenPort });
      });
      server.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

module.exports = { app, startServer };
