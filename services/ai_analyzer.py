import os
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional, List
import google.generativeai as genai
from config import load_settings, MODEL_CASCADE
from services.taxonomy import resolve_genre_hierarchy, format_track_tags

class RateLimitError(RuntimeError):
    """Raised when Gemini API quota or requests-per-minute (15 RPM) rate limit is exhausted."""
    def __init__(self, message: str = "Gemini API rate limit reached. Please wait before retrying.", retry_after: int = 15, is_daily_limit: bool = False):
        super().__init__(message)
        self.retry_after = retry_after
        self.is_daily_limit = is_daily_limit

EXHAUSTED_DAILY_MODELS = set()
_LAST_CONFIGURED_API_KEY = ""

def is_rate_limit_error(e: Exception) -> bool:
    err_str = str(e).lower()
    return any(k in err_str for k in ["429", "resourceexhausted", "quota", "rate limit", "ratelimit"])

def is_daily_quota_error(e: Exception) -> bool:
    err_str = str(e).lower()
    return any(k in err_str for k in [
        "generaterequestsperday",
        "perdayperprojectpermodel",
        "limit: 500",
        "free_tier_requests",
        "daily quota"
    ])

def configure_gemini() -> List[str]:
    global _LAST_CONFIGURED_API_KEY
    settings = load_settings()
    api_key = settings.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("Gemini API Key is not set. Please click 🔑 API Key in the top navigation or Settings (⚙️) to provide your key.")
    if api_key != _LAST_CONFIGURED_API_KEY:
        genai.configure(api_key=api_key)
        _LAST_CONFIGURED_API_KEY = api_key
        EXHAUSTED_DAILY_MODELS.clear()
    cascade = settings.get("model_cascade") or MODEL_CASCADE
    return cascade

def should_focus_tempo_only(track_info: Dict[str, Any]) -> bool:
   if not track_info:
       return False
   settings = load_settings()
   if not settings.get("analyze_tempo", True):
       return False
   hierarchy_present = any((track_info.get(field) or "").strip() for field in ["parent_genre", "genre", "sub_genre"])
   tempo_missing = not bool((track_info.get("tempo") or "").strip())
   return hierarchy_present and tempo_missing


