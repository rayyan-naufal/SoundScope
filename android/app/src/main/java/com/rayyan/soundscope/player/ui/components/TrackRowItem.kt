package com.rayyan.soundscope.player.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.rayyan.soundscope.player.data.local.entity.TrackEntity
import com.rayyan.soundscope.player.ui.theme.ColorLiked
import com.rayyan.soundscope.player.ui.theme.SoundScopePrimary
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurface
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurfaceElevated
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurfaceHighlight
import com.rayyan.soundscope.player.ui.theme.TextMuted
import com.rayyan.soundscope.player.ui.theme.TextPrimary
import com.rayyan.soundscope.player.ui.theme.TextSecondary
import com.rayyan.soundscope.player.ui.theme.TextTertiary

@Composable
fun TrackRowItem(
    track: TrackEntity,
    isCurrentTrack: Boolean,
    isPlaying: Boolean,
    onClick: () -> Unit,
    onLikeToggle: (Boolean) -> Unit,
    onPlayNext: () -> Unit,
    onAddToQueue: () -> Unit,
    onAddToPlaylist: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showMenu by remember { mutableStateOf(false) }

    val bgColor = if (isCurrentTrack) {
        SoundScopeSurfaceHighlight.copy(alpha = 0.5f)
    } else {
        Color.Transparent
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(bgColor, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Album Thumbnail
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(SoundScopeSurfaceElevated),
            contentAlignment = Alignment.Center
        ) {
            if (track.coverUriString != null) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(track.coverUriString)
                        .crossfade(true)
                        .build(),
                    contentDescription = track.album,
                    modifier = Modifier.size(48.dp),
                    contentScale = ContentScale.Crop
                )
            } else {
                Icon(
                    imageVector = Icons.Default.MusicNote,
                    contentDescription = null,
                    tint = TextMuted,
                    modifier = Modifier.size(24.dp)
                )
            }

            if (isCurrentTrack && isPlaying) {
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .background(Color.Black.copy(alpha = 0.45f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.MusicNote,
                        contentDescription = "Playing",
                        tint = SoundScopePrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        // Track details
        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = track.title,
                color = if (isCurrentTrack) SoundScopePrimary else TextPrimary,
                fontSize = 14.sp,
                fontWeight = if (isCurrentTrack) FontWeight.Bold else FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = track.artist,
                    color = TextSecondary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )

                // Parent Genre / Core Genre badge
                val badgeText = track.parentGenre ?: track.genre
                if (!badgeText.isNullOrBlank()) {
                    GenreBadge(text = badgeText)
                }

                // Sub-genre badge (if distinct from main badge)
                if (!track.subGenre.isNullOrBlank() && track.subGenre != badgeText) {
                    GenreBadge(text = track.subGenre)
                }

                // Tempo badge with emoji and pace color
                if (!track.tempo.isNullOrBlank()) {
                    TempoBadge(tempo = track.tempo)
                }

                // Decade badge
                if (!track.decade.isNullOrBlank()) {
                    GenreBadge(text = track.decade)
                }
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Duration
        Text(
            text = formatDuration(track.durationMs),
            color = TextTertiary,
            fontSize = 11.sp
        )

        // Like button with minimum 48dp touch target
        IconButton(
            onClick = { onLikeToggle(!track.isLiked) },
            modifier = Modifier.size(48.dp)
        ) {
            Icon(
                imageVector = if (track.isLiked) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                contentDescription = if (track.isLiked) "Remove ${track.title} from favorites" else "Add ${track.title} to favorites",
                tint = if (track.isLiked) ColorLiked else TextMuted,
                modifier = Modifier.size(19.dp)
            )
        }

        // Options dropdown menu with minimum 48dp touch target
        Box {
            IconButton(
                onClick = { showMenu = true },
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.MoreVert,
                    contentDescription = "More options for ${track.title}",
                    tint = TextSecondary,
                    modifier = Modifier.size(19.dp)
                )
            }

            DropdownMenu(
                expanded = showMenu,
                onDismissRequest = { showMenu = false },
                modifier = Modifier.background(SoundScopeSurfaceElevated)
            ) {
                DropdownMenuItem(
                    text = { Text("Play Next", color = TextPrimary) },
                    onClick = {
                        showMenu = false
                        onPlayNext()
                    }
                )
                DropdownMenuItem(
                    text = { Text("Add to Queue", color = TextPrimary) },
                    onClick = {
                        showMenu = false
                        onAddToQueue()
                    }
                )
                DropdownMenuItem(
                    text = { Text("Add to Playlist", color = TextPrimary) },
                    onClick = {
                        showMenu = false
                        onAddToPlaylist()
                    }
                )
            }
        }
    }
}

fun formatDuration(ms: Long): String {
    val totalSeconds = (ms / 1000).coerceAtLeast(0)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return String.format("%d:%02d", minutes, seconds)
}
