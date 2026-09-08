const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { DATA_DIR } = require('./config');
const { inferParentFromGenre, formatTrackTags, resolveGenreHierarchy } = require('./taxonomy');

const DB_PATH = path.join(DATA_DIR, 'music_catalog.db');

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(DB_PATH);
    dbInstance.configure('busyTimeout', 10000);
  }
  return dbInstance;
}

// Promise-based query helpers
function run(sql, params = []) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function exec(sql) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function initDb() {
  await exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT UNIQUE NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      duration REAL DEFAULT 0,
      title TEXT,
      artist TEXT,
      album TEXT,
      release_year INTEGER,
      decade TEXT,
      parent_genre TEXT,
      genre TEXT,
      sub_genre TEXT,
      tags TEXT DEFAULT '[]',
      tempo TEXT,
      status TEXT DEFAULT 'unprocessed',
      has_cover INTEGER DEFAULT 0,
      ai_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_file_path ON tracks(file_path);
    CREATE INDEX IF NOT EXISTS idx_decade ON tracks(decade);
    CREATE INDEX IF NOT EXISTS idx_parent_genre ON tracks(parent_genre);
    CREATE INDEX IF NOT EXISTS idx_status ON tracks(status);
  `);

  try {
    await exec("ALTER TABLE tracks ADD COLUMN tempo TEXT;");
  } catch (_) {}

  try {
    await exec("ALTER TABLE tracks ADD COLUMN is_liked INTEGER DEFAULT 0;");
  } catch (_) {}

  await exec("CREATE INDEX IF NOT EXISTS idx_is_liked ON tracks(is_liked);");

  await exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      cover_url TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      track_id INTEGER NOT NULL,
      position INTEGER DEFAULT 0,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
      UNIQUE(playlist_id, track_id)
    );
    CREATE INDEX IF NOT EXISTS idx_playlist_tracks ON playlist_tracks(playlist_id, position);
  `);
}

async function backfillMissingParentGenres() {
  const rows = await all("SELECT id, release_year, decade, parent_genre, genre, sub_genre, tags FROM tracks WHERE parent_genre IS NULL OR parent_genre = ''");
  let updatedCount = 0;
  const now = new Date().toISOString();

  for (const r of rows) {
    let p = null;
    if (r.genre) {
      p = inferParentFromGenre(r.genre);
    }
    if (!p && r.sub_genre) {
      p = inferParentFromGenre(r.sub_genre);
    }

    if (p) {
      let currentTags = [];
      try {
        currentTags = JSON.parse(r.tags || "[]");
      } catch (_) {}
      const tagsList = formatTrackTags(p, r.genre, r.sub_genre, r.decade, currentTags);
      await run("UPDATE tracks SET parent_genre = ?, tags = ?, updated_at = ? WHERE id = ?", [
        p,
        JSON.stringify(tagsList),
        now,
        r.id
      ]);
      updatedCount++;
    }
  }
  return updatedCount;
}

