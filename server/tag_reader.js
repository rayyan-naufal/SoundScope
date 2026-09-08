const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');
const { formatTrackTags, inferParentFromGenre } = require('./taxonomy');

const SUPPORTED_EXTENSIONS = new Set([".mp3", ".flac", ".m4a", ".ogg", ".opus", ".wav"]);

function cleanTag(val) {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) {
    val = val.length > 0 ? val[0] : null;
  }
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s.length > 0 ? s : null;
}

function parseYear(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/\b(19\d{2}|20\d{2})\b/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function computeDecade(year) {
  if (!year || year < 1900 || year > 2099) return null;
  return `${Math.floor(year / 10) * 10}s`;
}

function parseFilenameFallback(filename) {
  let stem = path.parse(filename).name;
  stem = stem.replace(/^\d+[\s\.\-_]+/, "");
  if (stem.includes(" - ")) {
    const parts = stem.split(" - ");
    const artist = parts[0].trim();
    const title = parts.slice(1).join(" - ").trim();
    return { artist: artist || null, title: title || stem };
  }
  return { artist: null, title: stem };
}

async function readAudioFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) return null;

  let stats;
  try {
    stats = fs.statSync(filePath);
    if (!stats.isFile()) return null;
  } catch (_) {
    return null;
  }

  const fileName = path.basename(filePath);
  const fileSize = stats.size;
  let duration = 0.0;

  let title = null;
  let artist = null;
  let album = null;
  let year = null;
  let parentGenre = null;
  let genre = null;
  let subGenre = null;
  let tempo = null;
  let hasCover = 0;

  try {
    const meta = await mm.parseFile(filePath, { duration: true, skipCovers: false });
    if (meta && meta.format && meta.format.duration) {
      duration = Math.round(meta.format.duration * 10) / 10;
    }

    if (meta && meta.common) {
      const c = meta.common;
      title = cleanTag(c.title);
      artist = cleanTag(c.artist);
      album = cleanTag(c.album);

      if (c.year) {
        year = parseYear(c.year);
      } else if (c.date) {
        year = parseYear(c.date);
      }

      if (c.picture && c.picture.length > 0) {
        hasCover = 1;
      }

      if (c.bpm) {
        tempo = `~${c.bpm} BPM`;
      }

      // Check genre
      if (Array.isArray(c.genre) && c.genre.length > 0) {
        const fullGenreStr = c.genre.join("; ");
        if (fullGenreStr.includes(";")) {
          const parts = fullGenreStr.split(";").map(p => p.trim()).filter(Boolean);
          if (parts.length >= 3) {
            parentGenre = parts[0];
            genre = parts[1];
            subGenre = parts[2];
          } else if (parts.length === 2) {
            parentGenre = parts[0];
            genre = parts[1];
          } else if (parts.length === 1) {
            genre = parts[0];
          }
        } else {
          genre = cleanTag(c.genre[0]);
        }
      }
    }

    // Check native custom frames for TXXX:PARENT_GENRE, TXXX:GENRE, TXXX:SUBGENRE, TXXX:TEMPO
    if (meta && meta.native) {
      const allNative = [];
      Object.values(meta.native).forEach(tagList => {
        if (Array.isArray(tagList)) allNative.push(...tagList);
      });

      allNative.forEach(tag => {
        const id = (tag.id || "").toUpperCase();
        const val = cleanTag(tag.value);
        if (!val) return;

        if (id === "TXXX:PARENT_GENRE" || id === "PARENT_GENRE" || id === "----:COM.APPLE.ITUNES:PARENT_GENRE") {
          parentGenre = val;
        } else if (id === "TXXX:GENRE" || id === "GENRE") {
          genre = val;
        } else if (id === "TXXX:SUBGENRE" || id === "TXXX:SUB_GENRE" || id === "SUB_GENRE" || id === "SUBGENRE") {
          subGenre = val;
        } else if (id === "TXXX:TEMPO" || id === "TXXX:PACE" || id === "TEMPO" || id === "PACE" || id === "----:COM.APPLE.ITUNES:TEMPO") {
          tempo = val;
        }
      });
    }
  } catch (err) {
    // If metadata parsing fails, fallback to filename parsing
  }

  // Fallback for title/artist from filename
  if (!title || !artist) {
    const fb = parseFilenameFallback(fileName);
    if (!title) title = fb.title;
    if (!artist) artist = fb.artist;
  }

  const decade = computeDecade(year);
  if (!parentGenre && genre) {
    parentGenre = inferParentFromGenre(genre);
  }

  const tagsList = formatTrackTags(parentGenre, genre, subGenre, decade, []);

  return {
    file_path: filePath,
    file_name: fileName,
    file_size: fileSize,
    duration,
    title,
    artist,
    album,
    release_year: year,
    decade,
    parent_genre: parentGenre,
    genre,
    sub_genre: subGenre,
    tempo,
    tags: tagsList,
    has_cover: hasCover,
    status: "unprocessed"
  };
}

async function scanDirectory(directoryPath) {
  const results = [];

  async function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          const track = await readAudioFile(fullPath);
          if (track) {
            results.push(track);
          }
        }
      }
    }
  }

  await walk(directoryPath);
  return results;
}

// In-memory cover art cache
const coverCache = new Map();
const MAX_COVER_CACHE = 2000;

async function extractCoverBytes(filePath) {
  if (coverCache.has(filePath)) {
    return coverCache.get(filePath);
  }

  try {
    const meta = await mm.parseFile(filePath, { duration: false, skipCovers: false });
    if (meta && meta.common && meta.common.picture && meta.common.picture.length > 0) {
      const pic = meta.common.picture[0];
      const coverData = {
        data: Buffer.from(pic.data),
        mime: pic.format || "image/jpeg"
      };

      if (coverCache.size >= MAX_COVER_CACHE) {
        // Evict oldest 20%
        const keys = Array.from(coverCache.keys()).slice(0, Math.floor(MAX_COVER_CACHE * 0.2));
        keys.forEach(k => coverCache.delete(k));
      }

      coverCache.set(filePath, coverData);
      return coverData;
    }
  } catch (err) {
    console.error(`Error extracting cover from ${filePath}:`, err.message);
  }

  return null;
}

function invalidateCoverCache(filePath) {
  coverCache.delete(filePath);
}

module.exports = {
  SUPPORTED_EXTENSIONS,
  readAudioFile,
  scanDirectory,
  extractCoverBytes,
  invalidateCoverCache
};
