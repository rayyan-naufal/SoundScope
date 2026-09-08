import sqlite3
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any
from config import DATA_DIR
from services.taxonomy import infer_parent_from_genre

DB_PATH = DATA_DIR / "music_catalog.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
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
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_file_path ON tracks(file_path)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_decade ON tracks(decade)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_parent_genre ON tracks(parent_genre)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_status ON tracks(status)")
    
    # Auto-migration for tempo column if table already existed
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN tempo TEXT")
    except Exception:
        pass

    # Auto-migration for is_liked column
    try:
        cursor.execute("ALTER TABLE tracks ADD COLUMN is_liked INTEGER DEFAULT 0")
    except Exception:
        pass
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_is_liked ON tracks(is_liked)")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            cover_url TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS playlist_tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL,
            track_id INTEGER NOT NULL,
            position INTEGER DEFAULT 0,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
            UNIQUE(playlist_id, track_id)
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_playlist_tracks ON playlist_tracks(playlist_id, position)")
        
    conn.commit()
    conn.close()

def backfill_missing_parent_genres() -> int:
    """
    Optional utility: Finds any tracks in the database that have missing or empty parent_genre
    and resolves parent_genre from existing genre/sub_genre/tags.
    Returns count of updated tracks.
    """
    from services.taxonomy import resolve_genre_hierarchy, format_track_tags
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, release_year, decade, parent_genre, genre, sub_genre, tags FROM tracks WHERE parent_genre IS NULL OR parent_genre = ''")
    rows = cursor.fetchall()
    updated_count = 0
    now = datetime.utcnow().isoformat()
    
    for r in rows:
        tid = r["id"]
        p, g, s = resolve_genre_hierarchy(r["parent_genre"], r["genre"], r["sub_genre"])
        if p:
            current_tags = json.loads(r["tags"] or "[]")
            clean_tags = format_track_tags(p, g, s, r["decade"], current_tags)
            cursor.execute("""
                UPDATE tracks SET
                    parent_genre = ?,
                    genre = ?,
                    sub_genre = ?,
                    tags = ?,
                    updated_at = ?
                WHERE id = ?
            """, (p, g, s, json.dumps(clean_tags), now, tid))
            updated_count += 1
            
    conn.commit()
    conn.close()
    if updated_count > 0:
        print(f"[Database] Backfilled missing parent genres for {updated_count} tracks.")
    return updated_count

