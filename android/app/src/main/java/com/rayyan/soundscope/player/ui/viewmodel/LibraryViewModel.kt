package com.rayyan.soundscope.player.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rayyan.soundscope.player.data.local.SoundScopeDatabase
import com.rayyan.soundscope.player.data.local.entity.TrackEntity
import com.rayyan.soundscope.player.data.repository.MusicRepository
import com.rayyan.soundscope.player.data.scanner.LocalAudioScanner
import com.rayyan.soundscope.player.data.scanner.ScanProgress
import com.rayyan.soundscope.player.data.taxonomy.GenreTaxonomy
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class PlayerFilterOptions(
    val availableDecades: List<String> = emptyList(),
    val decadeCounts: Map<String, Int> = emptyMap(),
    val availableParents: List<String> = emptyList(),
    val parentCounts: Map<String, Int> = emptyMap(),
    val availableGenres: List<String> = emptyList(),
    val genreCounts: Map<String, Int> = emptyMap(),
    val availableSubGenres: List<String> = emptyList(),
    val subGenreCounts: Map<String, Int> = emptyMap(),
    val availableTempos: List<String> = emptyList(),
    val tempoCounts: Map<String, Int> = emptyMap(),
    val totalBaseCount: Int = 0,
    val activeFilterCount: Int = 0
)

@OptIn(ExperimentalCoroutinesApi::class)
class LibraryViewModel(application: Application) : AndroidViewModel(application) {

    private val database = SoundScopeDatabase.getDatabase(application)
    private val repository = MusicRepository(
        database.trackDao(),
        database.playlistDao(),
        LocalAudioScanner(application)
    )

    // Master list of all tracks
    val allTracks: StateFlow<List<TrackEntity>> = repository.getAllTracksFlow()
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    // Filter states
    val searchQuery = MutableStateFlow("")
    val selectedDecade = MutableStateFlow<String?>(null)
    val selectedParentGenre = MutableStateFlow<String?>(null)
    val selectedGenre = MutableStateFlow<String?>(null)
    val selectedSubGenre = MutableStateFlow<String?>(null)
    val selectedTempo = MutableStateFlow<String?>(null)
    val isLikedOnly = MutableStateFlow(false)

    // Scan progress state
    private val _scanProgress = MutableStateFlow<ScanProgress?>(null)
    val scanProgress: StateFlow<ScanProgress?> = _scanProgress.asStateFlow()

    // Statistics
    val totalTracksCount = repository.getTotalTrackCountFlow()
        .stateIn(viewModelScope, SharingStarted.Lazily, 0)

    val likedTracksCount = repository.getLikedCountFlow()
        .stateIn(viewModelScope, SharingStarted.Lazily, 0)

    val recentlyAddedTracks = repository.getRecentlyAddedFlow(15)
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    val likedTracks = repository.getLikedTracksFlow()
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    // Taxonomy values for HomeScreen
    val distinctParentGenres: StateFlow<List<String>> = repository.getDistinctParentGenresFlow()
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    val distinctDecades: StateFlow<List<String>> = repository.getDistinctDecadesFlow()
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    private data class FilterCriteria(
        val decade: String?,
        val parentGenre: String?,
        val genre: String?,
        val subGenre: String?,
        val tempo: String?
    )

    private val taxonomyCriteria = combine(
        selectedDecade,
        selectedParentGenre,
        selectedGenre,
        selectedSubGenre,
        selectedTempo
    ) { decade, parent, genre, subGenre, tempo ->
        FilterCriteria(decade, parent, genre, subGenre, tempo)
    }

    // Combined Cascading Filter Computation (exact match with SoundScope web getPlayerFilterOptions)
    private val filterResult = combine(
        allTracks,
        searchQuery,
        isLikedOnly,
        taxonomyCriteria
    ) { tracks, query, likedOnly, criteria ->
        computePlayerFilterOptions(
            all = tracks,
            query = query,
            decade = criteria.decade,
            parentGenre = criteria.parentGenre,
            genre = criteria.genre,
            subGenre = criteria.subGenre,
            tempo = criteria.tempo,
            likedOnly = likedOnly
        )
    }.stateIn(
        viewModelScope,
        SharingStarted.Lazily,
        Pair(PlayerFilterOptions(), emptyList())
    )

