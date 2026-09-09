package com.rayyan.soundscope.player.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.QueueMusic
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.RepeatOne
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.rayyan.soundscope.player.player.RepeatMode
import com.rayyan.soundscope.player.ui.components.GenreBadge
import com.rayyan.soundscope.player.ui.components.TempoBadge
import com.rayyan.soundscope.player.ui.components.formatDuration
import com.rayyan.soundscope.player.ui.theme.ColorLiked
import com.rayyan.soundscope.player.ui.theme.SoundScopeBackground
import com.rayyan.soundscope.player.ui.theme.SoundScopeBorder
import com.rayyan.soundscope.player.ui.theme.SoundScopePrimary
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurface
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurfaceElevated
import com.rayyan.soundscope.player.ui.theme.TextMuted
import com.rayyan.soundscope.player.ui.theme.TextPrimary
import com.rayyan.soundscope.player.ui.theme.TextSecondary
import com.rayyan.soundscope.player.ui.theme.TextTertiary
import com.rayyan.soundscope.player.ui.viewmodel.PlayerViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NowPlayingScreen(
    playerViewModel: PlayerViewModel,
    onCollapse: () -> Unit,
    modifier: Modifier = Modifier
) {
    val playerState by playerViewModel.playerState.collectAsState()
    val track = playerState.currentTrack ?: return

    var isDraggingSlider by remember { mutableStateOf(false) }
    var sliderPosition by remember { mutableFloatStateOf(0f) }

    val currentMs = if (isDraggingSlider) {
        sliderPosition.toLong()
    } else {
        playerState.currentPositionMs
    }

    val durationMs = playerState.durationMs.coerceAtLeast(1L)

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF1F1A14),
                        SoundScopeBackground,
                        SoundScopeBackground
                    )
                )
            )
            .padding(horizontal = 24.dp)
    ) {
        // Top Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp, bottom = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onCollapse) {
                Icon(
                    imageVector = Icons.Default.KeyboardArrowDown,
                    contentDescription = "Collapse",
                    tint = TextPrimary,
                    modifier = Modifier.size(30.dp)
                )
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "PLAYING OFFLINE",
                    color = SoundScopePrimary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                Text(
                    text = track.album,
                    color = TextSecondary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            IconButton(onClick = { playerViewModel.setQueueSheetVisible(true) }) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.QueueMusic,
                    contentDescription = "Queue",
                    tint = TextPrimary,
                    modifier = Modifier.size(24.dp)
                )
            }
        }

        Spacer(modifier = Modifier.weight(0.5f))

        // Large Album Cover Art
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .aspectRatio(1f)
                .clip(RoundedCornerShape(20.dp))
                .background(SoundScopeSurfaceElevated),
            contentAlignment = Alignment.Center
        ) {
            if (track.coverUriString != null) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(track.coverUriString)
                        .crossfade(true)
                        .build(),
                    contentDescription = track.title,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            } else {
                Icon(
                    imageVector = Icons.Default.MusicNote,
                    contentDescription = null,
                    tint = TextMuted,
                    modifier = Modifier.size(96.dp)
                )
            }
        }

        Spacer(modifier = Modifier.weight(0.5f))

        // Track Info & Like Toggle
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = track.title,
                    color = TextPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = track.artist,
                    color = TextSecondary,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                // Badges row
                Row(
                    modifier = Modifier.padding(top = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    val genreBadge = track.parentGenre ?: track.genre
                    if (!genreBadge.isNullOrBlank()) {
                        GenreBadge(text = genreBadge)
                    }
                    if (!track.subGenre.isNullOrBlank() && track.subGenre != genreBadge) {
                        GenreBadge(text = track.subGenre)
                    }
                    if (!track.tempo.isNullOrBlank()) {
                        TempoBadge(tempo = track.tempo)
                    }
                    if (!track.decade.isNullOrBlank()) {
                        GenreBadge(text = track.decade)
                    }
                }
            }

            IconButton(
                onClick = { playerViewModel.toggleLike(track, !track.isLiked) },
                modifier = Modifier.size(44.dp)
            ) {
                Icon(
                    imageVector = if (track.isLiked) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                    contentDescription = "Favorite",
                    tint = if (track.isLiked) ColorLiked else TextSecondary,
                    modifier = Modifier.size(28.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Progress Slider
        Slider(
            value = currentMs.toFloat().coerceIn(0f, durationMs.toFloat()),
            onValueChange = {
                isDraggingSlider = true
                sliderPosition = it
            },
            onValueChangeFinished = {
                playerViewModel.seekTo(sliderPosition.toLong())
                isDraggingSlider = false
            },
            valueRange = 0f..durationMs.toFloat(),
            colors = SliderDefaults.colors(
                thumbColor = SoundScopePrimary,
                activeTrackColor = SoundScopePrimary,
                inactiveTrackColor = SoundScopeBorder
            ),
            modifier = Modifier.fillMaxWidth()
        )

        // Time indicators
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = formatDuration(currentMs),
                color = TextTertiary,
                fontSize = 11.sp
            )
            Text(
                text = formatDuration(durationMs),
                color = TextTertiary,
                fontSize = 11.sp
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Transport Controls
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Shuffle
            IconButton(onClick = { playerViewModel.toggleShuffle() }) {
                Icon(
                    imageVector = Icons.Default.Shuffle,
                    contentDescription = "Shuffle",
                    tint = if (playerState.isShuffleEnabled) SoundScopePrimary else TextMuted,
                    modifier = Modifier.size(22.dp)
                )
            }

            // Previous
            IconButton(onClick = { playerViewModel.skipToPrevious() }) {
                Icon(
                    imageVector = Icons.Default.SkipPrevious,
                    contentDescription = "Previous",
                    tint = TextPrimary,
                    modifier = Modifier.size(34.dp)
                )
            }

            // Big Round Play / Pause Button
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .background(SoundScopePrimary),
                contentAlignment = Alignment.Center
            ) {
                IconButton(
                    onClick = { playerViewModel.togglePlayPause() },
                    modifier = Modifier.fillMaxSize()
                ) {
                    Icon(
                        imageVector = if (playerState.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = "Play/Pause",
                        tint = Color(0xFF101114),
                        modifier = Modifier.size(34.dp)
                    )
                }
            }

            // Next
            IconButton(onClick = { playerViewModel.skipToNext() }) {
                Icon(
                    imageVector = Icons.Default.SkipNext,
                    contentDescription = "Next",
                    tint = TextPrimary,
                    modifier = Modifier.size(34.dp)
                )
            }

            // Repeat Mode
            IconButton(onClick = { playerViewModel.toggleRepeatMode() }) {
                val (icon, tint) = when (playerState.repeatMode) {
                    RepeatMode.ONE -> Pair(Icons.Default.RepeatOne, SoundScopePrimary)
                    RepeatMode.ALL -> Pair(Icons.Default.Repeat, SoundScopePrimary)
                    RepeatMode.OFF -> Pair(Icons.Default.Repeat, TextMuted)
                }
                Icon(
                    imageVector = icon,
                    contentDescription = "Repeat",
                    tint = tint,
                    modifier = Modifier.size(22.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}
