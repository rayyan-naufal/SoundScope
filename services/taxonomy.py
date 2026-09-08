import re
from typing import Optional, Tuple, List, Dict

PARENT_GENRES: List[str] = [
    "EDM",
    "Pop",
    "Rock",
    "Metal",
    "Hip Hop",
    "R&B",
    "Electronic",
    "Latin",
    "Country",
    "Jazz",
    "Classical",
    "Folk",
    "Reggae",
    "Blues",
]

# Canonical lookup map (case-insensitive) for exact parent genre matching
PARENT_GENRES_LOOKUP: Dict[str, str] = {p.lower(): p for p in PARENT_GENRES}
PARENT_GENRES_LOOKUP.update({
    "hip-hop": "Hip Hop",
    "hiphop": "Hip Hop",
    "rap": "Hip Hop",
    "rnb": "R&B",
    "r & b": "R&B",
    "r and b": "R&B",
    "rhythm and blues": "R&B",
    "electronic dance music": "EDM",
    "dance": "EDM",
    "techno": "EDM",
    "house": "EDM",
})

# Curated direct genre to parent genre mapping
GENRE_TO_PARENT: Dict[str, str] = {
    # Rock & its subgenres
    "rock": "Rock",
    "alternative rock": "Rock",
    "alt rock": "Rock",
    "indie rock": "Rock",
    "hard rock": "Rock",
    "classic rock": "Rock",
    "album rock": "Rock",
    "soft rock": "Rock",
    "pop rock": "Rock",
    "punk": "Rock",
    "punk rock": "Rock",
    "post-punk": "Rock",
    "grunge": "Rock",
    "post-grunge": "Rock",
    "britpop": "Rock",
    "beatlesque": "Rock",
    "psychedelic rock": "Rock",
    "progressive rock": "Rock",
    "prog rock": "Rock",
    "garage rock": "Rock",
    "glam rock": "Rock",
    "new wave": "Rock",
    "surf rock": "Rock",
    "southern rock": "Rock",
    "folk rock": "Rock",
    "blues rock": "Rock",
    "roots rock": "Rock",
    "modern rock": "Rock",
    "emo": "Rock",
    "midwest emo": "Rock",
    "screamo": "Rock",
    "shoegaze": "Rock",
    "art rock": "Rock",
    "math rock": "Rock",
    "noise rock": "Rock",
    "gothic rock": "Rock",
    "goth rock": "Rock",
    "indie": "Rock",
    "rap rock": "Rock",

    # Metal
    "metal": "Metal",
    "heavy metal": "Metal",
    "thrash metal": "Metal",
    "death metal": "Metal",
    "black metal": "Metal",
    "power metal": "Metal",
    "doom metal": "Metal",
    "nu metal": "Metal",
    "nu-metal": "Metal",
    "alternative metal": "Metal",
    "alt metal": "Metal",
    "groove metal": "Metal",
    "metalcore": "Metal",
    "deathcore": "Metal",
    "grindcore": "Metal",
    "glam metal": "Metal",
    "hair metal": "Metal",
    "symphonic metal": "Metal",
    "folk metal": "Metal",
    "progressive metal": "Metal",
    "industrial metal": "Metal",
    "sludge metal": "Metal",
    "speed metal": "Metal",
    "djent": "Metal",

    # Pop
    "pop": "Pop",
    "dance pop": "Pop",
    "dance-pop": "Pop",
    "synth-pop": "Pop",
    "synthpop": "Pop",
    "electropop": "Pop",
    "electro-pop": "Pop",
    "teen pop": "Pop",
    "boy band": "Pop",
    "k-pop": "Pop",
    "kpop": "Pop",
    "j-pop": "Pop",
    "jpop": "Pop",
    "indie pop": "Pop",
    "dream pop": "Pop",
    "chamber pop": "Pop",
    "art pop": "Pop",
    "bubblegum pop": "Pop",
    "sunshine pop": "Pop",
    "new wave pop": "Pop",
    "hyperpop": "Pop",
    "acoustic pop": "Pop",

    # EDM / Dance
    "edm": "EDM",
    "house": "EDM",
    "deep house": "EDM",
    "tech house": "EDM",
    "electro house": "EDM",
    "progressive house": "EDM",
    "future house": "EDM",
    "bass house": "EDM",
    "diva house": "EDM",
    "tropical house": "EDM",
    "acid house": "EDM",
    "techno": "EDM",
    "acid techno": "EDM",
    "peak time techno": "EDM",
    "melodic techno": "EDM",
    "minimal techno": "EDM",
    "hard techno": "EDM",
    "industrial techno": "EDM",
    "trance": "EDM",
    "psytrance": "EDM",
    "progressive trance": "EDM",
    "uplifting trance": "EDM",
    "eurodance": "EDM",
    "euro-dance": "EDM",
    "hardstyle": "EDM",
    "hardcore": "EDM",
    "dubstep": "EDM",
    "brostep": "EDM",
    "melodic dubstep": "EDM",
    "drum and bass": "EDM",
    "drum & bass": "EDM",
    "dnb": "EDM",
    "liquid dnb": "EDM",
    "jungle": "EDM",
    "garage": "EDM",
    "uk garage": "EDM",
    "future bass": "EDM",
    "trap edm": "EDM",
    "club": "EDM",
    "dance": "EDM",

    # Hip Hop & Rap
    "hip hop": "Hip Hop",
    "hip-hop": "Hip Hop",
    "hiphop": "Hip Hop",
    "rap": "Hip Hop",
    "east coast hip hop": "Hip Hop",
    "west coast hip hop": "Hip Hop",
    "southern hip hop": "Hip Hop",
    "detroit hip hop": "Hip Hop",
    "midwest hip hop": "Hip Hop",
    "gangsta rap": "Hip Hop",
    "trap": "Hip Hop",
    "drill": "Hip Hop",
    "uk drill": "Hip Hop",
    "boom bap": "Hip Hop",
    "conscious hip hop": "Hip Hop",
    "hardcore hip hop": "Hip Hop",
    "cloud rap": "Hip Hop",
    "emo rap": "Hip Hop",
    "lo-fi hip hop": "Hip Hop",
    "jazz rap": "Hip Hop",
    "crunk": "Hip Hop",
    "grime": "Hip Hop",

    # R&B / Soul / Funk
    "r&b": "R&B",
    "contemporary r&b": "R&B",
    "neo-soul": "R&B",
    "neo soul": "R&B",
    "soul": "R&B",
    "classic soul": "R&B",
    "motown": "R&B",
    "funk": "R&B",
    "p-funk": "R&B",
    "disco": "R&B",
    "nu-disco": "R&B",
    "quiet storm": "R&B",
    "doo-wop": "R&B",
    "british soul": "R&B",
    "blue-eyed soul": "R&B",
    "afrobeats": "R&B",
    "afropop": "R&B",

    # Electronic / Ambient
    "electronic": "Electronic",
    "electronica": "Electronic",
    "ambient": "Electronic",
    "downtempo": "Electronic",
    "trip hop": "Electronic",
    "trip-hop": "Electronic",
    "chillout": "Electronic",
    "idm": "Electronic",
    "synthwave": "Electronic",
    "chillwave": "Electronic",
    "vaporwave": "Electronic",
    "glitch": "Electronic",
    "industrial": "Electronic",
    "ebm": "Electronic",
    "new age": "Electronic",

    # Latin
    "latin": "Latin",
    "reggaeton": "Latin",
    "salsa": "Latin",
    "bachata": "Latin",
    "merengue": "Latin",
    "cumbia": "Latin",
    "latin pop": "Latin",
    "bossa nova": "Latin",
    "samba": "Latin",
    "tango": "Latin",
    "latin rock": "Latin",
    "mariachi": "Latin",
    "norteño": "Latin",
    "flamenco": "Latin",

    # Country
    "country": "Country",
    "contemporary country": "Country",
    "country pop": "Country",
    "country rock": "Country",
    "outlaw country": "Country",
    "bluegrass": "Country",
    "honky tonk": "Country",
    "americana": "Country",
    "traditional country": "Country",
    "alt-country": "Country",

    # Jazz
    "jazz": "Jazz",
    "smooth jazz": "Jazz",
    "bebop": "Jazz",
    "hard bop": "Jazz",
    "cool jazz": "Jazz",
    "fusion": "Jazz",
    "jazz fusion": "Jazz",
    "swing": "Jazz",
    "big band": "Jazz",
    "free jazz": "Jazz",
    "modal jazz": "Jazz",
    "acid jazz": "Jazz",
    "latin jazz": "Jazz",

    # Classical
    "classical": "Classical",
    "orchestral": "Classical",
    "symphony": "Classical",
    "baroque": "Classical",
    "romantic classical": "Classical",
    "opera": "Classical",
    "chamber music": "Classical",
    "film score": "Classical",
    "soundtrack": "Classical",
    "choral": "Classical",
    "minimalism": "Classical",

    # Folk
    "folk": "Folk",
    "traditional folk": "Folk",
    "contemporary folk": "Folk",
    "indie folk": "Folk",
    "singer-songwriter": "Folk",
    "singer/songwriter": "Folk",
    "celtic": "Folk",
    "acoustic": "Folk",

    # Reggae
    "reggae": "Reggae",
    "roots reggae": "Reggae",
    "dancehall": "Reggae",
    "dub": "Reggae",
    "ska": "Reggae",
    "rocksteady": "Reggae",
    "ragga": "Reggae",

    # Blues
    "blues": "Blues",
    "delta blues": "Blues",
    "chicago blues": "Blues",
    "electric blues": "Blues",
    "acoustic blues": "Blues",
    # Additional micro-genres
    "bboy": "Hip Hop",
    "freestyle": "EDM",
    "lilith": "Rock",
    "ccm": "Pop",
    "girl group": "Pop",
    "hawaiian": "Folk",
    "contemporary blues": "Blues",
}

