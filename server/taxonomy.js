const PARENT_GENRES = [
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
];

const PARENT_GENRES_LOOKUP = {};
PARENT_GENRES.forEach(p => {
  PARENT_GENRES_LOOKUP[p.toLowerCase()] = p;
});
Object.assign(PARENT_GENRES_LOOKUP, {
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
});

const GENRE_TO_PARENT = {
  // Rock & its subgenres
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

  // Metal
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

  // Pop
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

  // EDM / Dance
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

  // Hip Hop & Rap
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

  // R&B / Soul / Funk
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

  // Electronic / Ambient
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

  // Latin
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

  // Country
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

  // Jazz
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

  // Classical
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

  // Folk
  "folk": "Folk",
  "traditional folk": "Folk",
  "contemporary folk": "Folk",
  "indie folk": "Folk",
  "singer-songwriter": "Folk",
  "singer/songwriter": "Folk",
  "celtic": "Folk",
  "acoustic": "Folk",

  // Reggae
  "reggae": "Reggae",
  "roots reggae": "Reggae",
  "dancehall": "Reggae",
  "dub": "Reggae",
  "ska": "Reggae",
  "rocksteady": "Reggae",
  "ragga": "Reggae",

  // Blues
  "blues": "Blues",
  "delta blues": "Blues",
  "chicago blues": "Blues",
  "electric blues": "Blues",
  "acoustic blues": "Blues",
  "contemporary blues": "Blues",

  // Additional micro-genres
  "bboy": "Hip Hop",
  "freestyle": "EDM",
  "lilith": "Rock",
  "ccm": "Pop",
  "girl group": "Pop",
  "hawaiian": "Folk"
};

const KEYWORD_PATTERNS = [
  [/\bmetal\b|metalcore|deathcore|grindcore|djent/i, "Metal"],
  [/\brock\b|punk|grunge|beatlesque|emo\b|shoegaze/i, "Rock"],
  [/\bhouse\b|\btechno\b|\btrance\b|\bedm\b|eurodance|hardstyle|dubstep|\bdnb\b|drum and bass|drum & bass/i, "EDM"],
  [/\bhip[\s\-]hop\b|\brap\b|\btrap\b|\bdrill\b|boom bap|crunk|grime/i, "Hip Hop"],
  [/\br&b\b|\brnb\b|\bsoul\b|\bfunk\b|afrobeats|motown/i, "R&B"],
  [/\bpop\b|boy band|k-pop|j-pop/i, "Pop"],
  [/\bjazz\b|bebop|swing\b/i, "Jazz"],
  [/\bcountry\b|bluegrass|honky tonk|americana/i, "Country"],
  [/\bblues\b/i, "Blues"],
  [/\bclassical\b|orchestral|symphon|baroque|opera/i, "Classical"],
  [/\breggae\b|dancehall|\bdub\b|\bska\b/i, "Reggae"],
  [/\bfolk\b|acoustic|singer[\-\s]songwriter|celtic/i, "Folk"],
  [/\blatin\b|reggaeton|salsa|bachata|merengue|cumbia|bossa nova/i, "Latin"],
  [/\belectronic\b|ambient|synthwave|downtempo|vaporwave|industrial/i, "Electronic"],
];

function canonicalizeParentGenre(val) {
  if (!val) return null;
  const cleaned = String(val).trim();
  if (!cleaned) return null;
  return PARENT_GENRES_LOOKUP[cleaned.toLowerCase()] || null;
}

function inferParentFromGenre(genreStr) {
  if (!genreStr) return null;
  const g = String(genreStr).trim().toLowerCase();
  if (!g) return null;

  if (PARENT_GENRES_LOOKUP[g]) {
    return PARENT_GENRES_LOOKUP[g];
  }

  if (GENRE_TO_PARENT[g]) {
    return GENRE_TO_PARENT[g];
  }

  for (const [pattern, parent] of KEYWORD_PATTERNS) {
    if (pattern.test(g)) {
      return parent;
    }
  }

  return null;
}

function resolveGenreHierarchy(parentGenre, genre, subGenre) {
  const cleanParent = parentGenre ? String(parentGenre).trim() : null;
  let cleanGenre = genre ? String(genre).trim() : null;
  let cleanSub = subGenre ? String(subGenre).trim() : null;

  let finalParent = cleanParent;

  if (cleanParent) {
    const canonical = canonicalizeParentGenre(cleanParent);
    finalParent = canonical || cleanParent;
  } else {
    if (cleanGenre) {
      finalParent = inferParentFromGenre(cleanGenre);
    }
    if (!finalParent && cleanSub) {
      finalParent = inferParentFromGenre(cleanSub);
    }
  }

  if (!cleanGenre && cleanSub) {
    cleanGenre = cleanSub;
    cleanSub = null;
  }

  if (cleanGenre && cleanSub && cleanGenre.toLowerCase() === cleanSub.toLowerCase()) {
    cleanSub = null;
  }

  return [finalParent, cleanGenre, cleanSub];
}

function formatTrackTags(parentGenre, genre, subGenre, decade, extraTags = null) {
  const tags = [];
  if (decade && String(decade).trim()) {
    tags.push(String(decade).trim());
  }
  if (parentGenre && String(parentGenre).trim()) {
    const p = String(parentGenre).trim();
    if (!tags.includes(p)) tags.push(p);
  }
  if (genre && String(genre).trim()) {
    const g = String(genre).trim();
    if (!tags.includes(g)) tags.push(g);
  }
  if (subGenre && String(subGenre).trim()) {
    const s = String(subGenre).trim();
    if (!tags.includes(s)) tags.push(s);
  }

  if (Array.isArray(extraTags)) {
    extraTags.forEach(t => {
      if (t && typeof t === 'string') {
        const cleaned = t.trim();
        if (cleaned && !tags.includes(cleaned)) {
          tags.push(cleaned);
        }
      }
    });
  }

  return tags;
}

module.exports = {
  PARENT_GENRES,
  PARENT_GENRES_LOOKUP,
  GENRE_TO_PARENT,
  canonicalizeParentGenre,
  inferParentFromGenre,
  resolveGenreHierarchy,
  formatTrackTags
};
