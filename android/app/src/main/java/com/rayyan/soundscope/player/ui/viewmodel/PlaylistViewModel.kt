package com.rayyan.soundscope.player.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rayyan.soundscope.player.data.local.SoundScopeDatabase
import com.rayyan.soundscope.player.data.local.entity.PlaylistEntity
import com.rayyan.soundscope.player.data.local.entity.TrackEntity
import com.rayyan.soundscope.player.data.repository.MusicRepository
import com.rayyan.soundscope.player.data.scanner.LocalAudioScanner
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@OptIn(ExperimentalCoroutinesApi::class)
class PlaylistViewModel(application: Application) : AndroidViewModel(application) {

    private val database = SoundScopeDatabase.getDatabase(application)
    private val repository = MusicRepository(
        database.trackDao(),
        database.playlistDao(),
        LocalAudioScanner(application)
    )

    val playlists: StateFlow<List<PlaylistEntity>> = repository.getAllPlaylistsFlow()
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    val selectedPlaylistId = MutableStateFlow<Long?>(null)

    val currentPlaylistTracks: StateFlow<List<TrackEntity>> = selectedPlaylistId.flatMapLatest { id ->
        if (id != null) {
            repository.getTracksForPlaylistFlow(id)
        } else {
            flowOf(emptyList())
        }
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    fun createPlaylist(name: String, description: String = "") {
        if (name.isBlank()) return
        viewModelScope.launch {
            repository.createPlaylist(name, description)
        }
    }

    fun deletePlaylist(playlistId: Long) {
        viewModelScope.launch {
            repository.deletePlaylist(playlistId)
            if (selectedPlaylistId.value == playlistId) {
                selectedPlaylistId.value = null
            }
        }
    }

    fun addTrackToPlaylist(playlistId: Long, trackId: Long) {
        viewModelScope.launch {
            repository.addTrackToPlaylist(playlistId, trackId)
        }
    }

    fun removeTrackFromPlaylist(playlistId: Long, trackId: Long) {
        viewModelScope.launch {
            repository.removeTrackFromPlaylist(playlistId, trackId)
        }
    }

    fun selectPlaylist(playlistId: Long?) {
        selectedPlaylistId.value = playlistId
    }
}
