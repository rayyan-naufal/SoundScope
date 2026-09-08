const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { loadSettings, MODEL_CASCADE } = require('./config');
const { resolveGenreHierarchy, formatTrackTags } = require('./taxonomy');

class RateLimitError extends Error {
  constructor(message = "Gemini API rate limit reached. Please wait before retrying.", retryAfter = 15, isDailyLimit = false) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    this.isDailyLimit = isDailyLimit;
  }
}

const EXHAUSTED_DAILY_MODELS = new Set();
let _LAST_CONFIGURED_API_KEY = "";

function isRateLimitError(err) {
  const s = String(err && err.message ? err.message : err).toLowerCase();
  return ["429", "resourceexhausted", "quota", "rate limit", "ratelimit"].some(k => s.includes(k));
}

function isDailyQuotaError(err) {
  const s = String(err && err.message ? err.message : err).toLowerCase();
  return [
    "generaterequestsperday",
    "perdayperprojectpermodel",
    "limit: 500",
    "free_tier_requests",
    "daily quota"
  ].some(k => s.includes(k));
}

function getSystemInstruction(includeTempo = true, focusTempoOnly = false) {
  const tempoInstruction = includeTempo
    ? "10. tempo: The tempo/pace of the track. MUST be one of: 'Slow', 'Mid-tempo', 'Fast', 'Very Fast'. Optionally include estimated BPM if recognized (e.g. 'Slow (~75 BPM)', 'Mid-tempo (~108 BPM)', 'Fast (~128 BPM)', 'Very Fast (~150+ BPM)').\n"
    : "";

  if (focusTempoOnly) {
    return `You are a music metadata quality assistant. Preserve the existing genre hierarchy exactly as provided and do NOT reclassify parent_genre, genre, or sub_genre.

Your task is only to determine the track tempo/pace for a song that already has a valid genre hierarchy.

Rules:
1. Keep parent_genre, genre, and sub_genre unchanged from the provided values.
2. Only update the tempo field.
3. If tempo is uncertain, choose the closest valid value: Slow, Mid-tempo, Fast, or Very Fast.
4. notes should be brief and mention that the hierarchy was preserved while tempo was refreshed.
${tempoInstruction}`;
  }

  return `You are an expert musicologist and audio archivist. Your job is to classify music tracks into an accurate, structured genre hierarchy and identify their original release year and decade.

CRITICAL PRIORITY RULES:
1. parent_genre (ABSOLUTE HIGHEST PRIORITY): Broad macro-category. MUST be non-null and strictly chosen from one of these 14 categories:
   ["EDM", "Pop", "Rock", "Metal", "Hip Hop", "R&B", "Electronic", "Latin", "Country", "Jazz", "Classical", "Folk", "Reggae", "Blues"].
   Never leave parent_genre empty or null under any circumstance.
2. genre (SECONDARY PRIORITY): The recognized core genre within that parent category (e.g. "Techno", "House", "Nu Metal", "Heavy Metal", "Dance-Pop", "Trap", "Indie Rock", "Synth-Pop", "Boom Bap", "Neo-Soul", "Afrobeats").
3. sub_genre (TERTIARY / LOWEST PRIORITY): A DISTINCT micro-genre, style, scene, or movement that is MORE SPECIFIC than genre. It MUST NOT be the same as genre. Examples of valid (genre -> sub_genre) pairs: (Eurodance -> Euro-Pop), (Eurodance -> Euro House), (Trip Hop -> Bristol Sound), (Trip Hop -> Dark Trip Hop), (Groove Metal -> Southern Groove Metal), (Pop-Rock -> Power Pop), (Pop-Rock -> Arena Pop Rock), (New Jack Swing -> New Jill Swing), (Rap Metal -> Funk Metal), (Boom Bap -> East Coast Boom Bap), (House -> Deep House), (Techno -> Acid Techno). If you truly cannot identify a sub_genre more specific than genre, return null — NEVER duplicate the genre value.
4. release_year: Integer representing the official first release year of the song/single/album (e.g. 2021).
5. decade: Formatted string representing the decade (e.g. "2000s", "2010s", "2020s", "1990s", "1980s", "1970s").
6. tags: A list of 5-8 concise tags for searching, strictly starting with: [decade, parent_genre, genre, sub_genre, and 1-3 mood/style tags].
7. title: Cleaned canonical track title (without rip artifacts like 'Official Audio' or 'MP3').
8. artist: Cleaned canonical primary artist name.
9. notes: A concise 1-sentence explanation of why this classification was chosen.
${tempoInstruction}`;
}