async function upsertScannedTrack(trackDict) {
  const row = await get("SELECT id, status, release_year, decade, parent_genre, genre, sub_genre, tags, tempo FROM tracks WHERE file_path = ?", [trackDict.file_path]);
  const now = new Date().toISOString();

  if (row) {
    const trackId = row.id;
    const year = row.release_year || trackDict.release_year;
    const decade = row.decade || trackDict.decade;
    const parentGenre = row.parent_genre || trackDict.parent_genre;
    const genre = row.genre || trackDict.genre;
    const subGenre = row.sub_genre || trackDict.sub_genre;

    let currentTags = [];
    try {
      currentTags = row.tags && row.tags !== '[]' ? JSON.parse(row.tags) : (trackDict.tags || []);
    } catch (_) {
      currentTags = trackDict.tags || [];
    }
    const tags = JSON.stringify(formatTrackTags(parentGenre, genre, subGenre, decade, currentTags));
    const tempo = row.tempo || trackDict.tempo;

    await run(`
      UPDATE tracks SET
        file_name = ?,
        file_size = ?,
        duration = ?,
        title = COALESCE(?, title),
        artist = COALESCE(?, artist),
        album = COALESCE(?, album),
        has_cover = ?,
        release_year = ?,
        decade = ?,
        parent_genre = ?,
        genre = ?,
        sub_genre = ?,
        tags = ?,
        tempo = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      trackDict.file_name,
      trackDict.file_size || 0,
      trackDict.duration || 0,
      trackDict.title || null,
      trackDict.artist || null,
      trackDict.album || null,
      trackDict.has_cover || 0,
      year,
      decade,
      parentGenre,
      genre,
      subGenre,
      tags,
      tempo,
      now,
      trackId
    ]);
    return trackId;
  } else {
    const parentGenre = trackDict.parent_genre || null;
    const genre = trackDict.genre || null;
    const subGenre = trackDict.sub_genre || null;
    const decade = trackDict.decade || null;
    const tagsList = formatTrackTags(parentGenre, genre, subGenre, decade, trackDict.tags || []);

    const res = await run(`
      INSERT INTO tracks (
        file_path, file_name, file_size, duration,
        title, artist, album, release_year, decade,
        parent_genre, genre, sub_genre, tags, tempo,
        status, has_cover, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trackDict.file_path,
      trackDict.file_name,
      trackDict.file_size || 0,
      trackDict.duration || 0,
      trackDict.title || null,
      trackDict.artist || null,
      trackDict.album || null,
      trackDict.release_year || null,
      decade,
      parentGenre,
      genre,
      subGenre,
      JSON.stringify(tagsList),
      trackDict.tempo || null,
      trackDict.status || "unprocessed",
      trackDict.has_cover || 0,
      now
    ]);
    return res.lastID;
  }
}

async function getTrack(trackId) {
  const row = await get("SELECT * FROM tracks WHERE id = ?", [trackId]);
  if (!row) return null;
  try {
    row.tags = JSON.parse(row.tags || "[]");
  } catch (_) {
    row.tags = [];
  }
  return row;
}

async function updateTrackAiTags(trackId, tagsData, status = "analyzed") {
  const now = new Date().toISOString();
  const tagsJson = JSON.stringify(tagsData.tags || []);

  await run(`
    UPDATE tracks SET
      title = COALESCE(?, title),
      artist = COALESCE(?, artist),
      release_year = ?,
      decade = ?,
      parent_genre = ?,
      genre = ?,
      sub_genre = ?,
      tags = ?,
      tempo = COALESCE(?, tempo),
      status = ?,
      ai_notes = ?,
      updated_at = ?
    WHERE id = ?
  `, [
    tagsData.title || null,
    tagsData.artist || null,
    tagsData.release_year !== undefined ? tagsData.release_year : null,
    tagsData.decade || null,
    tagsData.parent_genre || null,
    tagsData.genre || null,
    tagsData.sub_genre || null,
    tagsJson,
    tagsData.tempo || null,
    status,
    tagsData.ai_notes || "",
    now,
    trackId
  ]);
}

async function markTrackSaved(trackId) {
  const now = new Date().toISOString();
  await run("UPDATE tracks SET status = 'saved', updated_at = ? WHERE id = ?", [now, trackId]);
}

async function toggleTrackLike(trackId, isLiked = null) {
  let newVal = 0;
  if (isLiked === null || isLiked === undefined) {
    const row = await get("SELECT is_liked FROM tracks WHERE id = ?", [trackId]);
    const current = row && row.is_liked ? 1 : 0;
    newVal = current === 1 ? 0 : 1;
  } else {
    newVal = isLiked ? 1 : 0;
  }
  const now = new Date().toISOString();
  await run("UPDATE tracks SET is_liked = ?, updated_at = ? WHERE id = ?", [newVal, now, trackId]);
  return newVal;
}