# Heuristic patterns for guessing parent genre from keywords
KEYWORD_PATTERNS = [
    (r"\bmetal\b|metalcore|deathcore|grindcore|djent", "Metal"),
    (r"\brock\b|punk|grunge|beatlesque|emo\b|shoegaze", "Rock"),
    (r"\bhouse\b|\btechno\b|\btrance\b|\bedm\b|eurodance|hardstyle|dubstep|\bdnb\b|drum and bass|drum & bass", "EDM"),
    (r"\bhip[\s\-]hop\b|\brap\b|\btrap\b|\bdrill\b|boom bap|crunk|grime", "Hip Hop"),
    (r"\br&b\b|\brnb\b|\bsoul\b|\bfunk\b|afrobeats|motown", "R&B"),
    (r"\bpop\b|boy band|k-pop|j-pop", "Pop"),
    (r"\bjazz\b|bebop|swing\b", "Jazz"),
    (r"\bcountry\b|bluegrass|honky tonk|americana", "Country"),
    (r"\bblues\b", "Blues"),
    (r"\bclassical\b|orchestral|symphon|baroque|opera", "Classical"),
    (r"\breggae\b|dancehall|\bdub\b|\bska\b", "Reggae"),
    (r"\bfolk\b|acoustic|singer[\-\s]songwriter|celtic", "Folk"),
    (r"\blatin\b|reggaeton|salsa|bachata|merengue|cumbia|bossa nova", "Latin"),
    (r"\belectronic\b|ambient|synthwave|downtempo|vaporwave|industrial", "Electronic"),
]

