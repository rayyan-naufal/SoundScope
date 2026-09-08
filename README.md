# SoundScope 🎵🔍

<div align="center">

**Local AI-Powered Hierarchical Music Tagger & Catalog Explorer**  
*Search, filter, classify, and organize your music library using Google Gemini AI models with precision hierarchical taxonomy and multi-dimensional filtering.*

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-AI%20Studio-4285F4?style=flat&logo=google&logoColor=white)](https://aistudio.google.com)
[![Pywebview](https://img.shields.io/badge/GUI-pywebview-FF6F00?style=flat)](https://pywebview.flowrl.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📖 Overview

**SoundScope** is a modern desktop music tagging and discovery workstation designed to bring clarity to large, unstructured music libraries. Powered by Google Gemini AI, SoundScope analyzes track metadata and acoustic audio snippets to extract canonical release years, decades, and a 3-tier hierarchical genre taxonomy:

```
[Parent Genre]  ➡️  [Core Genre]  ➡️  [Sub-Genre]
    EDM        ➡️    Techno      ➡️   Acid Techno
   Metal       ➡️   Nu Metal     ➡️    Rap Metal
    Pop        ➡️  Dance-Pop     ➡️    Nu-Disco
```

Tags are written directly into your audio files (ID3v2.3 / ID3v2.4 / Vorbis / MP4 tags) and indexed into a lightning-fast local SQLite database for faceted multi-filtering, instant search, and playlist curation.

---

## ✨ Key Features

- 🔍 **Deep Multi-Filter & Faceted Search**:
  - Filter simultaneously by **Decade** (e.g. `80s`, `90s`, `2000s`, `2010s`, `2020s`), **Parent Genre**, **Core Genre**, **Sub-Genre**, **Tempo (BPM)**, **Like Status (❤️)**, and **Tagging Status**.
  - Interactive decade bar for instant era-hopping.
  - Real-time instant text search across artist, title, album, genre, and subgenre.

- 🧠 **Hierarchical Genre Taxonomy**:
  - **Parent Genre**: Macro musical family (e.g., `EDM`, `Rock`, `Metal`, `Pop`, `Hip Hop`, `Jazz`, `Classical`).
  - **Core Genre**: Canonical genre classification (e.g., `Techno`, `Progressive Rock`, `Alternative R&B`).
  - **Sub-Genre**: Specific micro-subgenres (e.g., `Peak Time Techno`, `Midwest Emo`, `Vaporwave`).

- 📅 **Decade & Release Year Precision**:
  - Identifies canonical release years and groups tracks into standard decade buckets for instant era browsing.

- ⚡ **Gemini Multi-Model Cascade**:
  - Automatic fallback mechanism: if free-tier rate limits (RPM) or daily quotas are reached on one model, SoundScope cascades seamlessly to alternative Gemini models (`gemini-3.5-flash-lite`, `gemini-2.5-flash`, `gemini-3-flash`, etc.) without interrupting your tagging workflow.

- 🎧 **Hybrid Audio Snippet Listening**:
  - For unreleased tracks, bootlegs, or obscure filenames, SoundScope can extract a 15-second snippet and stream it directly to Gemini for acoustic analysis.

- 🏷️ **Standard & Custom Metadata Frames**:
  - Writes standard `TCON` (Genre) and `TDRC` (Year) frames for compatibility with standard media players.
  - Optionally writes custom user frames (`TXXX:PARENT_GENRE`, `TXXX:GENRE`, `TXXX:SUBGENRE`, `TXXX:DECADE`, `TBPM`) for DJ tools and power-user players like **Foobar2000**, **MusicBee**, and **Mp3tag**.

- 💻 **Desktop Workstation UI**:
  - Native window desktop wrapper with dark aesthetic.
  - Dual modes: **Studio Mode** (tag editing, AI analysis, batch tagging) & **Player Mode** (distraction-free listening).
  - Built-in audio player with waveform seeking and volume controls.
  - Playlist manager with `.m3u8` export support.

- 📂 **Broad Format Support**:
  - Supports `.mp3`, `.flac`, `.m4a`, `.mp4`, and `.ogg` files.

---

## 🛠️ Prerequisites

1. **Python 3.10+**: Ensure Python is installed and added to your system `PATH`.
2. **Google Gemini API Key**: Free API key available at [Google AI Studio](https://aistudio.google.com/).
3. *(Optional)* **FFmpeg**: Required only for the 🎧 audio snippet analysis feature. Make sure `ffmpeg` is available in your system `PATH`.

---

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/soundscope.git
cd soundscope
```

### 2. Create a Virtual Environment (Recommended)
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure API Key

You can configure your Gemini API key in any of the following ways:
- **Via the UI**: Click the **🔑 API Key** button or the **⚙️ Settings** modal when the application launches.
- **Via `.env` file**:
  ```bash
  cp .env.example .env
  ```
  Open `.env` and set your key:
  ```env
  GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
  ```
- **Via Environment Variable**:
  ```bash
  # Windows PowerShell
  $env:GEMINI_API_KEY="your-api-key"

  # Bash
  export GEMINI_API_KEY="your-api-key"
  ```

---

## 🎮 Running the Application

### Option A: Launcher Script (Windows)
- **Normal Mode**: Double-click `run.bat` (launches as a standalone desktop app).
- **Debug Mode**: Double-click `run_debug.bat` (keeps terminal open to view live logs and model fallback notifications).

### Option B: Command Line (Desktop Window)
```bash
python run.py
```

### Option C: Web Browser Mode
To run without the desktop window in your favorite browser:
```bash
uvicorn main:app --host 127.0.0.1 --port 8765 --reload
```
Then visit `http://127.0.0.1:8765` in your browser.

---

## 🗂️ Project Structure

```text
├── config.py             # Configuration loader, cascade list, and path settings
├── main.py               # FastAPI backend with REST endpoints & audio streaming
├── run.py                # Desktop GUI runner (pywebview + uvicorn)
├── run.bat               # Windows launcher (silent)
├── run_debug.bat         # Windows launcher with terminal output
├── requirements.txt      # Python dependencies
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore rules for caches, credentials & databases
├── LICENSE               # MIT License
├── data/                 # Local data storage (settings.json, SQLite databases)
├── services/
│   ├── ai_analyzer.py    # Gemini prompts, cascade fallback & audio snippet listening
│   ├── audio_streamer.py # Partial content HTTP range streamer for audio playback
│   ├── database.py       # SQLite database operations, cataloging & playlists
│   ├── tag_reader.py     # Mutagen audio file scanner and metadata extractor
│   ├── tag_writer.py     # ID3v2/Vorbis/MP4 tag writer (standard + custom TXXX)
│   └── taxonomy.py       # Hierarchical music genre taxonomy mappings
└── static/
    ├── app.js            # Main UI state, batch processing, audio visualizer
    ├── i18n.js           # Internationalization support (English & Indonesian)
    ├── index.html        # Workstation UI layout
    └── styles.css        # Premium dark workstation styling
```

---

## 🏷️ Metadata Specification

When writing tags to audio files, SoundScope applies the following standard frames:

| Tag Type | Frame / Atom | Example Value | Description |
|---|---|---|---|
| **Standard Genre** | `TCON` / `genre` / `©gen` | `EDM; Techno; Acid Techno` | Combined taxonomy string |
| **Release Year** | `TDRC` / `date` / `©day` | `2023` | Canonical track year |
| **Parent Genre** | `TXXX:PARENT_GENRE` | `EDM` | Custom frame |
| **Core Genre** | `TXXX:GENRE` | `Techno` | Custom frame |
| **Sub-Genre** | `TXXX:SUBGENRE` | `Acid Techno` | Custom frame |
| **Decade** | `TXXX:DECADE` | `2020s` | Custom frame |
| **Tempo (BPM)** | `TBPM` / `bpm` / `tmpo` | `132` | Detected/analyzed tempo |

*Note: Custom `TXXX` frames can be enabled or disabled anytime in Settings.*

---

## 🔒 Privacy & Local Storage

- All music files and catalog database files (`.db`) remain strictly on your local machine.
- Your Google Gemini API Key and settings are stored locally in `data/settings.json` (which is excluded from Git via `.gitignore`).
- Only track metadata or optional 15-second audio snippets are sent to Google Gemini for classification when requested.

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