    // Expose cascading filter options (with dynamic counts)
    val filterOptions: StateFlow<PlayerFilterOptions> = filterResult
        .map { it.first }
        .stateIn(viewModelScope, SharingStarted.Lazily, PlayerFilterOptions())

    // Expose filtered track list
    val tracks: StateFlow<List<TrackEntity>> = filterResult
        .map { it.second }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    // Total duration of current filtered tracks
    val filteredDurationMs: StateFlow<Long> = tracks.map { trackList ->
        trackList.sumOf { it.durationMs }
    }.stateIn(viewModelScope, SharingStarted.Lazily, 0L)

    val totalDurationMs = repository.getTotalDurationMsFlow()
        .map { it ?: 0L }
        .stateIn(viewModelScope, SharingStarted.Lazily, 0L)

    fun startAudioScan() {
        viewModelScope.launch {
            repository.scanAndSyncTracks().collect { progress ->
                _scanProgress.value = progress
                if (progress.isCompleted) {
                    kotlinx.coroutines.delay(2000)
                    _scanProgress.value = null
                }
            }
        }
    }

    fun setSearchQuery(query: String) {
        searchQuery.value = query
    }

    fun setDecadeFilter(decade: String?) {
        selectedDecade.value = decade
    }

    fun setParentGenreFilter(parent: String?) {
        selectedParentGenre.value = parent
        selectedGenre.value = null
        selectedSubGenre.value = null
    }

    fun setGenreFilter(genre: String?) {
        selectedGenre.value = genre
        selectedSubGenre.value = null
    }

    fun setSubGenreFilter(subGenre: String?) {
        selectedSubGenre.value = subGenre
    }

    fun setTempoFilter(tempo: String?) {
        selectedTempo.value = tempo
    }

    fun setLikedOnlyFilter(likedOnly: Boolean) {
        isLikedOnly.value = likedOnly
    }

    fun clearAllFilters() {
        searchQuery.value = ""
        selectedDecade.value = null
        selectedParentGenre.value = null
        selectedGenre.value = null
        selectedSubGenre.value = null
        selectedTempo.value = null
        isLikedOnly.value = false
    }

    fun toggleLike(track: TrackEntity, isLiked: Boolean) {
        viewModelScope.launch {
            repository.toggleTrackLike(track.id, isLiked)
        }
    }