async function queryTracks({
  search = null,
  decade = null,
  parent_genre = null,
  genre = null,
  sub_genre = null,
  tempo = null,
  is_liked = null,
  status = null,
  sort_by = "id",
  sort_order = "ASC"
} = {}) {
  const conditions = [];
  const params = [];

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push("(title LIKE ? OR artist LIKE ? OR album LIKE ? OR file_name LIKE ? OR tags LIKE ? OR parent_genre LIKE ? OR genre LIKE ? OR sub_genre LIKE ?)");
    for (let i = 0; i < 8; i++) params.push(term);
  }

  if (decade && decade !== "All") {
    conditions.push("decade = ?");
    params.push(decade);
  }

  if (parent_genre && parent_genre !== "All") {
    if (parent_genre === "__missing__") {
      conditions.push("(parent_genre IS NULL OR parent_genre = '')");
    } else {
      conditions.push("parent_genre = ?");
      params.push(parent_genre);
    }
  }

  if (genre && genre !== "All") {
    conditions.push("genre = ?");
    params.push(genre);
  }

  if (sub_genre && sub_genre !== "All") {
    conditions.push("sub_genre = ?");
    params.push(sub_genre);
  }

  if (tempo && tempo !== "All") {
    if (tempo === "Slow") {
      conditions.push("(tempo LIKE '%Slow%' OR tempo LIKE '%slow%')");
    } else if (tempo === "Mid-tempo") {
      conditions.push("(tempo LIKE '%Mid-tempo%' OR tempo LIKE '%Mid tempo%' OR tempo LIKE '%Mid%')");
    } else if (tempo === "Fast") {
      conditions.push("((tempo LIKE '%Fast%' OR tempo LIKE '%fast%') AND tempo NOT LIKE '%Very Fast%' AND tempo NOT LIKE '%very fast%')");
    } else if (tempo === "Very Fast") {
      conditions.push("(tempo LIKE '%Very Fast%' OR tempo LIKE '%very fast%')");
    } else {
      conditions.push("tempo LIKE ?");
      params.push(`%${tempo}%`);
    }
  }

  if (is_liked !== null && is_liked !== "" && is_liked !== "All" && is_liked !== undefined) {
    if (["1", "true", "True", true, 1].includes(is_liked)) {
      conditions.push("is_liked = 1");
    } else if (["0", "false", "False", false, 0].includes(is_liked)) {
      conditions.push("(is_liked IS NULL OR is_liked = 0)");
    }
  }

  if (status && status !== "All") {
    conditions.push("status = ?");
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const allowedSort = ["id", "title", "artist", "release_year", "decade", "parent_genre", "genre", "sub_genre", "tempo", "is_liked", "status"];
  const sortByCol = allowedSort.includes(sort_by) ? sort_by : "id";
  const sortDir = String(sort_order).toUpperCase() === "DESC" ? "DESC" : "ASC";

  const textSortFields = ["title", "artist", "parent_genre", "genre", "sub_genre", "tempo", "status", "decade"];
  let orderClause = "";
  if (textSortFields.includes(sortByCol)) {
    const nullsClause = `CASE WHEN (${sortByCol} IS NULL OR ${sortByCol} = '') THEN 1 ELSE 0 END`;
    orderClause = `${nullsClause} ASC, ${sortByCol} COLLATE NOCASE ${sortDir}, id ASC`;
  } else {
    orderClause = `${sortByCol} ${sortDir}, id ASC`;
  }

  const sql = `SELECT * FROM tracks ${whereClause} ORDER BY ${orderClause}`;
  const rows = await all(sql, params);

  return rows.map(r => {
    try {
      r.tags = JSON.parse(r.tags || "[]");
    } catch (_) {
      r.tags = [];
    }
    return r;
  });
}

