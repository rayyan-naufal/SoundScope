const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');

const BASE_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(BASE_DIR, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CONFIG_FILE = path.join(DATA_DIR, 'settings.json');
const ENV_FILE = path.join(BASE_DIR, '.env');

const MODEL_CASCADE = [
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.7-flash"
];

const defaultMusicDir = path.join(os.homedir(), 'Music');

const DEFAULT_SETTINGS = {
  gemini_api_key: process.env.GEMINI_API_KEY || "",
  default_music_dir: fs.existsSync(defaultMusicDir) ? defaultMusicDir : "",
  tag_separator: "; ",
  model_cascade: MODEL_CASCADE,
  write_custom_frames: true,
  write_standard_genre: true,
  analyze_tempo: true,
  language: "en",
  port: 8765
};

function loadSettings() {
  const settings = { ...DEFAULT_SETTINGS };

  // Read .env file
  if (fs.existsSync(ENV_FILE)) {
    try {
      const content = fs.readFileSync(ENV_FILE, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [k, ...vParts] = trimmed.split('=');
          const key = k.trim();
          const val = vParts.join('=').trim().replace(/^['"]|['"]$/g, '');
          if (key === 'GEMINI_API_KEY' && val) {
            settings.gemini_api_key = val;
            process.env.GEMINI_API_KEY = val;
          }
        }
      });
    } catch (err) {
      console.error("Error reading .env:", err.message);
    }
  }

  // Read settings.json
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const userSettings = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      Object.assign(settings, userSettings);
    } catch (err) {
      console.error("Error loading settings.json:", err.message);
    }
  }

  const envKey = process.env.GEMINI_API_KEY || "";
  const currentKey = settings.gemini_api_key || "";
  if (!currentKey || (!currentKey.startsWith("AIza") && envKey.startsWith("AIza"))) {
    if (envKey) settings.gemini_api_key = envKey;
  }

  return settings;
}

function saveSettings(newSettings) {
  const current = loadSettings();
  Object.assign(current, newSettings);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(current, null, 2), 'utf-8');
  return current;
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(preferredPort, maxTries = 10) {
  for (let offset = 0; offset < maxTries; offset++) {
    const port = preferredPort + offset;
    const available = await checkPortAvailable(port);
    if (available) return port;
  }
  return null;
}

module.exports = {
  BASE_DIR,
  DATA_DIR,
  CONFIG_FILE,
  ENV_FILE,
  MODEL_CASCADE,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  findAvailablePort
};