def canonicalize_parent_genre(val: Optional[str]) -> Optional[str]:
    """Returns canonical parent genre from string or None."""
    if not val:
        return None
    cleaned = str(val).strip()
    if not cleaned:
        return None
    return PARENT_GENRES_LOOKUP.get(cleaned.lower(), None)

def infer_parent_from_genre(genre_str: Optional[str]) -> Optional[str]:
    """
    Infers a standard parent genre from a genre string using exact dictionary
    mapping followed by keyword regex matching.
    """
    if not genre_str:
        return None
    g = genre_str.strip().lower()
    if not g:
        return None

    # Check direct parent match
    if g in PARENT_GENRES_LOOKUP:
        return PARENT_GENRES_LOOKUP[g]

    # Check exact dictionary map
    if g in GENRE_TO_PARENT:
        return GENRE_TO_PARENT[g]

    # Keyword regex heuristics
    for pattern, parent in KEYWORD_PATTERNS:
        if re.search(pattern, g, re.IGNORECASE):
            return parent

    return None

def resolve_genre_hierarchy(
    parent_genre: Optional[str],
    genre: Optional[str],
    sub_genre: Optional[str]
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Resolves genre hierarchy.
    IMPORTANT: The primary decision comes from Gemini AI or user edit.
    Taxonomy inference is strictly the LAST OPTION / safety net when
    parent_genre is completely empty.
    """
    clean_parent = str(parent_genre).strip() if parent_genre else None
    clean_genre = str(genre).strip() if genre else None
    clean_sub = str(sub_genre).strip() if sub_genre else None

    final_parent = clean_parent

    # 1. If parent_genre was provided (e.g. by Gemini AI), respect Gemini's decision!
    # Normalize canonical casing if recognized (e.g. "rock" -> "Rock"), but keep Gemini's choice.
    if clean_parent:
        canonical = canonicalize_parent_genre(clean_parent)
        final_parent = canonical if canonical else clean_parent
    else:
        # 2. LAST RESORT FALLBACK: Only if parent_genre is completely empty,
        # fallback to inferring from genre or sub_genre.
        if clean_genre:
            final_parent = infer_parent_from_genre(clean_genre)
        if not final_parent and clean_sub:
            final_parent = infer_parent_from_genre(clean_sub)

    # 3. Clean up genre / sub_genre
    if not clean_genre and clean_sub:
        clean_genre = clean_sub
        clean_sub = None

    if clean_genre and clean_sub and clean_genre.lower() == clean_sub.lower():
        clean_sub = None

    return final_parent, clean_genre, clean_sub

def format_track_tags(
    parent_genre: Optional[str],
    genre: Optional[str],
    sub_genre: Optional[str],
    decade: Optional[str],
    extra_tags: Optional[List[str]] = None
) -> List[str]:
    """
    Builds a clean ordered list of tags with parent_genre GUARANTEED as foremost.
    Hierarchy: [decade, parent_genre, genre, sub_genre, ...extra_tags]
    """
    tags = []
    if decade and str(decade).strip():
        tags.append(str(decade).strip())
    if parent_genre and str(parent_genre).strip():
        p = str(parent_genre).strip()
        if p not in tags:
            tags.append(p)
    if genre and str(genre).strip():
        g = str(genre).strip()
        if g not in tags:
            tags.append(g)
    if sub_genre and str(sub_genre).strip():
        s = str(sub_genre).strip()
        if s not in tags:
            tags.append(s)

    if extra_tags:
        for t in extra_tags:
            if t and isinstance(t, str):
                cleaned = t.strip()
                if cleaned and cleaned not in tags:
                    tags.append(cleaned)

    return tags