async function getTaxonomies() {
  const decadeRows = await all("SELECT decade, COUNT(*) as count FROM tracks WHERE decade IS NOT NULL AND decade != '' GROUP BY decade ORDER BY decade DESC");
  const decades = decadeRows.map(r => r.decade);
  const decade_counts = {};
  decadeRows.forEach(r => { decade_counts[r.decade] = r.count; });

  const parentRows = await all("SELECT parent_genre, COUNT(*) as count FROM tracks WHERE parent_genre IS NOT NULL AND parent_genre != '' GROUP BY parent_genre ORDER BY parent_genre ASC");
  const parent_genres = parentRows.map(r => r.parent_genre);
  const parent_genre_counts = {};
  parentRows.forEach(r => { parent_genre_counts[r.parent_genre] = r.count; });

  const missingParentRow = await get("SELECT COUNT(*) as count FROM tracks WHERE parent_genre IS NULL OR parent_genre = ''");
  const missing_parent_count = missingParentRow ? missingParentRow.count : 0;

  const totalRow = await get("SELECT COUNT(*) as count FROM tracks");
  const total_tracks = totalRow ? totalRow.count : 0;

  const genreRows = await all("SELECT DISTINCT genre FROM tracks WHERE genre IS NOT NULL AND genre != '' ORDER BY genre ASC");
  const genres = genreRows.map(r => r.genre);

  const subGenreRows = await all("SELECT DISTINCT sub_genre FROM tracks WHERE sub_genre IS NOT NULL AND sub_genre != '' ORDER BY sub_genre ASC");
  const sub_genres = subGenreRows.map(r => r.sub_genre);

  const tempoRows = await all("SELECT tempo FROM tracks WHERE tempo IS NOT NULL AND tempo != ''");
  const tempo_counts = { "Slow": 0, "Mid-tempo": 0, "Fast": 0, "Very Fast": 0 };
  tempoRows.forEach(({ tempo }) => {
    const tLower = (tempo || "").toLowerCase();
    if (tLower.includes("very fast")) {
      tempo_counts["Very Fast"]++;
    } else if (tLower.includes("mid")) {
      tempo_counts["Mid-tempo"]++;
    } else if (tLower.includes("slow")) {
      tempo_counts["Slow"]++;
    } else if (tLower.includes("fast")) {
      tempo_counts["Fast"]++;
    }
  });

  const taxRows = await all(`
    SELECT DISTINCT parent_genre, genre, sub_genre
    FROM tracks
    WHERE (parent_genre IS NOT NULL AND parent_genre != '')
       OR (genre IS NOT NULL AND genre != '')
       OR (sub_genre IS NOT NULL AND sub_genre != '')
  `);

  const parent_to_genres = {};
  const parent_to_subgenres = {};
  const genre_to_subgenres = {};

  taxRows.forEach(r => {
    let p = r.parent_genre;
    const g = r.genre;
    const sg = r.sub_genre;

    if (!p && g) {
      const inferred = inferParentFromGenre(g);
      if (inferred) p = inferred;
    }

    if (p) {
      if (g) {
        if (!parent_to_genres[p]) parent_to_genres[p] = new Set();
        parent_to_genres[p].add(g);
      }
      if (sg) {
        if (!parent_to_subgenres[p]) parent_to_subgenres[p] = new Set();
        parent_to_subgenres[p].add(sg);
      }
    }
    if (g && sg) {
      if (!genre_to_subgenres[g]) genre_to_subgenres[g] = new Set();
      genre_to_subgenres[g].add(sg);
    }
  });

  const parent_to_genres_clean = {};
  Object.keys(parent_to_genres).forEach(k => {
    parent_to_genres_clean[k] = Array.from(parent_to_genres[k]).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  });

  const parent_to_subgenres_clean = {};
  Object.keys(parent_to_subgenres).forEach(k => {
    parent_to_subgenres_clean[k] = Array.from(parent_to_subgenres[k]).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  });

  const genre_to_subgenres_clean = {};
  Object.keys(genre_to_subgenres).forEach(k => {
    genre_to_subgenres_clean[k] = Array.from(genre_to_subgenres[k]).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  });

  const likedRow = await get("SELECT COUNT(*) as count FROM tracks WHERE is_liked = 1");
  const liked_count = likedRow ? likedRow.count : 0;

  return {
    decades,
    decade_counts,
    parent_genres,
    parent_genre_counts,
    missing_parent_count,
    total_tracks,
    genres,
    sub_genres,
    tempos: ["Slow", "Mid-tempo", "Fast", "Very Fast"],
    tempo_counts,
    liked_count,
    parent_to_genres: parent_to_genres_clean,
    parent_to_subgenres: parent_to_subgenres_clean,
    genre_to_subgenres: genre_to_subgenres_clean
  };
}

async function getStats() {
  const totalRow = await get("SELECT COUNT(*) as count FROM tracks");
  const unprocRow = await get("SELECT COUNT(*) as count FROM tracks WHERE status = 'unprocessed'");
  const anaRow = await get("SELECT COUNT(*) as count FROM tracks WHERE status = 'analyzed'");
  const savedRow = await get("SELECT COUNT(*) as count FROM tracks WHERE status = 'saved'");

  return {
    total: totalRow ? totalRow.count : 0,
    unprocessed: unprocRow ? unprocRow.count : 0,
    analyzed: anaRow ? anaRow.count : 0,
    saved: savedRow ? savedRow.count : 0
  };
}

async function clearAllTracks() {
  await run("DELETE FROM tracks;");
  try {
    await run("DELETE FROM sqlite_sequence WHERE name = 'tracks';");
  } catch (_) {}
}

