import os
import re
from pathlib import Path
from typing import Optional, Dict, Any, List
import mutagen
from mutagen.id3 import ID3
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
from mutagen.mp4 import MP4
from mutagen.oggvorbis import OggVorbis

SUPPORTED_EXTENSIONS = {".mp3", ".flac", ".m4a", ".ogg", ".opus", ".wav"}

def clean_tag(val):
    if val is None:
        return None
    if isinstance(val, list):
        val = val[0] if val else None
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None

def parse_year(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    match = re.search(r"\b(19\d{2}|20\d{2})\b", str(date_str))
    if match:
        return int(match.group(1))
    return None

def compute_decade(year: Optional[int]) -> Optional[str]:
    if not year or year < 1900 or year > 2099:
        return None
    return f"{(year // 10) * 10}s"

def parse_filename_fallback(filename: str):
    """
    Tries to extract Artist and Title from filename if tags are empty.
    e.g. 'Maddix - Acid For Breakfast.mp3' -> ('Maddix', 'Acid For Breakfast')
    """
    stem = Path(filename).stem
    # Remove track numbers like '01 - ' or '01. '
    stem = re.sub(r"^\d+[\s\.\-_]+", "", stem)
    
    if " - " in stem:
        parts = stem.split(" - ", 1)
        artist = parts[0].strip()
        title = parts[1].strip()
        return artist, title
    return None, stem

def read_audio_file(file_path: str) -> Optional[Dict[str, Any]]:
    path = Path(file_path)
    if not path.exists() or path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        return None
    
    ext = path.suffix.lower()
    file_size = path.stat().st_size
    duration = 0.0
    
    title = None
    artist = None
    album = None
    year = None
    parent_genre = None
    genre = None
    sub_genre = None
    tempo = None
    tags_list = []
    has_cover = 0
    
    try:
        audio = mutagen.File(str(path))
        if audio is not None:
            if hasattr(audio, "info") and hasattr(audio.info, "length"):
                duration = round(audio.info.length, 1)
                
            if ext == ".mp3":
                # Handle MP3 ID3 tags
                try:
                    id3 = ID3(str(path))
                    title = clean_tag(id3.get("TIT2"))
                    artist = clean_tag(id3.get("TPE1"))
                    album = clean_tag(id3.get("TALB"))
                    
                    year_raw = clean_tag(id3.get("TDRC") or id3.get("TYER"))
                    year = parse_year(year_raw)
                    
                    # Custom TXXX frames
                    parent_txxx = id3.get("TXXX:PARENT_GENRE")
                    if parent_txxx:
                        parent_genre = clean_tag(parent_txxx.text)
                        
                    genre_txxx = id3.get("TXXX:GENRE")
                    if genre_txxx:
                        genre = clean_tag(genre_txxx.text)
                    else:
                        tcon_raw = clean_tag(id3.get("TCON"))
                        if tcon_raw:
                            # TCON might contain combined genre e.g. "Rock; Alternative Rock; Grunge"
                            if ";" in tcon_raw:
                                parts = [p.strip() for p in tcon_raw.split(";") if p.strip()]
                                if len(parts) >= 3:
                                    if not parent_genre: parent_genre = parts[0]
                                    genre = parts[1]
                                    if not sub_genre: sub_genre = parts[2]
                                elif len(parts) == 2:
                                    if not parent_genre: parent_genre = parts[0]
                                    genre = parts[1]
                                else:
                                    genre = parts[0]
                            else:
                                genre = tcon_raw
                        
                    sub_txxx = id3.get("TXXX:SUBGENRE")
                    if sub_txxx:
                        sub_genre = clean_tag(sub_txxx.text)
                        
                    # Tempo / Pace
                    tempo_txxx = id3.get("TXXX:TEMPO") or id3.get("TXXX:PACE")
                    if tempo_txxx:
                        tempo = clean_tag(tempo_txxx.text)
                    elif id3.get("TBPM"):
                        tempo = f"~{clean_tag(id3.get('TBPM'))} BPM"
                        
                    # Check cover
                    for k in id3.keys():
                        if k.startswith("APIC"):
                            has_cover = 1
                            break
                except Exception:
                    pass
                    
            elif ext == ".flac":
                try:
                    flac = FLAC(str(path))
                    title = clean_tag(flac.get("title"))
                    artist = clean_tag(flac.get("artist"))
                    album = clean_tag(flac.get("album"))
                    year = parse_year(clean_tag(flac.get("date") or flac.get("year")))
                    parent_genre = clean_tag(flac.get("parent_genre"))
                    raw_genre = clean_tag(flac.get("genre"))
                    if raw_genre and ";" in raw_genre:
                        parts = [p.strip() for p in raw_genre.split(";") if p.strip()]
                        if len(parts) >= 2 and not parent_genre:
                            parent_genre = parts[0]
                            genre = parts[1]
                        else:
                            genre = parts[0]
                    else:
                        genre = raw_genre
                    sub_genre = clean_tag(flac.get("subgenre") or flac.get("sub_genre"))
                    tempo = clean_tag(flac.get("tempo") or flac.get("pace"))
                    if not tempo and flac.get("bpm"):
                        tempo = f"~{clean_tag(flac.get('bpm'))} BPM"
                    if flac.pictures:
                        has_cover = 1
                except Exception:
                    pass
                    
            elif ext in [".m4a", ".mp4"]:
                try:
                    mp4 = MP4(str(path))
                    title = clean_tag(mp4.get("\xa9nam"))
                    artist = clean_tag(mp4.get("\xa9ART"))
                    album = clean_tag(mp4.get("\xa9alb"))
                    year = parse_year(clean_tag(mp4.get("\xa9day")))
                    raw_genre = clean_tag(mp4.get("\xa9gen"))
                    if raw_genre and ";" in raw_genre:
                        parts = [p.strip() for p in raw_genre.split(";") if p.strip()]
                        if len(parts) >= 2:
                            parent_genre = parts[0]
                            genre = parts[1]
                        else:
                            genre = parts[0]
                    else:
                        genre = raw_genre
                        
                    # Read custom iTunes parent genre and subgenre
                    if "----:com.apple.iTunes:PARENT_GENRE" in mp4:
                        raw = mp4["----:com.apple.iTunes:PARENT_GENRE"]
                        if raw:
                            val = raw[0].decode("utf-8", errors="ignore") if isinstance(raw[0], (bytes, bytearray)) else str(raw[0])
                            parent_genre = clean_tag(val)
                    if "----:com.apple.iTunes:SUBGENRE" in mp4:
                        raw = mp4["----:com.apple.iTunes:SUBGENRE"]
                        if raw:
                            val = raw[0].decode("utf-8", errors="ignore") if isinstance(raw[0], (bytes, bytearray)) else str(raw[0])
                            sub_genre = clean_tag(val)
                            
                    if "----:com.apple.iTunes:TEMPO" in mp4:
                        tempo = clean_tag(mp4["----:com.apple.iTunes:TEMPO"])
                    elif "tmpo" in mp4 and mp4["tmpo"]:
                        tempo = f"~{mp4['tmpo'][0]} BPM"
                    if "covr" in mp4 and mp4["covr"]:
                        has_cover = 1
                except Exception:
                    pass
    except Exception as e:
        print(f"Error reading metadata for {path.name}: {e}")
        
    # If title or artist missing, fallback to filename pattern
    if not title or not artist:
        fb_artist, fb_title = parse_filename_fallback(path.name)
        if not title:
            title = fb_title
        if not artist:
            artist = fb_artist
            
    decade = compute_decade(year)
    
    # Format tags list based on tags actually in file (do not fabricate parent tag; let Gemini decide!)
    from services.taxonomy import format_track_tags
    tags_list = format_track_tags(parent_genre, genre, sub_genre, decade)
        
    # Initial status:
    # If the file already has a parent_genre tag saved, mark 'saved'.
    # Otherwise mark 'unprocessed' so user knows it needs Gemini AI analysis!
    status = "saved" if parent_genre else "unprocessed"
    
    return {
        "file_path": str(path.resolve()),
        "file_name": path.name,
        "file_size": file_size,
        "duration": duration,
        "title": title or path.stem,
        "artist": artist or "Unknown Artist",
        "album": album or "",
        "release_year": year,
        "decade": decade,
        "parent_genre": parent_genre,
        "genre": genre,
        "sub_genre": sub_genre,
        "tags": tags_list,
        "status": status,
        "has_cover": has_cover
    }

def scan_directory(directory_path: str) -> List[Dict[str, Any]]:
    p = Path(directory_path)
    if not p.exists() or not p.is_dir():
        return []
        
    results = []
    for item in p.rglob("*"):
        if item.is_file() and item.suffix.lower() in SUPPORTED_EXTENSIONS:
            track = read_audio_file(str(item))
            if track:
                results.append(track)
    return results

def extract_cover_bytes(file_path: str) -> Optional[tuple[bytes, str]]:
    """
    Extracts raw album art bytes and mime type for in-browser display.
    """
    path = Path(file_path)
    if not path.exists():
        return None
        
    ext = path.suffix.lower()
    try:
        if ext == ".mp3":
            id3 = ID3(str(path))
            for k, v in id3.items():
                if k.startswith("APIC"):
                    return v.data, v.mime
        elif ext == ".flac":
            flac = FLAC(str(path))
            if flac.pictures:
                pic = flac.pictures[0]
                return pic.data, pic.mime
        elif ext in [".m4a", ".mp4"]:
            mp4 = MP4(str(path))
            if "covr" in mp4 and mp4["covr"]:
                data = bytes(mp4["covr"][0])
                # Check format
                mime = "image/png" if data.startswith(b"\x89PNG") else "image/jpeg"
                return data, mime
    except Exception as e:
        print(f"Error extracting cover from {path.name}: {e}")
        
    return None
