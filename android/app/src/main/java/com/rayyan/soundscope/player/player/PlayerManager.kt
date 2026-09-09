package com.rayyan.soundscope.player.player

import android.content.ComponentName
import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import com.rayyan.soundscope.player.data.local.entity.TrackEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class RepeatMode {
    OFF, ALL, ONE
}

data class PlayerState(
    val currentTrack: TrackEntity? = null,
    val isPlaying: Boolean = false,
    val currentPositionMs: Long = 0L,
    val durationMs: Long = 0L,
    val isShuffleEnabled: Boolean = false,
    val repeatMode: RepeatMode = RepeatMode.OFF,
    val queue: List<TrackEntity> = emptyList(),
    val currentIndex: Int = -1,
    val isLoading: Boolean = false
)

@OptIn(UnstableApi::class)
class PlayerManager(private val context: Context) {

    private val coroutineScope = CoroutineScope(Dispatchers.Main + Job())
    private var progressJob: Job? = null

    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null

    private val _playerState = MutableStateFlow(PlayerState())
    val playerState: StateFlow<PlayerState> = _playerState.asStateFlow()

    private val queueTracks = mutableListOf<TrackEntity>()

    init {
        initializeController()
    }

    private fun initializeController() {
        val sessionToken = SessionToken(
            context,
            ComponentName(context, PlaybackService::class.java)
        )

        controllerFuture = MediaController.Builder(context, sessionToken).buildAsync()
        controllerFuture?.addListener({
            try {
                val mediaController = controllerFuture?.get()
                controller = mediaController
                setupPlayerListener(mediaController)
                syncInitialState(mediaController)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }, MoreExecutors.directExecutor())
    }

    private fun setupPlayerListener(player: MediaController?) {
        player?.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _playerState.update { it.copy(isPlaying = isPlaying) }
                if (isPlaying) {
                    startProgressTracker()
                } else {
                    stopProgressTracker()
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                val isLoading = playbackState == Player.STATE_BUFFERING
                val duration = player.duration.coerceAtLeast(0L)
                _playerState.update {
                    it.copy(
                        isLoading = isLoading,
                        durationMs = if (duration > 0) duration else it.durationMs
                    )
                }
            }

            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                val index = player.currentMediaItemIndex
                val currentTrack = if (index in queueTracks.indices) queueTracks[index] else null
                val duration = player.duration.coerceAtLeast(0L)

                _playerState.update {
                    it.copy(
                        currentTrack = currentTrack,
                        currentIndex = index,
                        durationMs = if (duration > 0) duration else currentTrack?.durationMs ?: 0L,
                        currentPositionMs = 0L
                    )
                }
            }

            override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) {
                _playerState.update { it.copy(isShuffleEnabled = shuffleModeEnabled) }
            }

