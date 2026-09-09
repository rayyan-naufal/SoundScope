package com.rayyan.soundscope.player.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.rayyan.soundscope.player.data.local.entity.PlaylistEntity
import com.rayyan.soundscope.player.data.local.entity.PlaylistTrackCrossRef
import com.rayyan.soundscope.player.data.local.entity.PlaylistWithTracks
import com.rayyan.soundscope.player.data.local.entity.TrackEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PlaylistDao {

    @Query("SELECT * FROM playlists ORDER BY updatedAt DESC")
    fun getAllPlaylistsFlow(): Flow<List<PlaylistEntity>>

    @Query("SELECT * FROM playlists WHERE id = :playlistId")
    suspend fun getPlaylistById(playlistId: Long): PlaylistEntity?

    @Transaction
    @Query("SELECT * FROM playlists WHERE id = :playlistId")
    fun getPlaylistWithTracksFlow(playlistId: Long): Flow<PlaylistWithTracks?>

    @Query("""
        SELECT t.* FROM tracks t
        INNER JOIN playlist_tracks pt ON t.id = pt.trackId
        WHERE pt.playlistId = :playlistId
        ORDER BY pt.position ASC, pt.addedAt ASC
    """)
    fun getTracksForPlaylistFlow(playlistId: Long): Flow<List<TrackEntity>>

    @Query("SELECT COUNT(*) FROM playlist_tracks WHERE playlistId = :playlistId")
    fun getTrackCountFlow(playlistId: Long): Flow<Int>

    @Query("SELECT MAX(position) FROM playlist_tracks WHERE playlistId = :playlistId")
    suspend fun getMaxPosition(playlistId: Long): Int?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylist(playlist: PlaylistEntity): Long

    @Update
    suspend fun updatePlaylist(playlist: PlaylistEntity)

    @Query("DELETE FROM playlists WHERE id = :playlistId")
    suspend fun deletePlaylistById(playlistId: Long)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun addTrackToPlaylist(crossRef: PlaylistTrackCrossRef)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun addTracksToPlaylist(crossRefs: List<PlaylistTrackCrossRef>)

    @Query("DELETE FROM playlist_tracks WHERE playlistId = :playlistId AND trackId = :trackId")
    suspend fun removeTrackFromPlaylist(playlistId: Long, trackId: Long)

    @Query("UPDATE playlists SET updatedAt = :timestamp WHERE id = :playlistId")
    suspend fun updateTimestamp(playlistId: Long, timestamp: Long = System.currentTimeMillis())
}
