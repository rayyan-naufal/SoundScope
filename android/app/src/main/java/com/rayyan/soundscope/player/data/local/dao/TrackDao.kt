package com.rayyan.soundscope.player.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.rayyan.soundscope.player.data.local.entity.TrackEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TrackDao {

    @Query("SELECT * FROM tracks ORDER BY title COLLATE NOCASE ASC")
    fun getAllTracksFlow(): Flow<List<TrackEntity>>

    @Query("SELECT * FROM tracks ORDER BY dateAdded DESC LIMIT :limit")
    fun getRecentlyAddedFlow(limit: Int = 20): Flow<List<TrackEntity>>

    @Query("SELECT * FROM tracks WHERE id = :id")
    suspend fun getTrackById(id: Long): TrackEntity?

    @Query("SELECT * FROM tracks WHERE id = :id")
    fun getTrackByIdFlow(id: Long): Flow<TrackEntity?>

    @Query("SELECT * FROM tracks WHERE filePath = :filePath LIMIT 1")
    suspend fun getTrackByPath(filePath: String): TrackEntity?

    @Query("SELECT * FROM tracks WHERE isLiked = 1 ORDER BY title COLLATE NOCASE ASC")
    fun getLikedTracksFlow(): Flow<List<TrackEntity>>

    @Query("""
        SELECT * FROM tracks 
        WHERE title LIKE '%' || :query || '%' 
           OR artist LIKE '%' || :query || '%' 
           OR album LIKE '%' || :query || '%' 
           OR genre LIKE '%' || :query || '%' 
           OR parentGenre LIKE '%' || :query || '%'
        ORDER BY title COLLATE NOCASE ASC
    """)
    fun searchTracksFlow(query: String): Flow<List<TrackEntity>>

    @Query("""
        SELECT * FROM tracks 
        WHERE (:parentGenre IS NULL OR parentGenre = :parentGenre)
          AND (:genre IS NULL OR genre = :genre)
          AND (:subGenre IS NULL OR subGenre = :subGenre)
          AND (:decade IS NULL OR decade = :decade)
          AND (:tempo IS NULL OR tempo LIKE '%' || :tempo || '%')
          AND (:isLikedOnly = 0 OR isLiked = 1)
        ORDER BY title COLLATE NOCASE ASC
    """)
    fun filterTracksFlow(
        parentGenre: String? = null,
        genre: String? = null,
        subGenre: String? = null,
        decade: String? = null,
        tempo: String? = null,
        isLikedOnly: Int = 0
    ): Flow<List<TrackEntity>>

    // Taxonomy queries
    @Query("SELECT DISTINCT decade FROM tracks WHERE decade IS NOT NULL AND decade != '' ORDER BY decade DESC")
    fun getDistinctDecadesFlow(): Flow<List<String>>

    @Query("SELECT DISTINCT parentGenre FROM tracks WHERE parentGenre IS NOT NULL AND parentGenre != '' ORDER BY parentGenre ASC")
    fun getDistinctParentGenresFlow(): Flow<List<String>>

    @Query("""
        SELECT DISTINCT genre FROM tracks 
        WHERE genre IS NOT NULL AND genre != '' 
          AND (:parentGenre IS NULL OR parentGenre = :parentGenre)
        ORDER BY genre ASC
    """)
    fun getDistinctGenresFlow(parentGenre: String? = null): Flow<List<String>>

    @Query("""
        SELECT DISTINCT subGenre FROM tracks 
        WHERE subGenre IS NOT NULL AND subGenre != '' 
          AND (:genre IS NULL OR genre = :genre)
        ORDER BY subGenre ASC
    """)
    fun getDistinctSubGenresFlow(genre: String? = null): Flow<List<String>>

    @Query("SELECT DISTINCT tempo FROM tracks WHERE tempo IS NOT NULL AND tempo != '' ORDER BY tempo ASC")
    fun getDistinctTemposFlow(): Flow<List<String>>

    // Statistics queries
    @Query("SELECT COUNT(*) FROM tracks")
    fun getTotalCountFlow(): Flow<Int>

    @Query("SELECT COUNT(*) FROM tracks WHERE isLiked = 1")
    fun getLikedCountFlow(): Flow<Int>

    @Query("SELECT SUM(durationMs) FROM tracks")
    fun getTotalDurationMsFlow(): Flow<Long?>

    // Mutations
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(track: TrackEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(tracks: List<TrackEntity>): List<Long>

    @Update
    suspend fun update(track: TrackEntity)

    @Query("UPDATE tracks SET isLiked = :isLiked WHERE id = :trackId")
    suspend fun setLiked(trackId: Long, isLiked: Boolean)

    @Query("DELETE FROM tracks WHERE id = :trackId")
    suspend fun deleteById(trackId: Long)

    @Query("DELETE FROM tracks")
    suspend fun deleteAll()
}
