package com.rayyan.soundscope.player.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import com.rayyan.soundscope.player.ui.theme.SoundScopeBorder
import com.rayyan.soundscope.player.ui.theme.SoundScopePrimary
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurface
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurfaceElevated
import com.rayyan.soundscope.player.ui.theme.TextMuted
import com.rayyan.soundscope.player.ui.theme.TextPrimary
import com.rayyan.soundscope.player.ui.theme.TextSecondary

@Composable
fun MiniPlayer(
    track: TrackEntity,
    isPlaying: Boolean,
    progressMs: Long,
    durationMs: Long,
    onTogglePlayPause: () -> Unit,
    onSkipNext: () -> Unit,
    onLikeToggle: (Boolean) -> Unit,
    onExpand: () -> Unit,
    modifier: Modifier = Modifier
) {
    val progressFraction = if (durationMs > 0) {
        (progressMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
    } else 0f

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
            .background(SoundScopeSurfaceElevated)
            .clickable(onClick = onExpand)
    ) {
        // Linear Progress Bar on Top
        LinearProgressIndicator(
            progress = { progressFraction },
            modifier = Modifier
                .fillMaxWidth()
                .height(2.dp),
            color = SoundScopePrimary,
            trackColor = SoundScopeBorder,
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Album Art
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(SoundScopeSurface),
                contentAlignment = Alignment.Center
            ) {
                if (track.coverUriString != null) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(track.coverUriString)
                            .crossfade(true)
                            .build(),
                        contentDescription = track.album,
                        modifier = Modifier.size(42.dp),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.MusicNote,
                        contentDescription = null,
                        tint = TextMuted,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Title & Artist
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = track.title,
                    color = TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = track.artist,
                    color = TextSecondary,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // Like toggle (minimum 48dp touch target)
            IconButton(
                onClick = { onLikeToggle(!track.isLiked) },
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = if (track.isLiked) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                    contentDescription = if (track.isLiked) "Remove ${track.title} from favorites" else "Add ${track.title} to favorites",
                    tint = if (track.isLiked) ColorLiked else TextMuted,
                    modifier = Modifier.size(20.dp)
                )
            }

            // Play / Pause Button (minimum 48dp touch target)
            IconButton(
                onClick = onTogglePlayPause,
                modifier = Modifier.size(48.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(SoundScopePrimary),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (isPlaying) "Pause playback" else "Resume playback",
                        tint = Color(0xFF101114),
                        modifier = Modifier.size(22.dp)
                    )
                }
            }

            // Skip Next Button (minimum 48dp touch target)
            IconButton(
                onClick = onSkipNext,
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.SkipNext,
                    contentDescription = "Skip to next track",
                    tint = TextPrimary,
                    modifier = Modifier.size(22.dp)
                )
            }
        }
    }
}
