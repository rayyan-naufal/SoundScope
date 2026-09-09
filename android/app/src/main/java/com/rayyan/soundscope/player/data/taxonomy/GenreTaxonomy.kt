package com.rayyan.soundscope.player.data.taxonomy

/**
 * SoundScope canonical 14 parent genres and heuristic taxonomy resolution.
 * Automatically classifies audio files into hierarchical tiers:
 * Parent Genre -> Genre -> Subgenre
 */
object GenreTaxonomy {

    val CANONICAL_PARENT_GENRES = listOf(
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
        "Blues"
    )

    private val PARENT_GENRES_LOOKUP = mapOf(
        "edm" to "EDM",
        "dance" to "EDM",
        "electronic dance music" to "EDM",
        "techno" to "EDM",
        "house" to "EDM",
        "trance" to "EDM",
        "pop" to "Pop",
        "rock" to "Rock",
        "metal" to "Metal",
        "hip-hop" to "Hip Hop",
        "hip hop" to "Hip Hop",
        "hiphop" to "Hip Hop",
        "rap" to "Hip Hop",
        "r&b" to "R&B",
        "rnb" to "R&B",
        "r and b" to "R&B",
        "rhythm and blues" to "R&B",
        "electronic" to "Electronic",
        "electronica" to "Electronic",
        "synthwave" to "Electronic",
        "ambient" to "Electronic",
        "latin" to "Latin",
        "country" to "Country",
        "jazz" to "Jazz",
        "classical" to "Classical",
        "folk" to "Folk",
        "reggae" to "Reggae",
        "blues" to "Blues"
    )

    private val GENRE_TO_PARENT_MAP = mapOf(
        // EDM
        "progressive house" to "EDM",
        "electro house" to "EDM",
        "deep house" to "EDM",
        "tech house" to "EDM",
        "future house" to "EDM",
        "acid techno" to "EDM",
        "peak time techno" to "EDM",
        "drum and bass" to "EDM",
        "dnb" to "EDM",
        "dubstep" to "EDM",
        "hardstyle" to "EDM",
        "psytrance" to "EDM",
        "trap (edm)" to "EDM",

        // Rock
        "alternative rock" to "Rock",
        "indie rock" to "Rock",
        "grunge" to "Rock",
        "classic rock" to "Rock",
        "punk rock" to "Rock",
        "hard rock" to "Rock",
        "psychedelic rock" to "Rock",
        "shoegaze" to "Rock",
        "post-rock" to "Rock",

        // Metal
        "heavy metal" to "Metal",
        "thrash metal" to "Metal",
        "death metal" to "Metal",
        "black metal" to "Metal",
        "metalcore" to "Metal",
        "nu metal" to "Metal",
        "prog metal" to "Metal",

        // Hip Hop
        "boom bap" to "Hip Hop",
        "trap" to "Hip Hop",
        "drill" to "Hip Hop",
        "lo-fi hip hop" to "Hip Hop",
        "conscious hip hop" to "Hip Hop",
        "cloud rap" to "Hip Hop",

        // Pop
        "synthpop" to "Pop",
        "dance pop" to "Pop",
        "indie pop" to "Pop",
        "k-pop" to "Pop",
        "j-pop" to "Pop",
        "hyperpop" to "Pop",

        // R&B
        "contemporary r&b" to "R&B",
        "soul" to "R&B",
        "neo soul" to "R&B",
        "funk" to "R&B",
        "motown" to "R&B",

        // Jazz
        "bebop" to "Jazz",
        "smooth jazz" to "Jazz",
        "fusion" to "Jazz",
        "cool jazz" to "Jazz",

        // Classical
        "baroque" to "Classical",
        "romantic" to "Classical",
        "orchestral" to "Classical",
        "soundtrack" to "Classical"
    )

    private val ID3V1_GENRES = arrayOf(
        "Blues", "Classic Rock", "Country", "Dance", "Disco", "Funk", "Grunge", "Hip-Hop",
        "Jazz", "Metal", "New Age", "Oldies", "Other", "Pop", "R&B", "Rap", "Reggae",
        "Rock", "Techno", "Industrial", "Alternative", "Ska", "Death Metal", "Pranks",
        "Soundtrack", "Euro-Techno", "Ambient", "Trip-Hop", "Vocal", "Jazz+Funk", "Fusion",
        "Trance", "Classical", "Instrumental", "Acid", "House", "Game", "Sound Clip",
        "Gospel", "Noise", "Alternative Rock", "Bass", "Soul", "Punk", "Space", "Meditative",
        "Instrumental Pop", "Instrumental Rock", "Ethnic", "Gothic", "Darkwave",
        "Techno-Industrial", "Electronic", "Pop-Folk", "Eurodance", "Dream", "Southern Rock",
        "Comedy", "Cult", "Gangsta", "Top 40", "Christian Rap", "Pop/Funk", "Jungle",
        "Native American", "Cabaret", "New Wave", "Psychadelic", "Rave", "Showtunes", "Trailer",
        "Lo-Fi", "Tribal", "Acid Punk", "Acid Jazz", "Polka", "Retro", "Musical", "Rock & Roll",
        "Hard Rock"
    )

