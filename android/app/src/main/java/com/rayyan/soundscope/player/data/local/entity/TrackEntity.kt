package com.rayyan.soundscope.player.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "tracks",
    indices = [
        Index(value = ["filePath"], unique = true),
        Index(value = ["mediaStoreId"]),
        Index(value = ["parentGenre"]),
        Index(value = ["genre"]),
        Index(value = ["decade"]),
        Index(value = ["isLiked"]),
        Index(value = ["title"]),
        Index(value = ["artist"])
    ]
)
data class TrackEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val mediaStoreId: Long,
    val filePath: String,
    val contentUriString: String,
    val fileName: String,
    val title: String,
    val artist: String,
    val album: String,
    val albumId: Long,
    val releaseYear: Int? = null,
    val decade: String? = null,
    val parentGenre: String? = null,
    val genre: String? = null,
    val subGenre: String? = null,
    val tempo: String? = null,
    val durationMs: Long = 0L,
    val bitrate: Int = 0,
    val hasCover: Boolean = false,
    val coverUriString: String? = null,
    val isLiked: Boolean = false,
    val dateAdded: Long = System.currentTimeMillis()
)
