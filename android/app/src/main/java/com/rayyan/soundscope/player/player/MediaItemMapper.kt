package com.rayyan.soundscope.player.player

import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import com.rayyan.soundscope.player.data.local.entity.TrackEntity

object MediaItemMapper {

    fun toMediaItem(track: TrackEntity): MediaItem {
        val metadataBuilder = MediaMetadata.Builder()
            .setTitle(track.title)
            .setArtist(track.artist)
            .setAlbumTitle(track.album)
            .setGenre(track.genre ?: track.parentGenre)

        track.coverUriString?.let {
            metadataBuilder.setArtworkUri(Uri.parse(it))
        }

        return MediaItem.Builder()
            .setMediaId(track.id.toString())
            .setUri(Uri.parse(track.contentUriString))
            .setMediaMetadata(metadataBuilder.build())
            .build()
    }
}
