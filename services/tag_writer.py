import os
import re
from pathlib import Path
from typing import Dict, Any, Optional
import mutagen
from mutagen.id3 import ID3, TIT2, TPE1, TALB, TDRC, TCON, TXXX, TBPM, ID3NoHeaderError
from mutagen.flac import FLAC
from mutagen.mp4 import MP4, MP4FreeForm
from config import load_settings

def build_combined_genre_string(parent_genre: Optional[str], genre: Optional[str], sub_genre: Optional[str], separator: str = "; ") -> str:
    components = []
    for g in [parent_genre, genre, sub_genre]:
        if g and g.strip():
            clean = g.strip()
            if clean not in components:
                components.append(clean)
    return separator.join(components)

def write_tags_to_file(file_path: str, tag_data: Dict[str, Any]) -> bool:
    """
    Writes hierarchical genre tags, release year, decade, and tempo/pace to the target audio file.
    Supports MP3 (ID3v2.3/4), FLAC, and MP4/M4A.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
        
    settings = load_settings()
    separator = settings.get("tag_separator", "; ")
    
    from services.taxonomy import resolve_genre_hierarchy
    parent_genre, genre, sub_genre = resolve_genre_hierarchy(
        tag_data.get("parent_genre"),
        tag_data.get("genre"),
        tag_data.get("sub_genre")
    )
    parent_genre = parent_genre or ""
    genre = genre or ""
    sub_genre = sub_genre or ""
    
    year = tag_data.get("release_year")
    year_str = str(year) if year else ""
    decade = tag_data.get("decade") or (f"{(year // 10) * 10}s" if year else "")
    tempo = tag_data.get("tempo") or ""
    
    bpm_val = None
    if tempo:
        bpm_match = re.search(r'\b(\d{2,3})\b', tempo)
        if bpm_match:
            bpm_val = bpm_match.group(1)
    
    combined_genre = build_combined_genre_string(parent_genre, genre, sub_genre, separator)
    ext = path.suffix.lower()
    
    if ext == ".mp3":
        try:
            try:
                id3 = ID3(str(path))
            except ID3NoHeaderError:
                id3 = ID3()
                
            # Update Title and Artist if provided
            if tag_data.get("title"):
                id3["TIT2"] = TIT2(encoding=3, text=str(tag_data["title"]))
            if tag_data.get("artist"):
                id3["TPE1"] = TPE1(encoding=3, text=str(tag_data["artist"]))
                
            # Year / Date
            if year_str:
                id3["TDRC"] = TDRC(encoding=3, text=year_str)
                
            # Standard Genre tag
            if combined_genre and settings.get("write_standard_genre", True):
                id3["TCON"] = TCON(encoding=3, text=combined_genre)
                
            # Standard BPM tag
            if bpm_val:
                try:
                    id3["TBPM"] = TBPM(encoding=3, text=str(bpm_val))
                except Exception:
                    pass
                    
            # Custom TXXX frames for advanced media players (MusicBee, Foobar2000, Mp3tag, Rekordbox)
            if settings.get("write_custom_frames", True):
                if parent_genre:
                    id3["TXXX:PARENT_GENRE"] = TXXX(encoding=3, desc="PARENT_GENRE", text=parent_genre)
                if genre:
                    id3["TXXX:GENRE"] = TXXX(encoding=3, desc="GENRE", text=genre)
                if sub_genre:
                    id3["TXXX:SUBGENRE"] = TXXX(encoding=3, desc="SUBGENRE", text=sub_genre)
                if decade:
                    id3["TXXX:DECADE"] = TXXX(encoding=3, desc="DECADE", text=decade)
                if tempo:
                    id3["TXXX:TEMPO"] = TXXX(encoding=3, desc="TEMPO", text=tempo)
                    id3["TXXX:PACE"] = TXXX(encoding=3, desc="PACE", text=tempo)
                    
            id3.save(str(path), v2_version=3)
            return True
        except Exception as e:
            print(f"Failed to write ID3 tags to {path.name}: {e}")
            raise e
            
    elif ext == ".flac":
        try:
            flac = FLAC(str(path))
            if tag_data.get("title"):
                flac["title"] = str(tag_data["title"])
            if tag_data.get("artist"):
                flac["artist"] = str(tag_data["artist"])
            if year_str:
                flac["date"] = year_str
                flac["year"] = year_str
            if combined_genre:
                flac["genre"] = combined_genre
            if parent_genre:
                flac["parent_genre"] = parent_genre
            if sub_genre:
                flac["subgenre"] = sub_genre
                flac["sub_genre"] = sub_genre
            if decade:
                flac["decade"] = decade
            if bpm_val:
                flac["bpm"] = str(bpm_val)
            if tempo:
                flac["tempo"] = tempo
            flac.save()
            return True
        except Exception as e:
            print(f"Failed to write FLAC tags to {path.name}: {e}")
            raise e
            
    elif ext in [".m4a", ".mp4"]:
        try:
            mp4 = MP4(str(path))
            if tag_data.get("title"):
                mp4["\xa9nam"] = str(tag_data["title"])
            if tag_data.get("artist"):
                mp4["\xa9ART"] = str(tag_data["artist"])
            if year_str:
                mp4["\xa9day"] = year_str
            if combined_genre:
                mp4["\xa9gen"] = combined_genre
            if parent_genre:
                mp4["----:com.apple.iTunes:PARENT_GENRE"] = MP4FreeForm(parent_genre.encode("utf-8"))
            if sub_genre:
                mp4["----:com.apple.iTunes:SUBGENRE"] = MP4FreeForm(sub_genre.encode("utf-8"))
            if decade:
                mp4["----:com.apple.iTunes:DECADE"] = MP4FreeForm(decade.encode("utf-8"))
            if bpm_val:
                try:
                    mp4["tmpo"] = [int(bpm_val)]
                except Exception:
                    pass
            if tempo:
                mp4["----:com.apple.iTunes:TEMPO"] = MP4FreeForm(tempo.encode("utf-8"))
            mp4.save()
            return True
        except Exception as e:
            print(f"Failed to write MP4 tags to {path.name}: {e}")
            raise e
            
    return False