async function createPlaylist(name, description = "") {
  const now = new Date().toISOString();
  const res = await run("INSERT INTO playlists (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)", [
    name.trim(),
    (description || "").trim(),
    now,
    now
  ]);
  return res.lastID;
}

async function getPlaylists() {
  const rows = await all(`
    SELECT p.*, COUNT(pt.track_id) as track_count,
           (SELECT t.has_cover FROM playlist_tracks pt2 
            JOIN tracks t ON pt2.track_id = t.id 
            WHERE pt2.playlist_id = p.id AND t.has_cover = 1 
            LIMIT 1) as has_cover_preview,
           (SELECT pt2.track_id FROM playlist_tracks pt2 
            JOIN tracks t ON pt2.track_id = t.id 
            WHERE pt2.playlist_id = p.id AND t.has_cover = 1 
            LIMIT 1) as preview_track_id
    FROM playlists p
    LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `);
  return rows;
}

async function getPlaylist(playlistId) {
  const pRow = await get("SELECT * FROM playlists WHERE id = ?", [playlistId]);
  if (!pRow) return null;

  const trackRows = await all(`
    SELECT t.*, pt.position, pt.added_at as playlist_added_at
    FROM playlist_tracks pt
    JOIN tracks t ON pt.track_id = t.id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position ASC, pt.added_at ASC
  `, [playlistId]);

  const tracks = trackRows.map(r => {
    try {
      r.tags = JSON.parse(r.tags || "[]");
    } catch (_) {
      r.tags = [];
    }
    return r;
  });

  return {
    ...pRow,
    tracks,
    track_count: tracks.length
  };
}

async function updatePlaylist(playlistId, name, description = "") {
  const now = new Date().toISOString();
  await run("UPDATE playlists SET name = ?, description = ?, updated_at = ? WHERE id = ?", [
    name.trim(),
    (description || "").trim(),
    now,
    playlistId
  ]);
  return true;
}

async function deletePlaylist(playlistId) {
  await run("DELETE FROM playlist_tracks WHERE playlist_id = ?", [playlistId]);
  await run("DELETE FROM playlists WHERE id = ?", [playlistId]);
  return true;
}

async function addTracksToPlaylist(playlistId, trackIds) {
  const now = new Date().toISOString();
  const maxPosRow = await get("SELECT COALESCE(MAX(position), 0) as max_pos FROM playlist_tracks WHERE playlist_id = ?", [playlistId]);
  let maxPos = maxPosRow ? maxPosRow.max_pos : 0;

  let addedCount = 0;
  for (const tid of trackIds) {
    try {
      maxPos++;
      const res = await run(`
        INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at)
        VALUES (?, ?, ?, ?)
      `, [playlistId, tid, maxPos, now]);
      if (res.changes > 0) addedCount++;
    } catch (_) {}
  }

  await run("UPDATE playlists SET updated_at = ? WHERE id = ?", [now, playlistId]);
  return addedCount;
}

async function removeTrackFromPlaylist(playlistId, trackId) {
  await run("DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?", [playlistId, trackId]);
  const now = new Date().toISOString();
  await run("UPDATE playlists SET updated_at = ? WHERE id = ?", [now, playlistId]);
  return true;
}

async function exportPlaylistM3u(playlistId) {
  const playlist = await getPlaylist(playlistId);
  if (!playlist) return "";

  const lines = ["#EXTM3U", `#PLAYLIST:${playlist.name}`];
  for (const t of playlist.tracks || []) {
    const dur = Math.floor(t.duration || 0);
    const artist = t.artist || "Unknown";
    const title = t.title || t.file_name;
    const fp = t.file_path || "";
    lines.push(`#EXTINF:${dur},${artist} - ${title}`);
    lines.push(fp);
  }
  return lines.join("\n");
}

module.exports = {
  getDb,
  initDb,
  backfillMissingParentGenres,
  upsertScannedTrack,
  getTrack,
  updateTrackAiTags,
  markTrackSaved,
  toggleTrackLike,
  queryTracks,
  getTaxonomies,
  getStats,
  clearAllTracks,
  createPlaylist,
  getPlaylists,
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
  addTracksToPlaylist,
  removeTrackFromPlaylist,
  exportPlaylistM3u
};
