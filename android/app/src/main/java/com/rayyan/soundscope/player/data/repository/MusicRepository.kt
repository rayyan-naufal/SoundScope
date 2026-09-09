package com.rayyan.soundscope.player.data.repository

import com.rayyan.soundscope.player.data.local.dao.PlaylistDao
import com.rayyan.soundscope.player.data.local.dao.TrackDao
import com.rayyan.soundscope.player.data.local.entity.PlaylistEntity
import com.rayyan.soundscope.player.data.local.entity.PlaylistTrackCrossRef
import com.rayyan.soundscope.player.data.local.entity.PlaylistWithTracks
import com.rayyan.soundscope.player.data.local.entity.TrackEntity
import com.rayyan.soundscope.player.data.scanner.LocalAudioScanner
import com.rayyan.soundscope.player.data.scanner.ScanProgress
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext

class MusicRepository(
    private val trackDao: TrackDao,
    private val playlistDao: PlaylistDao,
    private val scanner: LocalAudioScanner
) {

    // --- Tracks Observables ---
    fun getAllTracksFlow(): Flow<List<TrackEntity>> = trackDao.getAllTracksFlow()

    fun getRecentlyAddedFlow(limit: Int = 20): Flow<List<TrackEntity>> =
        trackDao.getRecentlyAddedFlow(limit)

    fun getLikedTracksFlow(): Flow<List<TrackEntity>> = trackDao.getLikedTracksFlow()

    fun searchTracksFlow(query: String): Flow<List<TrackEntity>> =
        trackDao.searchTracksFlow(query)

    fun filterTracksFlow(
        parentGenre: String? = null,
        genre: String? = null,
        subGenre: String? = null,
        decade: String? = null,
        tempo: String? = null,
        isLikedOnly: Boolean = false
    ): Flow<List<TrackEntity>> =
        trackDao.filterTracksFlow(
            parentGenre = parentGenre,
            genre = genre,
            subGenre = subGenre,
            decade = decade,
            tempo = tempo,
            isLikedOnly = if (isLikedOnly) 1 else 0
        )

    fun getTrackByIdFlow(trackId: Long): Flow<TrackEntity?> =
        trackDao.getTrackByIdFlow(trackId)

    suspend fun getTrackById(trackId: Long): TrackEntity? =
        trackDao.getTrackById(trackId)

    // --- Taxonomy Observables ---
    fun getDistinctDecadesFlow(): Flow<List<String>> = trackDao.getDistinctDecadesFlow()

    fun getDistinctParentGenresFlow(): Flow<List<String>> = trackDao.getDistinctParentGenresFlow()

    fun getDistinctGenresFlow(parentGenre: String? = null): Flow<List<String>> =
        trackDao.getDistinctGenresFlow(parentGenre)

    fun getDistinctSubGenresFlow(genre: String? = null): Flow<List<String>> =
        trackDao.getDistinctSubGenresFlow(genre)

    fun getDistinctTemposFlow(): Flow<List<String>> = trackDao.getDistinctTemposFlow()

    // --- Statistics Observables ---
    fun getTotalTrackCountFlow(): Flow<Int> = trackDao.getTotalCountFlow()

    fun getLikedCountFlow(): Flow<Int> = trackDao.getLikedCountFlow()

    fun getTotalDurationMsFlow(): Flow<Long?> = trackDao.getTotalDurationMsFlow()

    // --- Audio Scanning & Ingestion ---
    fun scanAndSyncTracks(): Flow<ScanProgress> = flow {
        scanner.scanDeviceAudio { batch ->
            withContext(Dispatchers.IO) {
                val toInsert = batch.map { scanned ->
                    val existing = trackDao.getTrackByPath(scanned.filePath)
                    if (existing != null) {
                        // Preserve user favorite state
                        scanned.copy(id = existing.id, isLiked = existing.isLiked)
                    } else {
                        scanned
                    }
                }
                trackDao.insertAll(toInsert)
            }
        }.collect { progress ->
            emit(progress)
        }
    }.flowOn(Dispatchers.IO)

    // --- Favorites Toggle ---
    suspend fun toggleTrackLike(trackId: Long, isLiked: Boolean) = withContext(Dispatchers.IO) {
        trackDao.setLiked(trackId, isLiked)
    }

    // --- Playlists Management ---
    fun getAllPlaylistsFlow(): Flow<List<PlaylistEntity>> =
        playlistDao.getAllPlaylistsFlow()

    fun getPlaylistWithTracksFlow(playlistId: Long): Flow<PlaylistWithTracks?> =
        playlistDao.getPlaylistWithTracksFlow(playlistId)

    fun getTracksForPlaylistFlow(playlistId: Long): Flow<List<TrackEntity>> =
        playlistDao.getTracksForPlaylistFlow(playlistId)

    fun getPlaylistTrackCountFlow(playlistId: Long): Flow<Int> =
        playlistDao.getTrackCountFlow(playlistId)

    suspend fun createPlaylist(name: String, description: String = ""): Long = withContext(Dispatchers.IO) {
        val entity = PlaylistEntity(name = name.trim(), description = description.trim())
        playlistDao.insertPlaylist(entity)
    }

    suspend fun deletePlaylist(playlistId: Long) = withContext(Dispatchers.IO) {
        playlistDao.deletePlaylistById(playlistId)
    }

    suspend fun updatePlaylist(playlistId: Long, name: String, description: String) = withContext(Dispatchers.IO) {
        val existing = playlistDao.getPlaylistById(playlistId) ?: return@withContext
        playlistDao.updatePlaylist(
            existing.copy(
                name = name.trim(),
                description = description.trim(),
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun addTrackToPlaylist(playlistId: Long, trackId: Long) = withContext(Dispatchers.IO) {
        val currentMax = playlistDao.getMaxPosition(playlistId) ?: -1
        playlistDao.addTrackToPlaylist(
            PlaylistTrackCrossRef(
                playlistId = playlistId,
                trackId = trackId,
                position = currentMax + 1
            )
        )
        playlistDao.updateTimestamp(playlistId)
    }

    suspend fun addTracksToPlaylist(playlistId: Long, trackIds: List<Long>) = withContext(Dispatchers.IO) {
        val currentMax = playlistDao.getMaxPosition(playlistId) ?: -1
        var pos = currentMax + 1
        val crossRefs = trackIds.map { id ->
            PlaylistTrackCrossRef(
                playlistId = playlistId,
                trackId = id,
                position = pos++
            )
        }
        playlistDao.addTracksToPlaylist(crossRefs)
        playlistDao.updateTimestamp(playlistId)
    }

    suspend fun removeTrackFromPlaylist(playlistId: Long, trackId: Long) = withContext(Dispatchers.IO) {
        playlistDao.removeTrackFromPlaylist(playlistId, trackId)
        playlistDao.updateTimestamp(playlistId)
    }
}