            override fun onRepeatModeChanged(repeatMode: Int) {
                val mode = when (repeatMode) {
                    Player.REPEAT_MODE_ONE -> RepeatMode.ONE
                    Player.REPEAT_MODE_ALL -> RepeatMode.ALL
                    else -> RepeatMode.OFF
                }
                _playerState.update { it.copy(repeatMode = mode) }
            }
        })
    }

    private fun syncInitialState(player: MediaController?) {
        if (player == null) return
        val isPlaying = player.isPlaying
        val index = player.currentMediaItemIndex
        val currentTrack = if (index in queueTracks.indices) queueTracks[index] else null

        _playerState.update {
            it.copy(
                isPlaying = isPlaying,
                currentIndex = index,
                currentTrack = currentTrack,
                durationMs = player.duration.coerceAtLeast(0L),
                currentPositionMs = player.currentPosition.coerceAtLeast(0L),
                isShuffleEnabled = player.shuffleModeEnabled,
                repeatMode = when (player.repeatMode) {
                    Player.REPEAT_MODE_ONE -> RepeatMode.ONE
                    Player.REPEAT_MODE_ALL -> RepeatMode.ALL
                    else -> RepeatMode.OFF
                }
            )
        }

        if (isPlaying) {
            startProgressTracker()
        }
    }

    private fun startProgressTracker() {
        progressJob?.cancel()
        progressJob = coroutineScope.launch {
            while (isActive) {
                val pos = controller?.currentPosition?.coerceAtLeast(0L) ?: 0L
                val dur = controller?.duration?.coerceAtLeast(0L) ?: 0L
                _playerState.update {
                    it.copy(
                        currentPositionMs = pos,
                        durationMs = if (dur > 0) dur else it.durationMs
                    )
                }
                delay(250)
            }
        }
    }

    private fun stopProgressTracker() {
        progressJob?.cancel()
        progressJob = null
    }

    // --- Playback Controls ---

    fun playQueue(tracks: List<TrackEntity>, startIndex: Int = 0) {
        if (tracks.isEmpty()) return
        val player = controller ?: return

        queueTracks.clear()
        queueTracks.addAll(tracks)

        val mediaItems = tracks.map { MediaItemMapper.toMediaItem(it) }
        val safeIndex = startIndex.coerceIn(0, tracks.lastIndex)

        player.setMediaItems(mediaItems, safeIndex, 0L)
        player.prepare()
        player.play()

        _playerState.update {
            it.copy(
                queue = queueTracks.toList(),
                currentIndex = safeIndex,
                currentTrack = queueTracks[safeIndex],
                isPlaying = true
            )
        }
    }

    fun playTrack(track: TrackEntity) {
        playQueue(listOf(track), 0)
    }

    fun togglePlayPause() {
        val player = controller ?: return
        if (player.isPlaying) {
            player.pause()
        } else {
            if (player.playbackState == Player.STATE_IDLE) {
                player.prepare()
            }
            player.play()
        }
    }

    fun seekTo(positionMs: Long) {
        val player = controller ?: return
        player.seekTo(positionMs.coerceAtLeast(0L))
        _playerState.update { it.copy(currentPositionMs = positionMs) }
    }

    fun skipToNext() {
        val player = controller ?: return
        if (player.hasNextMediaItem()) {
            player.seekToNextMediaItem()
        }
    }

    fun skipToPrevious() {
        val player = controller ?: return
        if (player.currentPosition > 3000) {
            // If played more than 3 seconds, restart current track
            player.seekTo(0L)
        } else if (player.hasPreviousMediaItem()) {
            player.seekToPreviousMediaItem()
        } else {
            player.seekTo(0L)
        }
    }

    fun toggleShuffle() {
        val player = controller ?: return
        val newShuffle = !player.shuffleModeEnabled
        player.shuffleModeEnabled = newShuffle
        _playerState.update { it.copy(isShuffleEnabled = newShuffle) }
    }

    fun toggleRepeatMode() {
        val player = controller ?: return
        val nextMode = when (_playerState.value.repeatMode) {
            RepeatMode.OFF -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.ONE
            RepeatMode.ONE -> RepeatMode.OFF
        }
        val media3Mode = when (nextMode) {
            RepeatMode.OFF -> Player.REPEAT_MODE_OFF
            RepeatMode.ALL -> Player.REPEAT_MODE_ALL
            RepeatMode.ONE -> Player.REPEAT_MODE_ONE
        }
        player.repeatMode = media3Mode
        _playerState.update { it.copy(repeatMode = nextMode) }
    }

    fun addToQueue(track: TrackEntity) {
        val player = controller ?: return
        queueTracks.add(track)
        player.addMediaItem(MediaItemMapper.toMediaItem(track))
        _playerState.update { it.copy(queue = queueTracks.toList()) }
    }

    fun playNext(track: TrackEntity) {
        val player = controller ?: return
        val nextIndex = (player.currentMediaItemIndex + 1).coerceAtMost(queueTracks.size)
        queueTracks.add(nextIndex, track)
        player.addMediaItem(nextIndex, MediaItemMapper.toMediaItem(track))
        _playerState.update { it.copy(queue = queueTracks.toList()) }
    }

    fun removeFromQueue(index: Int) {
        val player = controller ?: return
        if (index in queueTracks.indices) {
            queueTracks.removeAt(index)
            player.removeMediaItem(index)
            _playerState.update { it.copy(queue = queueTracks.toList()) }
        }
    }

    fun clearQueue() {
        val player = controller ?: return
        player.clearMediaItems()
        queueTracks.clear()
        _playerState.update {
            it.copy(
                queue = emptyList(),
                currentTrack = null,
                currentIndex = -1,
                isPlaying = false,
                currentPositionMs = 0L,
                durationMs = 0L
            )
        }
    }

    fun release() {
        stopProgressTracker()
        controllerFuture?.let { MediaController.releaseFuture(it) }
        controller = null
    }

    companion object {
        @Volatile
        private var INSTANCE: PlayerManager? = null

        fun getInstance(context: Context): PlayerManager {
            return INSTANCE ?: synchronized(this) {
                val instance = PlayerManager(context.applicationContext)
                INSTANCE = instance
                instance
            }
        }
    }
}