    companion object {
        private fun matchesSearch(track: TrackEntity, query: String): Boolean {
            val q = query.trim().lowercase()
            if (q.isEmpty()) return true
            return track.title.lowercase().contains(q) ||
                    track.artist.lowercase().contains(q) ||
                    track.album.lowercase().contains(q) ||
                    track.fileName.lowercase().contains(q) ||
                    (track.parentGenre?.lowercase()?.contains(q) == true) ||
                    (track.genre?.lowercase()?.contains(q) == true) ||
                    (track.subGenre?.lowercase()?.contains(q) == true) ||
                    (track.decade?.lowercase()?.contains(q) == true)
        }

        fun computePlayerFilterOptions(
            all: List<TrackEntity>,
            query: String,
            decade: String?,
            parentGenre: String?,
            genre: String?,
            subGenre: String?,
            tempo: String?,
            likedOnly: Boolean
        ): Pair<PlayerFilterOptions, List<TrackEntity>> {
            // 1. Base tracks respect liked filter and search
            var baseTracks = if (likedOnly) all.filter { it.isLiked } else all
            if (query.isNotBlank()) {
                baseTracks = baseTracks.filter { matchesSearch(it, query) }
            }

            // Decades from base tracks
            val decadeCounts = mutableMapOf<String, Int>()
            for (t in baseTracks) {
                val d = t.decade
                if (!d.isNullOrBlank()) {
                    decadeCounts[d] = (decadeCounts[d] ?: 0) + 1
                }
            }
            val availableDecades = decadeCounts.keys.sortedDescending()
            val validDecade = if (decade != null && decadeCounts.containsKey(decade)) decade else null

            // 2. Parent genres from tracks matching selected decade
            val tracksForParents = if (validDecade != null) {
                baseTracks.filter { it.decade == validDecade }
            } else baseTracks

            val parentCounts = mutableMapOf<String, Int>()
            for (t in tracksForParents) {
                val p = t.parentGenre
                if (!p.isNullOrBlank()) {
                    parentCounts[p] = (parentCounts[p] ?: 0) + 1
                }
            }
            val availableParents = parentCounts.keys.sorted()
            val validParent = if (parentGenre != null && parentCounts.containsKey(parentGenre)) parentGenre else null

            // 3. Core genres from tracks matching decade AND parentGenre
            val tracksForGenres = if (validParent != null) {
                tracksForParents.filter { it.parentGenre == validParent }
            } else tracksForParents

            val genreCounts = mutableMapOf<String, Int>()
            for (t in tracksForGenres) {
                val g = t.genre
                if (!g.isNullOrBlank()) {
                    genreCounts[g] = (genreCounts[g] ?: 0) + 1
                }
            }
            val availableGenres = genreCounts.keys.sorted()
            val validGenre = if (genre != null && genreCounts.containsKey(genre)) genre else null

            // 4. Sub-genres from tracks matching decade, parentGenre, AND genre
            val tracksForSubgenres = if (validGenre != null) {
                tracksForGenres.filter { it.genre == validGenre }
            } else tracksForGenres

            val subGenreCounts = mutableMapOf<String, Int>()
            for (t in tracksForSubgenres) {
                val sg = t.subGenre
                if (!sg.isNullOrBlank()) {
                    subGenreCounts[sg] = (subGenreCounts[sg] ?: 0) + 1
                }
            }
            val availableSubGenres = subGenreCounts.keys.sorted()
            val validSubGenre = if (subGenre != null && subGenreCounts.containsKey(subGenre)) subGenre else null

            // 5. Tempos from tracks matching decade, parentGenre, genre, AND subGenre
            val tracksForTempo = if (validSubGenre != null) {
                tracksForSubgenres.filter { it.subGenre == validSubGenre }
            } else tracksForSubgenres

            val tempoCounts = mutableMapOf(
                "Slow" to 0,
                "Mid-tempo" to 0,
                "Fast" to 0,
                "Very Fast" to 0
            )
            for (t in tracksForTempo) {
                val tp = t.tempo ?: continue
                when {
                    GenreTaxonomy.matchTempo(tp, "Very Fast") -> tempoCounts["Very Fast"] = (tempoCounts["Very Fast"] ?: 0) + 1
                    GenreTaxonomy.matchTempo(tp, "Mid-tempo") -> tempoCounts["Mid-tempo"] = (tempoCounts["Mid-tempo"] ?: 0) + 1
                    GenreTaxonomy.matchTempo(tp, "Slow") -> tempoCounts["Slow"] = (tempoCounts["Slow"] ?: 0) + 1
                    GenreTaxonomy.matchTempo(tp, "Fast") -> tempoCounts["Fast"] = (tempoCounts["Fast"] ?: 0) + 1
                }
            }
            val allTemposOrder = listOf("Slow", "Mid-tempo", "Fast", "Very Fast")
            val availableTempos = allTemposOrder.filter { (tempoCounts[it] ?: 0) > 0 }
            val validTempo = if (tempo != null && (tempoCounts[tempo] ?: 0) > 0) tempo else null

            // Active filter count
            var activeCount = 0
            if (query.isNotBlank()) activeCount++
            if (validDecade != null) activeCount++
            if (validParent != null) activeCount++
            if (validGenre != null) activeCount++
            if (validSubGenre != null) activeCount++
            if (validTempo != null) activeCount++
            if (likedOnly) activeCount++

            // 6. Final filtered tracks
            val finalTracks = if (validTempo != null) {
                tracksForTempo.filter { GenreTaxonomy.matchTempo(it.tempo, validTempo) }
            } else {
                tracksForTempo
            }

            val options = PlayerFilterOptions(
                availableDecades = availableDecades,
                decadeCounts = decadeCounts,
                availableParents = availableParents,
                parentCounts = parentCounts,
                availableGenres = availableGenres,
                genreCounts = genreCounts,
                availableSubGenres = availableSubGenres,
                subGenreCounts = subGenreCounts,
                availableTempos = availableTempos,
                tempoCounts = tempoCounts,
                totalBaseCount = baseTracks.size,
                activeFilterCount = activeCount
            )

            return Pair(options, finalTracks)
        }
    }
}
