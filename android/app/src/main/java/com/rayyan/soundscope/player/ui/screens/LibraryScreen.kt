package com.rayyan.soundscope.player.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rayyan.soundscope.player.ui.components.FilterSearchBar
import com.rayyan.soundscope.player.ui.components.TrackRowItem
import com.rayyan.soundscope.player.ui.theme.SoundScopeBackground
import com.rayyan.soundscope.player.ui.theme.SoundScopeBorder
import com.rayyan.soundscope.player.ui.theme.SoundScopePrimary
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurface
import com.rayyan.soundscope.player.ui.theme.TextMuted
import com.rayyan.soundscope.player.ui.theme.TextPrimary
import com.rayyan.soundscope.player.ui.theme.TextSecondary
import com.rayyan.soundscope.player.ui.theme.TextTertiary
import com.rayyan.soundscope.player.ui.viewmodel.LibraryViewModel
import com.rayyan.soundscope.player.ui.viewmodel.PlayerViewModel
import com.rayyan.soundscope.player.ui.viewmodel.PlaylistViewModel

@Composable
fun LibraryScreen(
    libraryViewModel: LibraryViewModel,
    playerViewModel: PlayerViewModel,
    playlistViewModel: PlaylistViewModel,
    modifier: Modifier = Modifier
) {
    val allTracks by libraryViewModel.allTracks.collectAsState()
    val totalDurationMs by libraryViewModel.totalDurationMs.collectAsState()
    val playerState by playerViewModel.playerState.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(SoundScopeBackground)
            .padding(horizontal = 16.dp)
    ) {
        // --- Top Header ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp, bottom = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Library",
                    color = TextPrimary,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = formatTrackStats(allTracks.size, totalDurationMs),
                    color = TextTertiary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Normal
                )
            }

            IconButton(
                onClick = { libraryViewModel.startAudioScan() },
                modifier = Modifier.size(34.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "Rescan Audio",
                    tint = TextSecondary,
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        // --- Action Toolbar (Play All & Shuffle with Amber Accent) ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "${allTracks.size} songs",
                color = TextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // Play All Button (Amber Background)
                Button(
                    onClick = {
                        if (allTracks.isNotEmpty()) {
                            playerViewModel.playQueue(allTracks, 0)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = SoundScopePrimary,
                        contentColor = Color(0xFF101114)
                    ),
                    shape = RoundedCornerShape(20.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 4.dp),
                    modifier = Modifier.height(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Play All",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Shuffle Button (Outlined)
                OutlinedButton(
                    onClick = {
                        if (allTracks.isNotEmpty()) {
                            playerViewModel.playQueue(allTracks.shuffled(), 0)
                        }
                    },
                    shape = RoundedCornerShape(20.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                    modifier = Modifier
                        .height(32.dp)
                        .border(1.dp, SoundScopeBorder, RoundedCornerShape(20.dp))
                ) {
                    Icon(
                        imageVector = Icons.Default.Shuffle,
                        contentDescription = null,
                        tint = TextPrimary,
                        modifier = Modifier.size(15.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Shuffle",
                        color = TextPrimary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // --- Track List ---
        if (allTracks.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "No music found on device.",
                        color = TextSecondary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Tap the refresh icon on top to scan offline audio files.",
                        color = TextMuted,
                        fontSize = 12.sp
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 24.dp)
            ) {
                itemsIndexed(allTracks, key = { _, t -> t.id }) { index, track ->
                    val isCurrent = playerState.currentTrack?.id == track.id
                    TrackRowItem(
                        track = track,
                        isCurrentTrack = isCurrent,
                        isPlaying = isCurrent && playerState.isPlaying,
                        onClick = { playerViewModel.playQueue(allTracks, index) },
                        onLikeToggle = { isLiked -> libraryViewModel.toggleLike(track, isLiked) },
                        onPlayNext = { playerViewModel.playNext(track) },
                        onAddToQueue = { playerViewModel.addToQueue(track) },
                        onAddToPlaylist = { }
                    )
                }
            }
        }
    }
}

private fun formatTrackStats(count: Int, durationMs: Long): String {
    val totalSeconds = (durationMs / 1000).coerceAtLeast(0)
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    return if (hours > 0) {
        "$count tracks • $hours hr $minutes min"
    } else {
        "$count tracks • $minutes min"
    }
}