def finalize_tempo_only_result(track_info: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
   existing_parent = track_info.get("parent_genre") or data.get("parent_genre")
   existing_genre = track_info.get("genre") or data.get("genre")
   existing_sub = track_info.get("sub_genre") or data.get("sub_genre")
   existing_decade = track_info.get("decade") or data.get("decade")
   final_tags = data.get("tags") or track_info.get("tags") or []
   p, g, s = resolve_genre_hierarchy(existing_parent, existing_genre, existing_sub)
   merged = {
       "title": data.get("title") or track_info.get("title"),
       "artist": data.get("artist") or track_info.get("artist"),
       "release_year": data.get("release_year") if data.get("release_year") is not None else track_info.get("release_year"),
       "decade": existing_decade,
       "parent_genre": p,
       "genre": g,
       "sub_genre": s,
       "tempo": data.get("tempo") or track_info.get("tempo"),
       "tags": format_track_tags(p, g, s, existing_decade, final_tags),
       "notes": data.get("notes") or "",
       "confidence": data.get("confidence") or "medium",
   }
   if "used_model" in data:
       merged["used_model"] = data["used_model"]
   return merged


def get_system_instruction(include_tempo: bool = True, focus_tempo_only: bool = False) -> str:
   tempo_instruction = (
       "10. tempo: The tempo/pace of the track. MUST be one of: 'Slow', 'Mid-tempo', 'Fast', 'Very Fast'. "
       "Optionally include estimated BPM if recognized (e.g. 'Slow (~75 BPM)', 'Mid-tempo (~108 BPM)', 'Fast (~128 BPM)', 'Very Fast (~150+ BPM)').\n"
       if include_tempo else ""
   )
   if focus_tempo_only:
       return f"""You are a music metadata quality assistant. Preserve the existing genre hierarchy exactly as provided and do NOT reclassify parent_genre, genre, or sub_genre.

Your task is only to determine the track tempo/pace for a song that already has a valid genre hierarchy.

Rules:
1. Keep parent_genre, genre, and sub_genre unchanged from the provided values.
2. Only update the tempo field.
3. If tempo is uncertain, choose the closest valid value: Slow, Mid-tempo, Fast, or Very Fast.
4. notes should be brief and mention that the hierarchy was preserved while tempo was refreshed.
{tempo_instruction}"""
   return f"""You are an expert musicologist and audio archivist. Your job is to classify music tracks into an accurate, structured genre hierarchy and identify their original release year and decade.
 
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
{tempo_instruction}"""
 
def analyze_track_metadata(track_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyzes track metadata using the highest available Gemini model first (e.g. gemini-3.1-flash-lite),
    gracefully cascading down to lower models if quota is exhausted.
    Omit tempo analysis if disabled by user settings to conserve tokens/quota.
    """
    model_cascade = configure_gemini()
    settings = load_settings()
    include_tempo = settings.get("analyze_tempo", True)
    focus_tempo_only = should_focus_tempo_only(track_info)

    title = track_info.get("title") or ""
    artist = track_info.get("artist") or ""
    album = track_info.get("album") or ""
    filename = track_info.get("file_name") or ""
    existing_genre = track_info.get("genre") or ""
    existing_year = track_info.get("release_year") or ""
    existing_hierarchy = {
        "parent_genre": track_info.get("parent_genre") or "",
        "genre": track_info.get("genre") or "",
        "sub_genre": track_info.get("sub_genre") or "",
    }
    
    tempo_field_schema = ',\n  "tempo": "Fast (~128 BPM)"' if include_tempo else ''

    if focus_tempo_only:
        prompt = f"""Refresh tempo only for this track while preserving the existing genre hierarchy.
- Filename: "{filename}"
- Artist: "{artist}"
- Title: "{title}"
- Album: "{album}"
- Existing hierarchy: {json.dumps(existing_hierarchy, ensure_ascii=False)}
- Existing Year hint: "{existing_year}"

Return strictly a JSON object with only the tempo/pace fields needed for this update:
{{
  "tempo": "Fast (~128 BPM)",
  "notes": "Tempo refreshed while preserving the existing genre hierarchy.",
  "confidence": "medium"
}}
"""
    else:
        prompt = f"""Analyze this track:
- Filename: "{filename}"
- Artist: "{artist}"
- Title: "{title}"
- Album: "{album}"
- Existing Genre hint: "{existing_genre}"
- Existing Year hint: "{existing_year}"
 
Return strictly a JSON object conforming to this schema (parent_genre is strictly mandatory):
{{
  "title": "Clean track title",
  "artist": "Clean artist name",
  "release_year": 2021,
  "decade": "2020s",
  "parent_genre": "EDM",
  "genre": "Techno",
  "sub_genre": "Acid Techno"{tempo_field_schema},
  "tags": ["2020s", "EDM", "Techno", "Acid Techno", "Peak Time"],
  "notes": "Released in 2021 by Maddix; combines acid basslines with peak-time techno.",
  "confidence": "high"
}}
"""
    # Filter out models already known to have exhausted daily quota
    active_cascade = [m for m in model_cascade if m not in EXHAUSTED_DAILY_MODELS]
    if not active_cascade:
        active_cascade = model_cascade

    last_error = None
    attempted_models = []
    has_rate_limit = False
    has_daily_limit = False
    system_instruction = get_system_instruction(include_tempo=include_tempo, focus_tempo_only=focus_tempo_only)

    for idx, model_name in enumerate(active_cascade):
        attempted_models.append(model_name)
        try:
            print(f"[{track_info.get('file_name', '')}] Attempting AI analysis (tempo={include_tempo}) with model: {model_name}...")
            model = genai.GenerativeModel(
                model_name,
                system_instruction=system_instruction,
                generation_config={"response_mime_type": "application/json"}
            )
            
            # Use request timeout of 20 seconds
            response = model.generate_content(prompt, request_options={"timeout": 20})
            data = json.loads(response.text)
            
            # Record which model actually processed this track
            data["used_model"] = model_name
            if idx > 0 or model_name != model_cascade[0]:
                fallback_note = f"[Model: {model_name} (Fell back from {model_cascade[0]} due to quota/rate limit)] "
                data["notes"] = fallback_note + (data.get("notes") or "")
            else:
                data["notes"] = f"[Model: {model_name}] " + (data.get("notes") or "")
                
            # Calculate decade if missing or format is off
            if "release_year" in data and data["release_year"]:
                try:
                    yr = int(data["release_year"])
                    data["release_year"] = yr
                    data["decade"] = f"{(yr // 10) * 10}s"
                except (ValueError, TypeError):
                    pass

            if focus_tempo_only:
                merged = finalize_tempo_only_result(track_info, data)
                print(f"[{track_info.get('file_name', '')}] Successfully refreshed tempo only using {model_name}.")
                return merged

            # Strict hierarchy resolution: ensure parent_genre is NEVER missing or invalid
            p, g, s = resolve_genre_hierarchy(data.get("parent_genre"), data.get("genre"), data.get("sub_genre"))
            data["parent_genre"] = p
            data["genre"] = g
            data["sub_genre"] = s
            data["tags"] = format_track_tags(p, g, s, data.get("decade"), data.get("tags"))
                    
            print(f"[{track_info.get('file_name', '')}] Successfully analyzed using {model_name} ({p} -> {g})!")
            return data
            
        except Exception as e:
            last_error = e
            if is_daily_quota_error(e):
                has_daily_limit = True
                EXHAUSTED_DAILY_MODELS.add(model_name)
                print(f"[Model Cascade] Daily quota reached for {model_name}. Added to daily-exhausted list. Falling back to next model...")
            elif is_rate_limit_error(e):
                has_rate_limit = True
            err_msg = str(e)
            print(f"Model {model_name} failed: {type(e).__name__} ({err_msg[:90]}). Falling back to next model...")
            continue

    # If all models in the cascade failed
    if has_daily_limit or all(m in EXHAUSTED_DAILY_MODELS for m in model_cascade):
        raise RateLimitError(
            f"Gemini daily free-tier quota exceeded across models ({', '.join(attempted_models)}). "
            f"Last error: {last_error}",
            retry_after=0,
            is_daily_limit=True
        )
    if has_rate_limit:
        raise RateLimitError(
            f"Gemini free-tier rate limit (15 RPM) exceeded across models ({', '.join(attempted_models)}). "
            f"Last error: {last_error}",
            retry_after=15,
            is_daily_limit=False
        )
    raise RuntimeError(
        f"All Gemini models ({', '.join(attempted_models)}) failed. "
        f"Last error: {last_error}. You can change or update your Gemini API key in the top right (🔑/⚙️)."
    )

def extract_audio_sample(audio_path: str, duration_sec: int = 15, start_sec: int = 30) -> Optional[str]:
    """
    Extracts a short snippet of the song using ffmpeg for Gemini multimodal audio analysis.
    """
    ffmpeg_path = shutil.which("ffmpeg") or "ffmpeg"
    temp_dir = tempfile.gettempdir()
    output_path = os.path.join(temp_dir, f"sample_{Path(audio_path).stem[:20]}_{start_sec}.mp3")
    
    cmd = [
        ffmpeg_path,
        "-y",
        "-ss", str(start_sec),
        "-i", audio_path,
        "-t", str(duration_sec),
        "-ac", "2",
        "-b:a", "128k",
        output_path
    ]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20)
        if res.returncode == 0 and os.path.exists(output_path):
            return output_path
    except Exception as e:
        print(f"Error extracting audio snippet: {e}")
    return None

def analyze_track_audio(track_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Multimodal audio analysis: Extracts a 15-second snippet and uploads to Gemini,
    with model cascade fallback if the primary model quota is exhausted.
    """
    model_cascade = configure_gemini()
    settings = load_settings()
    include_tempo = settings.get("analyze_tempo", True)
    file_path = track_info["file_path"]
    
    sample_file = extract_audio_sample(file_path, duration_sec=15, start_sec=30)
    if not sample_file:
        return analyze_track_metadata(track_info)
        
    uploaded_file = None
    try:
        uploaded_file = genai.upload_file(sample_file, mime_type="audio/mp3")
        
        tempo_prompt_line = "8. tempo (MUST be 'Slow', 'Mid-tempo', 'Fast', or 'Very Fast' with estimated BPM if known)\n" if include_tempo else ""
        focus_tempo_only = should_focus_tempo_only(track_info)
        if focus_tempo_only:
            prompt = f"""
Listen to this audio clip and refresh only the tempo/pace while preserving the existing genre hierarchy.
Metadata context:
- Filename: "{track_info.get('file_name', '')}"
- Artist: "{track_info.get('artist', '')}"
- Title: "{track_info.get('title', '')}"
- Existing Hierarchy: {json.dumps({"parent_genre": track_info.get("parent_genre") or "", "genre": track_info.get("genre") or "", "sub_genre": track_info.get("sub_genre") or ""}, ensure_ascii=False)}

Return strictly a JSON object containing only:
{{
  "tempo": "Fast (~128 BPM)",
  "notes": "Tempo refreshed while preserving the existing genre hierarchy.",
  "confidence": "medium"
}}
"""
        else:
            prompt = f"""
Listen to this audio clip and analyze the musical composition (rhythm, instruments, production, vocal style, tempo).
Metadata context:
- Filename: "{track_info.get('file_name', '')}"
- Artist: "{track_info.get('artist', '')}"
- Title: "{track_info.get('title', '')}"
 
Determine:
1. Canonical Track Title and Artist
2. Release Year and Decade
3. parent_genre (Must be one of: EDM, Pop, Rock, Metal, Hip Hop, R&B, Electronic, Latin, Country, Jazz, Classical, Folk, Reggae, Blues)
4. genre (Core genre, e.g. Techno, Nu Metal, House, Synth-Pop, Drill)
5. sub_genre (Specific subgenre, e.g. Acid Techno, Heavy Bass, Nu-Disco)
6. tags (Array of strings)
7. notes (Sound acoustic analysis observations)
{tempo_prompt_line}
Return strictly a JSON object conforming to the defined schema.
"""
        # Filter out models already known to have exhausted daily quota
        active_cascade = [m for m in model_cascade if m not in EXHAUSTED_DAILY_MODELS]
        if not active_cascade:
            active_cascade = model_cascade

        last_error = None
        attempted_models = []
        has_rate_limit = False
        has_daily_limit = False
        system_instruction = get_system_instruction(include_tempo=include_tempo, focus_tempo_only=focus_tempo_only)
        for idx, model_name in enumerate(active_cascade):
            attempted_models.append(model_name)
            try:
                print(f"[{track_info.get('file_name', '')}] Attempting Audio Clip analysis (tempo={include_tempo}) with model: {model_name}...")
                model = genai.GenerativeModel(
                    model_name,
                    system_instruction=system_instruction,
                    generation_config={"response_mime_type": "application/json"}
                )
                response = model.generate_content([uploaded_file, prompt], request_options={"timeout": 20})
                data = json.loads(response.text)
                
                data["used_model"] = model_name
                if idx > 0 or model_name != model_cascade[0]:
                    data["notes"] = f"[Model: {model_name} (Clip Fallback)] " + (data.get("notes") or "")
                else:
                    data["notes"] = f"[Model: {model_name} (Clip)] " + (data.get("notes") or "")
                    
                if "release_year" in data and data["release_year"]:
                    try:
                        yr = int(data["release_year"])
                        data["release_year"] = yr
                        data["decade"] = f"{(yr // 10) * 10}s"
                    except Exception:
                        pass

                if focus_tempo_only:
                    merged = finalize_tempo_only_result(track_info, data)
                    print(f"[{track_info.get('file_name', '')}] Audio tempo refresh succeeded using {model_name}.")
                    return merged

                # Strict hierarchy resolution
                p, g, s = resolve_genre_hierarchy(data.get("parent_genre"), data.get("genre"), data.get("sub_genre"))
                data["parent_genre"] = p
                data["genre"] = g
                data["sub_genre"] = s
                data["tags"] = format_track_tags(p, g, s, data.get("decade"), data.get("tags"))
                        
                print(f"[{track_info.get('file_name', '')}] Audio analysis succeeded using {model_name} ({p} -> {g})!")
                return data
            except Exception as e:
                last_error = e
                if is_daily_quota_error(e):
                    has_daily_limit = True
                    EXHAUSTED_DAILY_MODELS.add(model_name)
                    print(f"[Model Cascade] Daily audio quota reached for {model_name}. Added to daily-exhausted list. Falling back to next model...")
                elif is_rate_limit_error(e):
                    has_rate_limit = True
                print(f"Audio model {model_name} failed: {e}. Trying fallback...")
                continue
                
        if has_daily_limit or all(m in EXHAUSTED_DAILY_MODELS for m in model_cascade):
            raise RateLimitError(
                f"Gemini audio analysis daily quota reached across models ({', '.join(attempted_models)}). Last error: {last_error}",
                retry_after=0,
                is_daily_limit=True
            )
        if has_rate_limit:
            raise RateLimitError(
                f"Gemini audio analysis rate limit (15 RPM) reached across models ({', '.join(attempted_models)}). Last error: {last_error}",
                retry_after=15,
                is_daily_limit=False
            )
        raise RuntimeError(f"Audio analysis failed on all models ({', '.join(attempted_models)}). Last error: {last_error}")
        
    finally:
        if sample_file and os.path.exists(sample_file):
            try:
                os.remove(sample_file)
            except Exception:
                pass
        if uploaded_file:
            try:
                genai.delete_file(uploaded_file.name)
            except Exception:
                pass
