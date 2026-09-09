# SoundScope

SoundScope is a local desktop app for organizing and tagging messy music libraries. It scans your audio files, figures out genres, release years, and decades using the Gemini API, and writes the tags back directly to your files.

## Overview

I built this because my local library had thousands of tracks with missing genres, broken year tags, and inconsistent naming. SoundScope indexes your folders into SQLite, gives you a multi-filter interface to browse by era or genre, and uses Gemini to fill in missing metadata.

## Features

- Scans MP3, FLAC, M4A, MP4, and OGG files recursively, saving everything into a local SQLite database.
- Multi-tier filtering: drill down by decade (80s, 90s, 2000s, etc.), parent genre, core genre, subgenre, BPM, review status, or favorites.
- Batch AI tagging with automatic model fallback. If one Gemini model hits free-tier rate limits, it falls back to the next model in your cascade list (`gemini-3.5-flash-lite`, `gemini-2.5-flash`, etc.) without killing your queue.
- Audio snippet analysis. For obscure bootlegs or tracks with zero metadata, it can clip a 15-second snippet with FFmpeg and send the audio directly to Gemini to detect tempo and genre.
- Built-in audio player with waveform seeking and `.m3u8` playlist export.
- Desktop wrapper (via pywebview) and browser mode.
- Dual tag writing: updates standard tags for regular music players and can optionally write custom `TXXX` frames for tools like Foobar2000 or MusicBee.

## Install

Requires Node.js 18+ (tested on Node v20) and an optional API key from Google AI Studio. If you want audio snippet analysis, make sure `ffmpeg` is installed on your system PATH.

Clone the repo and install dependencies:

```bash
git clone https://github.com/rayyan-naufal/SoundScope.git
cd SoundScope
npm install
```

Set up your `.env` file (or configure directly in the app UI):

```bash
cp .env.example .env
```

Add your Gemini API key (which you can get free from Google AI Studio):

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## Usage

### Run Desktop Window (Lightweight Native App Container)
On Windows, you can launch SoundScope with **no command prompt window**:
- Double-click **`SoundScope.lnk`** (App shortcut with custom icon on desktop or in folder)
- Or double-click **`SoundScope.vbs`** / **`run.bat`** (runs silently in the background)
- Or run via terminal:
```bash
npm run app
# or: node run.js
```
*Tip: To run in debug mode with console output visible, run `run_debug.bat`.*

### Run as Local Web Server
To run as a web server without launching the desktop window:

```bash
npm start
# or: node server/index.js
```

Open `http://127.0.0.1:8765`, pick your music folder, and hit scan. Once indexed, select tracks and click analyze to generate tag suggestions, then save changes to disk.

## How tagging works

SoundScope uses a 3-tier genre structure so you don't end up with hundreds of random genre tags:

```text
Electronic
└── Techno
    └── Acid Techno
```

Metadata is checked first. If title and artist are enough to identify the track, it uses that. If you enable audio analysis or the track has no usable metadata, it sends a temporary 15-second clip to Gemini to classify acoustics, instruments, and BPM.

## Metadata it writes

By default, SoundScope writes standard `TCON` (genre) and `TDRC` (release year) frames using Mutagen. It leaves existing tags like artist, album, and embedded cover art alone.

If you turn on custom frames in settings, it also writes:
- `TXXX:PARENT_GENRE` (e.g. Electronic)
- `TXXX:GENRE` (e.g. Techno)
- `TXXX:SUBGENRE` (e.g. Acid Techno)
- `TXXX:DECADE` (e.g. 2020s)
- `TBPM` (detected BPM)

## Privacy

Your music files never leave your machine. Your API key stays in your local `.env` or settings file and is never sent anywhere except Google's API endpoints. The only data transmitted is track metadata or the temporary 15-second audio snippet when you run analysis.

## License

MIT