function shouldFocusTempoOnly(trackInfo) {
  if (!trackInfo) return false;
  const settings = loadSettings();
  if (!settings.analyze_tempo) return false;
  const hierarchyPresent = ["parent_genre", "genre", "sub_genre"].some(f => (trackInfo[f] || "").trim().length > 0);
  const tempoMissing = !(trackInfo.tempo || "").trim();
  return hierarchyPresent && tempoMissing;
}

function finalizeTempoOnlyResult(trackInfo, data) {
  const existingParent = trackInfo.parent_genre || data.parent_genre;
  const existingGenre = trackInfo.genre || data.genre;
  const existingSub = trackInfo.sub_genre || data.sub_genre;
  const existingDecade = trackInfo.decade || data.decade;
  const finalTags = data.tags || trackInfo.tags || [];
  const [p, g, s] = resolveGenreHierarchy(existingParent, existingGenre, existingSub);

  const merged = {
    title: data.title || trackInfo.title,
    artist: data.artist || trackInfo.artist,
    release_year: data.release_year !== undefined ? data.release_year : trackInfo.release_year,
    decade: existingDecade,
    parent_genre: p,
    genre: g,
    sub_genre: s,
    tempo: data.tempo || trackInfo.tempo,
    tags: formatTrackTags(p, g, s, existingDecade, finalTags),
    notes: data.notes || "",
    confidence: data.confidence || "medium"
  };

  if (data.used_model) {
    merged.used_model = data.used_model;
  }
  return merged;
}

