import os
import sys
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Request, Response, BackgroundTasks
from fastapi.res vponses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import load_settings, save_settings, BASE_DIR
from services.database import (
    init_db, upsert_scanned_track, get_track, update_track_ai_tags,
    mark_track_saved, query_tracks, get_taxonomies, get_stats, clear_all_tracks,
    backfill_missing_parent_genres, toggle_track_like,
    create_playlist, get_playlists, get_playlist, update_playlist,
    delete_playlist, add_tracks_to_playlist, remove_track_from_playlist,
    export_playlist_m3u
)
from services.tag_reader import scan_directory, extract_cover_bytes
from services.tag_writer import write_tags_to_file
from services.ai_analyzer import analyze_track_metadata, analyze_track_audio, RateLimitError
from services.taxonomy import resolve_genre_hierarchy
from services.audio_streamer import range_requests_response

app = FastAPI(title="SoundScope", description="Local AI-powered hierarchical music tagger & explorer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
init_db()

# In-memory cover art cache: track_id -> (bytes, mime)
_cover_cache: Dict[int, tuple[bytes, str]] = {}
_MAX_COVER_CACHE = 2000

def get_cached_cover(track_id: int, file_path: str) -> Optional[tuple[bytes, str]]:
    if track_id in _cover_cache:
        return _cover_cache[track_id]
    
    cover_data = extract_cover_bytes(file_path)
    if cover_data:
        if len(_cover_cache) >= _MAX_COVER_CACHE:
            # Evict oldest 20% of entries when cache reaches limit
            keys_to_del = list(_cover_cache.keys())[:int(_MAX_COVER_CACHE * 0.2)]
            for k in keys_to_del:
                _cover_cache.pop(k, None)
        _cover_cache[track_id] = cover_data
    return cover_data

def invalidate_cover_cache(track_id: int):
    _cover_cache.pop(track_id, None)

# --- Request Models ---
class ScanRequest(BaseModel):
    directory: str
    clear_previous: Optional[bool] = False

class SettingsUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    default_music_dir: Optional[str] = None
    tag_separator: Optional[str] = None
    write_custom_frames: Optional[bool] = None
    write_standard_genre: Optional[bool] = None
    analyze_tempo: Optional[bool] = None
    language: Optional[str] = None
    model_cascade: Optional[List[str]] = None

class TagUpdate(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    release_year: Optional[int] = None
    decade: Optional[str] = None
    parent_genre: Optional[str] = None
    genre: Optional[str] = None
    sub_genre: Optional[str] = None
    tempo: Optional[str] = None
    tags: Optional[List[str]] = None
    ai_notes: Optional[str] = None

class BatchActionRequest(BaseModel):
    track_ids: List[int]

class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class PlaylistAddTracks(BaseModel):
    track_ids: List[int]

class LikeRequest(BaseModel):
    is_liked: Optional[int] = None

class BatchLikeRequest(BaseModel):
    track_ids: List[int]
    is_liked: int

# --- API Endpoints ---

@app.get("/api/settings")
def get_current_settings():
    settings = load_settings()
    masked = dict(settings)
    key = masked.get("gemini_api_key", "")
    masked["gemini_api_key_masked"] = f"{key[:6]}...{key[-4:]}" if len(key) > 10 else ("Configured" if key else "")
    masked["has_api_key"] = bool(key)
    return masked

@app.post("/api/settings")
def update_settings(update: SettingsUpdate):
    filtered = {k: v for k, v in update.dict().items() if v is not None}
    saved = save_settings(filtered)
    # Also update environment if key changed
    if "gemini_api_key" in filtered and filtered["gemini_api_key"]:
        os.environ["GEMINI_API_KEY"] = filtered["gemini_api_key"]
    return {"status": "ok", "settings": saved}

@app.get("/api/stats")
def fetch_stats():
    return get_stats()

@app.get("/api/taxonomies")
def fetch_taxonomies():
    return get_taxonomies()

@app.post("/api/clear")
def clear_library():
    """Clears all tracks from the local catalog database."""
    clear_all_tracks()
    _cover_cache.clear()
    return {
        "status": "success",
        "message": "Library cleared",
        "stats": get_stats(),
        "taxonomies": get_taxonomies()
    }

@app.post("/api/browse-folder")
def browse_folder():
    """Opens a native Windows folder browser dialog using tkinter."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        
        settings = load_settings()
        initial_dir = settings.get("default_music_dir", "")
        if not os.path.exists(initial_dir):
            initial_dir = os.path.expanduser("~/Music")
            
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        folder = filedialog.askdirectory(
            initialdir=initial_dir,
            title="Pilih Folder Musik (SoundScope)"
        )
        root.destroy()
        
        if folder:
            norm_folder = os.path.normpath(folder)
            return {"status": "ok", "directory": norm_folder}
        return {"status": "cancelled", "directory": None}
    except Exception as e:
        print(f"Error opening folder picker: {e}")
        return {"status": "error", "error": str(e), "directory": None}

@app.post("/api/scan")
def scan_music_folder(req: ScanRequest):
    folder_path = req.directory.strip()
    p = Path(folder_path)
    if not p.exists() or not p.is_dir():
        raise HTTPException(status_code=400, detail=f"Directory does not exist: {folder_path}")
        
    if req.clear_previous:
        clear_all_tracks()
        _cover_cache.clear()
        
    tracks = scan_directory(folder_path)
    count = 0
    for t in tracks:
        upsert_scanned_track(t)
        count += 1
        
    backfill_missing_parent_genres()
    save_settings({"default_music_dir": folder_path})
    return {
        "status": "success",
        "scanned_count": count,
        "stats": get_stats(),
        "taxonomies": get_taxonomies()
    }

@app.get("/api/taxonomies")
def get_taxonomies_endpoint():
    return get_taxonomies()

@app.get("/api/tracks")
def list_tracks(
    search: Optional[str] = None,
    decade: Optional[str] = None,
    parent_genre: Optional[str] = None,
    genre: Optional[str] = None,
    sub_genre: Optional[str] = None,
    tempo: Optional[str] = None,
    is_liked: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = "id",
    sort_order: str = "ASC"
):
    return query_tracks(
        search=search,
        decade=decade,
        parent_genre=parent_genre,
        genre=genre,
        sub_genre=sub_genre,
        tempo=tempo,
        is_liked=is_liked,
        status=status,
        sort_by=sort_by,
        sort_order=sort_order
    )

@app.post("/api/track/{track_id}/like")
def toggle_like_endpoint(track_id: int, req: Optional[LikeRequest] = None):
    t = get_track(track_id)
    if not t:
        raise HTTPException(status_code=404, detail="Track not found")
    desired = req.is_liked if req else None
    new_val = toggle_track_like(track_id, desired)
    return {"status": "ok", "track_id": track_id, "is_liked": new_val}

@app.post("/api/tracks/batch-like")
def batch_like_endpoint(req: BatchLikeRequest):
    count = 0
    for tid in req.track_ids:
        toggle_track_like(tid, req.is_liked)
        count += 1
    return {"status": "ok", "count": count, "is_liked": req.is_liked}

@app.get("/api/track/{track_id}")
def get_single_track(track_id: int):
    t = get_track(track_id)
    if not t:
        raise HTTPException(status_code=404, detail="Track not found")
    return t

@app.put("/api/track/{track_id}")
def update_single_track(track_id: int, data: TagUpdate):
    t = get_track(track_id)
    if not t:
        raise HTTPException(status_code=404, detail="Track not found")
        
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if "release_year" in update_data and update_data["release_year"]:
        yr = update_data["release_year"]
        update_data["decade"] = f"{(yr // 10) * 10}s"
        
    update_track_ai_tags(track_id, update_data, status="analyzed")
    return {"status": "ok", "track": get_track(track_id)}

@app.post("/api/backfill-parents")
def backfill_parents_endpoint():
    """Backfills missing parent genres for any tracks with known genres/subgenres."""
    count = backfill_missing_parent_genres()
    return {
        "status": "success",
        "backfilled_count": count,
        "stats": get_stats(),
        "taxonomies": get_taxonomies()
    }

@app.post("/api/analyze/{track_id}")
def analyze_single_track(track_id: int):
    t = get_track(track_id)
    if not t:
        raise HTTPException(status_code=404, detail="Track not found")
        
    try:
        ai_res = analyze_track_metadata(t)
        update_track_ai_tags(track_id, ai_res, status="analyzed")
        return {"status": "success", "ai_data": ai_res, "track": get_track(track_id)}
    except RateLimitError as rle:
        return JSONResponse(
            status_code=429,
            content={
                "detail": str(rle),
                "is_daily_limit": getattr(rle, "is_daily_limit", False),
                "retry_after": rle.retry_after
            },
            headers={"Retry-After": str(rle.retry_after)}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-audio/{track_id}")
def analyze_single_track_sound(track_id: int):
    t = get_track(track_id)
    if not t:
        raise HTTPException(status_code=404, detail="Track not found")
        
    try:
        ai_res = analyze_track_audio(t)
        update_track_ai_tags(track_id, ai_res, status="analyzed")
        return {"status": "success", "ai_data": ai_res, "track": get_track(track_id)}
    except RateLimitError as rle:
        return JSONResponse(
            status_code=429,
            content={
                "detail": str(rle),
                "is_daily_limit": getattr(rle, "is_daily_limit", False),
                "retry_after": rle.retry_after
            },
            headers={"Retry-After": str(rle.retry_after)}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/batch-analyze")
def batch_analyze_tracks(req: BatchActionRequest):
    results = []
    errors = []
    
    for tid in req.track_ids:
        t = get_track(tid)
        if not t:
            continue
        try:
            ai_res = analyze_track_metadata(t)
            update_track_ai_tags(tid, ai_res, status="analyzed")
            results.append({"id": tid, "title": t["title"], "success": True})
        except Exception as e:
            errors.append({"id": tid, "title": t["title"], "error": str(e)})
            
    return {
        "status": "completed",
        "processed": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
        "taxonomies": get_taxonomies()
    }

@app.post("/api/apply-tags/{track_id}")
def apply_tags_to_file(track_id: int):
    t = get_track(track_id)
    if not t:
        raise HTTPException(status_code=404, detail="Track not found")
        
    try:
        write_tags_to_file(t["file_path"], t)
        mark_track_saved(track_id)
        invalidate_cover_cache(track_id)
        return {"status": "success", "message": f"Tags saved to {t['file_name']}", "track": get_track(track_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed writing tags: {e}")

@app.post("/api/batch-apply-tags")
def batch_apply_tags(req: BatchActionRequest):
    success_count = 0
    errors = []
    
    for tid in req.track_ids:
        t = get_track(tid)
        if not t:
            continue
        try:
            # Ensure parent genre hierarchy is resolved before saving
            p, g, s = resolve_genre_hierarchy(t.get("parent_genre"), t.get("genre"), t.get("sub_genre"))
            if p and p != t.get("parent_genre"):
                update_track_ai_tags(tid, {"parent_genre": p, "genre": g, "sub_genre": s}, status=t.get("status", "saved"))
                t = get_track(tid)
                
            write_tags_to_file(t["file_path"], t)
            mark_track_saved(tid)
            invalidate_cover_cache(tid)
            success_count += 1
        except Exception as e:
            errors.append({"id": tid, "title": t["title"], "error": str(e)})
            
    return {
        "status": "completed",
        "saved_count": success_count,
        "failed_count": len(errors),
        "errors": errors,
        "taxonomies": get_taxonomies()
    }

@app.get("/api/cover/{track_id}")
def get_track_cover(track_id: int):
    t = get_track(track_id)
    if not t:
        raise HTTPException(status_code=404, detail="Track not found")
        
    cover_data = get_cached_cover(track_id, t["file_path"])
    if not cover_data:
        raise HTTPException(status_code=404, detail="No cover art found")
        
    data, mime = cover_data
    return Response(
        content=data,
        media_type=mime,
        headers={
            "Cache-Control": "public, max-age=604800, immutable",
            "ETag": f'"{track_id}"'
        }
    )

@app.get("/api/stream/{track_id}")
def stream_track(track_id: int, request: Request):
    t = get_track(track_id)
    if not t:
        raise HTTPException(status_code=404, detail="Track not found")
        
    ext = Path(t["file_path"]).suffix.lower()
    content_types = {
        ".mp3": "audio/mpeg",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".wav": "audio/wav",
    }
    ct = content_types.get(ext, "audio/mpeg")
    return range_requests_response(request, t["file_path"], content_type=ct)

# --- Playlist Endpoints ---

@app.get("/api/playlists")
def list_playlists():
    return get_playlists()

@app.post("/api/playlists")
def create_new_playlist(data: PlaylistCreate):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Playlist name cannot be empty")
    pid = create_playlist(name, data.description or "")
    return {"status": "ok", "id": pid, "playlist": get_playlist(pid)}

@app.get("/api/playlists/{playlist_id}")
def get_single_playlist(playlist_id: int):
    p = get_playlist(playlist_id)
    if not p:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return p

@app.put("/api/playlists/{playlist_id}")
def update_single_playlist(playlist_id: int, data: PlaylistUpdate):
    p = get_playlist(playlist_id)
    if not p:
        raise HTTPException(status_code=404, detail="Playlist not found")
    update_playlist(playlist_id, data.name or p["name"], data.description if data.description is not None else p["description"])
    return {"status": "ok", "playlist": get_playlist(playlist_id)}

@app.delete("/api/playlists/{playlist_id}")
def delete_single_playlist(playlist_id: int):
    p = get_playlist(playlist_id)
    if not p:
        raise HTTPException(status_code=404, detail="Playlist not found")
    delete_playlist(playlist_id)
    return {"status": "ok", "message": "Playlist deleted"}

@app.post("/api/playlists/{playlist_id}/tracks")
def add_tracks_to_single_playlist(playlist_id: int, data: PlaylistAddTracks):
    p = get_playlist(playlist_id)
    if not p:
        raise HTTPException(status_code=404, detail="Playlist not found")
    added = add_tracks_to_playlist(playlist_id, data.track_ids)
    return {"status": "ok", "added_count": added, "playlist": get_playlist(playlist_id)}

@app.delete("/api/playlists/{playlist_id}/tracks/{track_id}")
def remove_track_from_single_playlist(playlist_id: int, track_id: int):
    p = get_playlist(playlist_id)
    if not p:
        raise HTTPException(status_code=404, detail="Playlist not found")
    remove_track_from_playlist(playlist_id, track_id)
    return {"status": "ok", "playlist": get_playlist(playlist_id)}

@app.get("/api/playlists/{playlist_id}/export-m3u")
def export_playlist_as_m3u(playlist_id: int):
    p = get_playlist(playlist_id)
    if not p:
        raise HTTPException(status_code=404, detail="Playlist not found")
    content = export_playlist_m3u(playlist_id)
    filename = f"{p['name'].replace(' ', '_')}.m3u"
    return Response(
        content=content,
        media_type="audio/x-mpegurl",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# Mount static files
static_dir = BASE_DIR / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    settings = load_settings()
    port = settings.get("port", 8765)
    print(f"Starting SoundScope on http://127.0.0.1:{port}")
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)
