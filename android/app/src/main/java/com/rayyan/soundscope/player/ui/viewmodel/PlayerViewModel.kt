package com.rayyan.soundscope.player.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rayyan.soundscope.player.data.local.SoundScopeDatabase
import com.rayyan.soundscope.player.data.local.entity.TrackEntity
import com.rayyan.soundscope.player.data.repository.MusicRepository
import com.rayyan.soundscope.player.data.scanner.LocalAudioScanner
import com.rayyan.soundscope.player.player.PlayerManager
import com.rayyan.soundscope.player.player.PlayerState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class PlayerViewModel(application: Application) : AndroidViewModel(application) {

    private val playerManager = PlayerManager.getInstance(application)
    private val database = SoundScopeDatabase.getDatabase(application)
    private val repository = MusicRepository(
        database.trackDao(),
        database.playlistDao(),
        LocalAudioScanner(application)
    )

    val playerState: StateFlow<PlayerState> = playerManager.playerState

    private val _isNowPlayingExpanded = MutableStateFlow(false)
    val isNowPlayingExpanded: StateFlow<Boolean> = _isNowPlayingExpanded.asStateFlow()

    private val _isQueueSheetVisible = MutableStateFlow(false)
    val isQueueSheetVisible: StateFlow<Boolean> = _isQueueSheetVisible.asStateFlow()

    fun playTrack(track: TrackEntity, playlist: List<TrackEntity> = listOf(track)) {
        val index = playlist.indexOfFirst { it.id == track.id }.coerceAtLeast(0)
        playerManager.playQueue(playlist, index)
    }

    fun playQueue(tracks: List<TrackEntity>, startIndex: Int = 0) {
        playerManager.playQueue(tracks, startIndex)
    }

    fun togglePlayPause() {
        playerManager.togglePlayPause()
    }

    fun seekTo(positionMs: Long) {
        playerManager.seekTo(positionMs)
    }

    fun skipToNext() {
        playerManager.skipToNext()
    }

    fun skipToPrevious() {
        playerManager.skipToPrevious()
    }

    fun toggleShuffle() {
        playerManager.toggleShuffle()
    }

    fun toggleRepeatMode() {
        playerManager.toggleRepeatMode()
    }

    fun playNext(track: TrackEntity) {
        playerManager.playNext(track)
    }

    fun addToQueue(track: TrackEntity) {
        playerManager.addToQueue(track)
    }

    fun removeFromQueue(index: Int) {
        playerManager.removeFromQueue(index)
    }

    fun clearQueue() {
        playerManager.clearQueue()
    }

    fun setNowPlayingExpanded(expanded: Boolean) {
        _isNowPlayingExpanded.value = expanded
    }

    fun setQueueSheetVisible(visible: Boolean) {
        _isQueueSheetVisible.value = visible
    }

    fun toggleLike(track: TrackEntity, isLiked: Boolean) {
        viewModelScope.launch {
            repository.toggleTrackLike(track.id, isLiked)
        }
    }
}
