import os
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

CONFIG_FILE = DATA_DIR / "settings.json"

ENV_FILE = BASE_DIR / ".env"

MODEL_CASCADE = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.7-flash"
]

DEFAULT_SETTINGS = {
    "gemini_api_key": os.environ.get("GEMINI_API_KEY", ""),
    "default_music_dir": str(Path.home() / "Music") if (Path.home() / "Music").exists() else "",
    "tag_separator": "; ",
    "model_cascade": MODEL_CASCADE,
    "write_custom_frames": True,
    "write_standard_genre": True,
    "analyze_tempo": True,
    "language": "en",
    "port": 8765
}

def load_settings():
    settings = dict(DEFAULT_SETTINGS)
    
    # Check .env file first
    if ENV_FILE.exists():
        try:
            with open(ENV_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k == "GEMINI_API_KEY" and v:
                            settings["gemini_api_key"] = v
        except Exception as e:
            print(f"Error reading .env: {e}")
            
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                user_settings = json.load(f)
                settings.update(user_settings)
        except Exception as e:
            print(f"Error loading settings: {e}")
            
    env_key = os.environ.get("GEMINI_API_KEY", "")
    current_key = settings.get("gemini_api_key", "")
    if not current_key or (not current_key.startswith("AIza") and env_key.startswith("AIza")):
        if env_key:
            settings["gemini_api_key"] = env_key
    return settings

def save_settings(new_settings: dict):
    current = load_settings()
    current.update(new_settings)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)
    return current