def upsert_scanned_track(track_dict: dict):
    """
    Inserts a newly scanned track or updates existing basic file/tag metadata
    while preserving AI analyzed suggestions if already present.
    Does NOT fabricate parent_genre so Gemini AI remains the decider.
    """
    from services.taxonomy import format_track_tags
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if exists
    cursor.execute("SELECT id, status, release_year, decade, parent_genre, genre, sub_genre, tags, tempo FROM tracks WHERE file_path = ?", (track_dict["file_path"],))
    row = cursor.fetchone()
    
    now = datetime.utcnow().isoformat()
    if row:
        track_id = row["id"]
        status = row["status"]
        # If it's already analyzed or saved, keep the current AI tags unless empty
        year = row["release_year"] if row["release_year"] else track_dict.get("release_year")
        decade = row["decade"] if row["decade"] else track_dict.get("decade")
        parent_genre = row["parent_genre"] if row["parent_genre"] else track_dict.get("parent_genre")
        genre = row["genre"] if row["genre"] else track_dict.get("genre")
        sub_genre = row["sub_genre"] if row["sub_genre"] else track_dict.get("sub_genre")
        
        current_tags = json.loads(row["tags"]) if row["tags"] and row["tags"] != '[]' else track_dict.get("tags", [])
        tags = json.dumps(format_track_tags(parent_genre, genre, sub_genre, decade, current_tags))
        tempo = row["tempo"] if row["tempo"] else track_dict.get("tempo")
        
        cursor.execute("""
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
        """, (
            track_dict["file_name"],
            track_dict.get("file_size", 0),
            track_dict.get("duration", 0),
            track_dict.get("title"),
            track_dict.get("artist"),
            track_dict.get("album"),
            track_dict.get("has_cover", 0),
            year,
            decade,
            parent_genre,
            genre,
            sub_genre,
            tags,
            tempo,
            now,
            track_id
        ))
    else:
        parent_genre = track_dict.get("parent_genre")
        genre = track_dict.get("genre")
        sub_genre = track_dict.get("sub_genre")
        decade = track_dict.get("decade")
        tags_list = format_track_tags(parent_genre, genre, sub_genre, decade, track_dict.get("tags", []))
        
        cursor.execute("""
            INSERT INTO tracks (
                file_path, file_name, file_size, duration,
                title, artist, album, release_year, decade,
                parent_genre, genre, sub_genre, tags, tempo,
                status, has_cover, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            track_dict["file_path"],
            track_dict["file_name"],
            track_dict.get("file_size", 0),
            track_dict.get("duration", 0),
            track_dict.get("title"),
            track_dict.get("artist"),
            track_dict.get("album"),
            track_dict.get("release_year"),
            decade,
            parent_genre,
            genre,
            sub_genre,
            json.dumps(tags_list),
            track_dict.get("tempo"),
            track_dict.get("status", "unprocessed"),
            track_dict.get("has_cover", 0),
            now
        ))
        track_id = cursor.lastrowid
        
    conn.commit()
    conn.close()
    return track_id

def get_track(track_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tracks WHERE id = ?", (track_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        res = dict(row)
        res["tags"] = json.loads(res["tags"] or "[]")
        return res
    return None

def update_track_ai_tags(track_id: int, tags_data: dict, status: str = "analyzed"):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    tags_json = json.dumps(tags_data.get("tags", []))
    
    cursor.execute("""
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
    """, (
        tags_data.get("title"),
        tags_data.get("artist"),
        tags_data.get("release_year"),
        tags_data.get("decade"),
        tags_data.get("parent_genre"),
        tags_data.get("genre"),
        tags_data.get("sub_genre"),
        tags_json,
        tags_data.get("tempo"),
        status,
        tags_data.get("ai_notes", ""),
        now,
        track_id
    ))
    conn.commit()
    conn.close()

def mark_track_saved(track_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("UPDATE tracks SET status = 'saved', updated_at = ? WHERE id = ?", (now, track_id))
    conn.commit()
    conn.close()

def toggle_track_like(track_id: int, is_liked: Optional[int] = None) -> int:
    """Toggles or sets the is_liked status of a track. Returns new is_liked value (0 or 1)."""
    conn = get_connection()
    cursor = conn.cursor()
    if is_liked is None:
        cursor.execute("SELECT is_liked FROM tracks WHERE id = ?", (track_id,))
        row = cursor.fetchone()
        current = row[0] if row and row[0] is not None else 0
        new_val = 0 if current == 1 else 1
    else:
        new_val = 1 if is_liked else 0
    now = datetime.utcnow().isoformat()
    cursor.execute("UPDATE tracks SET is_liked = ?, updated_at = ? WHERE id = ?", (new_val, now, track_id))
    conn.commit()
    conn.close()
    return new_val

def query_tracks(search: str = None, decade: str = None, parent_genre: str = None, genre: str = None, sub_genre: str = None, tempo: str = None, is_liked: str = None, status: str = None, sort_by: str = "id", sort_order: str = "ASC"):
    conn = get_connection()
    cursor = conn.cursor()
    
    conditions = []
    params = []
    
    if search and search.strip():
        term = f"%{search.strip()}%"
        conditions.append("(title LIKE ? OR artist LIKE ? OR album LIKE ? OR file_name LIKE ? OR tags LIKE ? OR parent_genre LIKE ? OR genre LIKE ? OR sub_genre LIKE ?)")
        params.extend([term, term, term, term, term, term, term, term])
        
    if decade and decade != "All":
        conditions.append("decade = ?")
        params.append(decade)
        
    if parent_genre and parent_genre != "All":
        if parent_genre == "__missing__":
            conditions.append("(parent_genre IS NULL OR parent_genre = '')")
        else:
            conditions.append("parent_genre = ?")
            params.append(parent_genre)
        
    if genre and genre != "All":
        conditions.append("genre = ?")
        params.append(genre)
        
    if sub_genre and sub_genre != "All":
        conditions.append("sub_genre = ?")
        params.append(sub_genre)

    if tempo and tempo != "All":
        if tempo == "Slow":
            conditions.append("(tempo LIKE '%Slow%' OR tempo LIKE '%slow%')")
        elif tempo == "Mid-tempo":
            conditions.append("(tempo LIKE '%Mid-tempo%' OR tempo LIKE '%Mid tempo%' OR tempo LIKE '%Mid%')")
        elif tempo == "Fast":
            conditions.append("((tempo LIKE '%Fast%' OR tempo LIKE '%fast%') AND tempo NOT LIKE '%Very Fast%' AND tempo NOT LIKE '%very fast%')")
        elif tempo == "Very Fast":
            conditions.append("(tempo LIKE '%Very Fast%' OR tempo LIKE '%very fast%')")
        else:
            conditions.append("tempo LIKE ?")
            params.append(f"%{tempo}%")

    if is_liked is not None and is_liked != "" and is_liked != "All":
        if is_liked in ("1", "true", "True", True, 1):
            conditions.append("is_liked = 1")
        elif is_liked in ("0", "false", "False", False, 0):
            conditions.append("(is_liked IS NULL OR is_liked = 0)")
        
    if status and status != "All":
        conditions.append("status = ?")
        params.append(status)
        
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    
    allowed_sort = ["id", "title", "artist", "release_year", "decade", "parent_genre", "genre", "sub_genre", "tempo", "is_liked", "status"]
    if sort_by not in allowed_sort:
        sort_by = "id"
    sort_dir = "DESC" if sort_order.upper() == "DESC" else "ASC"
    
    # Consistent sorting: Empty/NULL values always sort LAST in ASC, FIRST in DESC
    text_sort_fields = ["title", "artist", "parent_genre", "genre", "sub_genre", "tempo", "status", "decade"]
    if sort_by in text_sort_fields:
        # CASE expression: 0 = has value, 1 = empty/null
        # In ASC: nulls_priority ASC puts filled values (0) first, empty (1) last
        # In DESC: nulls_priority DESC puts empty (1) first, filled (0) last — 
        #          but we want empty LAST in DESC too for the data column,
        #          so we always sort nulls_priority ASC to push empties to the end.
        nulls_clause = f"CASE WHEN ({sort_by} IS NULL OR {sort_by} = '') THEN 1 ELSE 0 END"
        order_clause = f"{nulls_clause} ASC, {sort_by} COLLATE NOCASE {sort_dir}, id ASC"
    else:
        order_clause = f"{sort_by} {sort_dir}, id ASC"
    
    query = f"SELECT * FROM tracks {where_clause} ORDER BY {order_clause}"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        item = dict(r)
        item["tags"] = json.loads(item["tags"] or "[]")
        results.append(item)
    return results

def get_taxonomies():
    """
    Returns distinct values and global catalog counts for filters: decades, parent_genres, genres, sub_genres, tempos.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT decade, COUNT(*) FROM tracks WHERE decade IS NOT NULL AND decade != '' GROUP BY decade ORDER BY decade DESC")
    decade_rows = cursor.fetchall()
    decades = [r[0] for r in decade_rows]
    decade_counts = {r[0]: r[1] for r in decade_rows}
    
    cursor.execute("SELECT parent_genre, COUNT(*) FROM tracks WHERE parent_genre IS NOT NULL AND parent_genre != '' GROUP BY parent_genre ORDER BY parent_genre ASC")
    parent_rows = cursor.fetchall()
    parent_genres = [r[0] for r in parent_rows]
    parent_genre_counts = {r[0]: r[1] for r in parent_rows}
    
    cursor.execute("SELECT COUNT(*) FROM tracks WHERE parent_genre IS NULL OR parent_genre = ''")
    missing_parent_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM tracks")
    total_tracks = cursor.fetchone()[0]
    
    cursor.execute("SELECT DISTINCT genre FROM tracks WHERE genre IS NOT NULL AND genre != '' ORDER BY genre ASC")
    genres = [r[0] for r in cursor.fetchall()]
    
    cursor.execute("SELECT DISTINCT sub_genre FROM tracks WHERE sub_genre IS NOT NULL AND sub_genre != '' ORDER BY sub_genre ASC")
    sub_genres = [r[0] for r in cursor.fetchall()]

    # Tempo / Pace counts
    cursor.execute("SELECT tempo FROM tracks WHERE tempo IS NOT NULL AND tempo != ''")
    tempo_rows = cursor.fetchall()
    tempo_counts = {"Slow": 0, "Mid-tempo": 0, "Fast": 0, "Very Fast": 0}
    for (t_val,) in tempo_rows:
        t_lower = t_val.lower()
        if "very fast" in t_lower:
            tempo_counts["Very Fast"] += 1
        elif "mid" in t_lower:
            tempo_counts["Mid-tempo"] += 1
        elif "slow" in t_lower:
            tempo_counts["Slow"] += 1
        elif "fast" in t_lower:
            tempo_counts["Fast"] += 1

    # Relational hierarchy mappings for dependent / cascading filters
    cursor.execute("""
        SELECT DISTINCT parent_genre, genre, sub_genre 
        FROM tracks 
        WHERE (parent_genre IS NOT NULL AND parent_genre != '') 
           OR (genre IS NOT NULL AND genre != '') 
           OR (sub_genre IS NOT NULL AND sub_genre != '')
    """)
    tax_rows = cursor.fetchall()

    parent_to_genres = {}
    parent_to_subgenres = {}
    genre_to_subgenres = {}

    for r in tax_rows:
        p = r[0]
        g = r[1]
        sg = r[2]

        if not p and g:
            inferred = infer_parent_from_genre(g)
            if inferred:
                p = inferred

        if p:
            if g:
                parent_to_genres.setdefault(p, set()).add(g)
            if sg:
                parent_to_subgenres.setdefault(p, set()).add(sg)
        if g and sg:
            genre_to_subgenres.setdefault(g, set()).add(sg)

    parent_to_genres_clean = {k: sorted(list(v), key=lambda x: x.lower()) for k, v in parent_to_genres.items()}
    parent_to_subgenres_clean = {k: sorted(list(v), key=lambda x: x.lower()) for k, v in parent_to_subgenres.items()}
    genre_to_subgenres_clean = {k: sorted(list(v), key=lambda x: x.lower()) for k, v in genre_to_subgenres.items()}
    
    cursor.execute("SELECT COUNT(*) FROM tracks WHERE is_liked = 1")
    liked_count = cursor.fetchone()[0]

    conn.close()
    return {
        "decades": decades,
        "decade_counts": decade_counts,
        "parent_genres": parent_genres,
        "parent_genre_counts": parent_genre_counts,
        "missing_parent_count": missing_parent_count,
        "total_tracks": total_tracks,
        "genres": genres,
        "sub_genres": sub_genres,
        "tempos": ["Slow", "Mid-tempo", "Fast", "Very Fast"],
        "tempo_counts": tempo_counts,
        "liked_count": liked_count,
        "parent_to_genres": parent_to_genres_clean,
        "parent_to_subgenres": parent_to_subgenres_clean,
        "genre_to_subgenres": genre_to_subgenres_clean
    }

def get_stats():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM tracks")
    total = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM tracks WHERE status = 'unprocessed'")
    unprocessed = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM tracks WHERE status = 'analyzed'")
    analyzed = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM tracks WHERE status = 'saved'")
    saved = cursor.fetchone()[0]
    
    conn.close()
    return {
        "total": total,
        "unprocessed": unprocessed,
        "analyzed": analyzed,
        "saved": saved
    }

def clear_all_tracks():
    """
    Clears all tracks from the catalog database.
    Does NOT touch audio files on disk.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tracks")
    try:
        cursor.execute("DELETE FROM sqlite_sequence WHERE name = 'tracks'")
    except Exception:
        pass
    conn.commit()
    conn.close()

# --- Playlists & Queue Operations ---

def create_playlist(name: str, description: str = ""):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("INSERT INTO playlists (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)",
                   (name.strip(), description.strip(), now, now))
    pid = cursor.lastrowid
    conn.commit()
    conn.close()
    return pid

def get_playlists():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
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
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_playlist(playlist_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM playlists WHERE id = ?", (playlist_id,))
    p_row = cursor.fetchone()
    if not p_row:
        conn.close()
        return None
    playlist = dict(p_row)

    cursor.execute("""
        SELECT t.*, pt.position, pt.added_at as playlist_added_at
        FROM playlist_tracks pt
        JOIN tracks t ON pt.track_id = t.id
        WHERE pt.playlist_id = ?
        ORDER BY pt.position ASC, pt.added_at ASC
    """, (playlist_id,))
    track_rows = cursor.fetchall()
    conn.close()

    tracks = []
    for r in track_rows:
        item = dict(r)
        item["tags"] = json.loads(item["tags"] or "[]")
        tracks.append(item)
    playlist["tracks"] = tracks
    playlist["track_count"] = len(tracks)
    return playlist

def update_playlist(playlist_id: int, name: str, description: str = ""):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("UPDATE playlists SET name = ?, description = ?, updated_at = ? WHERE id = ?",
                   (name.strip(), description.strip(), now, playlist_id))
    conn.commit()
    conn.close()
    return True

def delete_playlist(playlist_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM playlist_tracks WHERE playlist_id = ?", (playlist_id,))
    cursor.execute("DELETE FROM playlists WHERE id = ?", (playlist_id,))
    conn.commit()
    conn.close()
    return True

def add_tracks_to_playlist(playlist_id: int, track_ids: list):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    # Get current max position
    cursor.execute("SELECT COALESCE(MAX(position), 0) FROM playlist_tracks WHERE playlist_id = ?", (playlist_id,))
    max_pos = cursor.fetchone()[0]
    
    added_count = 0
    for tid in track_ids:
        try:
            max_pos += 1
            cursor.execute("""
                INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at)
                VALUES (?, ?, ?, ?)
            """, (playlist_id, tid, max_pos, now))
            if cursor.rowcount > 0:
                added_count += 1
        except Exception:
            pass
            
    cursor.execute("UPDATE playlists SET updated_at = ? WHERE id = ?", (now, playlist_id))
    conn.commit()
    conn.close()
    return added_count

def remove_track_from_playlist(playlist_id: int, track_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?", (playlist_id, track_id))
    now = datetime.utcnow().isoformat()
    cursor.execute("UPDATE playlists SET updated_at = ? WHERE id = ?", (now, playlist_id))
    conn.commit()
    conn.close()
    return True

def export_playlist_m3u(playlist_id: int) -> str:
    playlist = get_playlist(playlist_id)
    if not playlist:
        return ""
    lines = ["#EXTM3U", f"#PLAYLIST:{playlist['name']}"]
    for t in playlist.get("tracks", []):
        dur = int(t.get("duration") or 0)
        artist = t.get("artist") or "Unknown"
        title = t.get("title") or t.get("file_name")
        fp = t.get("file_path") or ""
        lines.append(f"#EXTINF:{dur},{artist} - {title}")
        lines.append(fp)
    return "\n".join(lines)