    fun cleanGenre(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        val trimmed = raw.trim()
        // Check for numeric ID3 genre like "(17)" or "17"
        val numericMatch = Regex("^\\(?(\\d+)\\)?$").find(trimmed)
        if (numericMatch != null) {
            val idx = numericMatch.groupValues[1].toIntOrNull()
            if (idx != null && idx in ID3V1_GENRES.indices) {
                return ID3V1_GENRES[idx]
            }
        }
        return trimmed
    }

    /**
     * Resolves Parent Genre, Core Genre, and Subgenre from a raw genre string.
     * Supports composite strings like "Rock; Alternative Rock; Grunge".
     */
    fun resolveHierarchy(rawGenre: String?): Triple<String?, String?, String?> {
        val cleaned = cleanGenre(rawGenre) ?: return Triple(null, null, null)

        // Check if string contains multiple components separated by ;, /, or |
        if (cleaned.contains(";") || cleaned.contains("/") || cleaned.contains("|")) {
            val parts = cleaned.split(Regex("[;/|]")).map { it.trim() }.filter { it.isNotEmpty() }
            if (parts.size >= 3) {
                val p = resolveParentGenre(parts[0]) ?: parts[0]
                return Triple(p, parts[1], parts[2])
            } else if (parts.size == 2) {
                val p = resolveParentGenre(parts[0]) ?: resolveParentGenre(parts[1]) ?: parts[0]
                return Triple(p, parts[1], null)
            }
        }

        val parent = resolveParentGenre(cleaned)
        return Triple(parent, cleaned, null)
    }

    fun resolveParentGenre(rawGenre: String?): String? {
        val cleaned = cleanGenre(rawGenre) ?: return null
        val lower = cleaned.lowercase()

        // 1. Direct canonical lookup
        PARENT_GENRES_LOOKUP[lower]?.let { return it }

        // 2. Curated genre mapping
        GENRE_TO_PARENT_MAP[lower]?.let { return it }

        // 3. Keyword heuristic patterns
        return when {
            Regex("\\b(house|techno|trance|dnb|bass|dubstep|edm|dance)\\b").containsMatchIn(lower) -> "EDM"
            Regex("\\b(metal|metalcore|deathcore|grindcore)\\b").containsMatchIn(lower) -> "Metal"
            Regex("\\b(rock|grunge|punk|indie|shoegaze|emo)\\b").containsMatchIn(lower) -> "Rock"
            Regex("\\b(rap|hip[\\s-]?hop|drill|trap|boom bap)\\b").containsMatchIn(lower) -> "Hip Hop"
            Regex("\\b(rnb|r&b|soul|funk|motown)\\b").containsMatchIn(lower) -> "R&B"
            Regex("\\b(synth|electronic|synthwave|ambient|electronica)\\b").containsMatchIn(lower) -> "Electronic"
            Regex("\\b(jazz|bebop|fusion|blues)\\b").containsMatchIn(lower) -> "Jazz"
            Regex("\\b(classical|orchestra|symphony|baroque|soundtrack)\\b").containsMatchIn(lower) -> "Classical"
            Regex("\\b(pop|k-pop|j-pop|hyperpop)\\b").containsMatchIn(lower) -> "Pop"
            Regex("\\b(latin|reggaeton|salsa|bachata)\\b").containsMatchIn(lower) -> "Latin"
            Regex("\\b(folk|acoustic|bluegrass)\\b").containsMatchIn(lower) -> "Folk"
            Regex("\\b(country|americana)\\b").containsMatchIn(lower) -> "Country"
            Regex("\\b(reggae|dub|dancehall|ska)\\b").containsMatchIn(lower) -> "Reggae"
            else -> null
        }
    }

    fun computeDecade(year: Int?): String? {
        if (year == null || year < 1900 || year > 2099) return null
        val decadeStart = (year / 10) * 10
        return "${decadeStart}s"
    }

    /**
     * Exact tempo matching matching static/app.js matchTempo
     */
    fun matchTempo(trackTempo: String?, targetTempo: String): Boolean {
        if (trackTempo.isNullOrBlank()) return false
        val lower = trackTempo.lowercase()
        return when (targetTempo) {
            "Very Fast" -> lower.contains("very fast")
            "Fast" -> lower.contains("fast") && !lower.contains("very fast")
            "Mid-tempo" -> lower.contains("mid")
            "Slow" -> lower.contains("slow")
            else -> false
        }
    }

    fun bpmToTempo(bpm: Double): String {
        return when {
            bpm < 90.0 -> "Slow (~${bpm.toInt()} BPM)"
            bpm < 120.0 -> "Mid-tempo (~${bpm.toInt()} BPM)"
            bpm < 145.0 -> "Fast (~${bpm.toInt()} BPM)"
            else -> "Very Fast (~${bpm.toInt()} BPM)"
        }
    }
}