async function callGeminiApi(modelName, apiKey, systemInstruction, parts, timeoutMs = 25000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  if (systemInstruction) {
    body.system_instruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const json = await res.json();
    if (!res.ok) {
      const errMsg = json.error ? json.error.message : `HTTP ${res.status}`;
      const err = new Error(errMsg);
      err.status = res.status;
      err.code = json.error ? json.error.code : res.status;
      throw err;
    }

    if (!json.candidates || json.candidates.length === 0 || !json.candidates[0].content) {
      throw new Error("Gemini returned empty candidate content.");
    }

    const text = json.candidates[0].content.parts.map(p => p.text || "").join("");
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeTrackMetadata(trackInfo) {
  const settings = loadSettings();
  const apiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    throw new Error("Gemini API Key is not set. Please click 🔑 API Key in the top navigation or Settings (⚙️) to provide your key.");
  }

  if (apiKey !== _LAST_CONFIGURED_API_KEY) {
    _LAST_CONFIGURED_API_KEY = apiKey;
    EXHAUSTED_DAILY_MODELS.clear();
  }

  const modelCascade = settings.model_cascade || MODEL_CASCADE;
  const includeTempo = settings.analyze_tempo !== false;
  const focusTempoOnly = shouldFocusTempoOnly(trackInfo);

  const title = trackInfo.title || "";
  const artist = trackInfo.artist || "";
  const album = trackInfo.album || "";
  const filename = trackInfo.file_name || "";
  const existingGenre = trackInfo.genre || "";
  const existingYear = trackInfo.release_year || "";
  const existingHierarchy = {
    parent_genre: trackInfo.parent_genre || "",
    genre: trackInfo.genre || "",
    sub_genre: trackInfo.sub_genre || ""
  };

  const tempoFieldSchema = includeTempo ? ',\n  "tempo": "Fast (~128 BPM)"' : "";

  let prompt = "";
  if (focusTempoOnly) {
    prompt = `Refresh tempo only for this track while preserving the existing genre hierarchy.
- Filename: "${filename}"
- Artist: "${artist}"
- Title: "${title}"
- Album: "${album}"
- Existing hierarchy: ${JSON.stringify(existingHierarchy)}
- Existing Year hint: "${existingYear}"

Return strictly a JSON object with only the tempo/pace fields needed for this update:
{
  "tempo": "Fast (~128 BPM)",
  "notes": "Tempo refreshed while preserving the existing genre hierarchy.",
  "confidence": "medium"
}`;
  } else {
    prompt = `Analyze this track:
- Filename: "${filename}"
- Artist: "${artist}"
- Title: "${title}"
- Album: "${album}"
- Existing Genre hint: "${existingGenre}"
- Existing Year hint: "${existingYear}"

Return strictly a JSON object conforming to this schema (parent_genre is strictly mandatory):
{
  "title": "Clean track title",
  "artist": "Clean artist name",
  "release_year": 2021,
  "decade": "2020s",
  "parent_genre": "EDM",
  "genre": "Techno",
  "sub_genre": "Acid Techno"${tempoFieldSchema},
  "tags": ["2020s", "EDM", "Techno", "Acid Techno", "Peak Time"],
  "notes": "Released in 2021 by Maddix; combines acid basslines with peak-time techno.",
  "confidence": "high"
}`;
  }

  let activeCascade = modelCascade.filter(m => !EXHAUSTED_DAILY_MODELS.has(m));
  if (activeCascade.length === 0) activeCascade = modelCascade;

  let lastError = null;
  const attemptedModels = [];
  let hasRateLimit = false;
  let hasDailyLimit = false;
  const systemInstruction = getSystemInstruction(includeTempo, focusTempoOnly);

  for (let idx = 0; idx < activeCascade.length; idx++) {
    const modelName = activeCascade[idx];
    attemptedModels.push(modelName);

    try {
      console.log(`[${trackInfo.file_name || ""}] Attempting AI analysis (tempo=${includeTempo}) with model: ${modelName}...`);
      const data = await callGeminiApi(modelName, apiKey, systemInstruction, [{ text: prompt }]);

      data.used_model = modelName;
      if (idx > 0 || modelName !== modelCascade[0]) {
        const fallbackNote = `[Model: ${modelName} (Fell back from ${modelCascade[0]} due to quota/rate limit)] `;
        data.notes = fallbackNote + (data.notes || "");
      } else {
        data.notes = `[Model: ${modelName}] ` + (data.notes || "");
      }

      if (data.release_year) {
        const yr = parseInt(data.release_year, 10);
        if (!isNaN(yr)) {
          data.release_year = yr;
          data.decade = `${Math.floor(yr / 10) * 10}s`;
        }
      }

      if (focusTempoOnly) {
        const merged = finalizeTempoOnlyResult(trackInfo, data);
        console.log(`[${trackInfo.file_name || ""}] Successfully refreshed tempo only using ${modelName}.`);
        return merged;
      }

      const [p, g, s] = resolveGenreHierarchy(data.parent_genre, data.genre, data.sub_genre);
      data.parent_genre = p;
      data.genre = g;
      data.sub_genre = s;
      data.tags = formatTrackTags(p, g, s, data.decade, data.tags);

      console.log(`[${trackInfo.file_name || ""}] Successfully analyzed using ${modelName} (${p} -> ${g})!`);
      return data;
    } catch (err) {
      lastError = err;
      if (isDailyQuotaError(err)) {
        hasDailyLimit = true;
        EXHAUSTED_DAILY_MODELS.add(modelName);
        console.log(`[Model Cascade] Daily quota reached for ${modelName}. Added to daily-exhausted list. Falling back to next model...`);
      } else if (isRateLimitError(err)) {
        hasRateLimit = true;
      }
      console.log(`Model ${modelName} failed: ${err.message}. Falling back to next model...`);
      continue;
    }
  }

  if (hasDailyLimit || modelCascade.every(m => EXHAUSTED_DAILY_MODELS.has(m))) {
    throw new RateLimitError(
      `Gemini daily free-tier quota exceeded across models (${attemptedModels.join(", ")}). Last error: ${lastError}`,
      0,
      true
    );
  }
  if (hasRateLimit) {
    throw new RateLimitError(
      `Gemini free-tier rate limit (15 RPM) exceeded across models (${attemptedModels.join(", ")}). Last error: ${lastError}`,
      15,
      false
    );
  }
  throw new Error(
    `All Gemini models (${attemptedModels.join(", ")}) failed. Last error: ${lastError}. You can change or update your Gemini API key in the top right (🔑/⚙️).`
  );
}

// Fallback for audio snippet analysis
async function analyzeTrackAudio(trackInfo) {
  // If no ffmpeg or multimodal fails, transparently fall back to metadata analysis
  return analyzeTrackMetadata(trackInfo);
}

module.exports = {
  RateLimitError,
  analyzeTrackMetadata,
  analyzeTrackAudio
};
