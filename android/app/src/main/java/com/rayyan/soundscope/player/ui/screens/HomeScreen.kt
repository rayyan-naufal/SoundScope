package com.rayyan.soundscope.player.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.QueueMusic
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
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
import com.rayyan.soundscope.player.ui.components.GenreBadge
import com.rayyan.soundscope.player.ui.theme.ColorLiked
import com.rayyan.soundscope.player.ui.theme.SoundScopeBackground
import com.rayyan.soundscope.player.ui.theme.SoundScopeBorder
import com.rayyan.soundscope.player.ui.theme.SoundScopePrimary
import com.rayyan.soundscope.player.ui.theme.SoundScopePrimaryDark
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurface
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurfaceElevated
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurfaceHighlight
import com.rayyan.soundscope.player.ui.theme.TextMuted
import com.rayyan.soundscope.player.ui.theme.TextPrimary
import com.rayyan.soundscope.player.ui.theme.TextSecondary
import com.rayyan.soundscope.player.ui.theme.TextTertiary
import com.rayyan.soundscope.player.ui.viewmodel.LibraryViewModel
import com.rayyan.soundscope.player.ui.viewmodel.PlayerViewModel

@Composable
fun HomeScreen(
    libraryViewModel: LibraryViewModel,
    playerViewModel: PlayerViewModel,
    onNavigateToLibraryWithGenre: (String) -> Unit,
    onNavigateToLibraryWithDecade: (String) -> Unit,
    onNavigateToLiked: () -> Unit,
    modifier: Modifier = Modifier
) {
    val totalCount by libraryViewModel.totalTracksCount.collectAsState()
    val likedCount by libraryViewModel.likedTracksCount.collectAsState()
    val totalDurationMs by libraryViewModel.totalDurationMs.collectAsState()
    val scanProgress by libraryViewModel.scanProgress.collectAsState()
    val recentlyAdded by libraryViewModel.recentlyAddedTracks.collectAsState()
    val parentGenres by libraryViewModel.distinctParentGenres.collectAsState()
    val decades by libraryViewModel.distinctDecades.collectAsState()

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(SoundScopeBackground),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        // App Header
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "SoundScope",
                        color = TextPrimary,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Offline Music Player",
                        color = SoundScopePrimary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                // Rescan button
                IconButton(
                    onClick = { libraryViewModel.startAudioScan() },
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(SoundScopeSurfaceElevated)
                ) {
                    if (scanProgress != null && !scanProgress!!.isCompleted) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = SoundScopePrimary,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Scan Music",
                            tint = TextSecondary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }

        // Scanning Progress Banner (if scanning)
        if (scanProgress != null && !scanProgress!!.isCompleted) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 4.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(SoundScopeSurfaceElevated)
                        .border(1.dp, SoundScopeBorder, RoundedCornerShape(10.dp))
                        .padding(14.dp)
                ) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Scanning device music...",
                                color = TextPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = "${scanProgress!!.scannedCount} / ${scanProgress!!.totalCount}",
                                color = SoundScopePrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        val frac = if (scanProgress!!.totalCount > 0) {
                            scanProgress!!.scannedCount.toFloat() / scanProgress!!.totalCount.toFloat()
                        } else 0f
                        LinearProgressIndicator(
                            progress = { frac.coerceIn(0f, 1f) },
                            modifier = Modifier.fillMaxWidth().height(4.dp),
                            color = SoundScopePrimary,
                            trackColor = SoundScopeBorder
                        )
                        if (scanProgress!!.currentFileName.isNotBlank()) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = scanProgress!!.currentFileName,
                                color = TextTertiary,
                                fontSize = 11.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
        }

        // Library Stats Card
        item {
            val totalHours = ((totalDurationMs ?: 0L) / 3600000.0)
            val durationText = if (totalHours >= 1.0) {
                String.format("%.1f Hours", totalHours)
            } else {
                "${(totalDurationMs ?: 0L) / 60000} Mins"
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(
                                SoundScopeSurfaceElevated,
                                SoundScopeSurface
                            )
                        )
                    )
                    .border(1.dp, SoundScopeBorder, RoundedCornerShape(14.dp))
                    .padding(18.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    StatMetric(value = "$totalCount", label = "Tracks")
                    StatMetric(value = "$likedCount", label = "Favorites")
                    StatMetric(value = durationText, label = "Library Length")
                }
            }
        }

        // Quick Access Row (Liked Songs & Shuffle All)
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Liked Songs Card
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            Brush.linearGradient(
                                listOf(Color(0xFF3E1521), SoundScopeSurfaceElevated)
                            )
                        )
                        .border(1.dp, SoundScopeBorder, RoundedCornerShape(12.dp))
                        .clickable(onClick = onNavigateToLiked)
                        .padding(16.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(20.dp))
                                .background(ColorLiked.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Favorite,
                                contentDescription = null,
                                tint = ColorLiked,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Column {
                            Text(
                                text = "Liked Songs",
                                color = TextPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "$likedCount tracks",
                                color = TextSecondary,
                                fontSize = 11.sp
                            )
                        }
                    }
                }

                // Shuffle Library Card
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(SoundScopeSurfaceElevated)
                        .border(1.dp, SoundScopeBorder, RoundedCornerShape(12.dp))
                        .clickable {
                            val all = recentlyAdded
                            if (all.isNotEmpty()) {
                                playerViewModel.playQueue(all.shuffled(), 0)
                            }
                        }
                        .padding(16.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(20.dp))
                                .background(SoundScopePrimary.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Shuffle,
                                contentDescription = null,
                                tint = SoundScopePrimary,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Column {
                            Text(
                                text = "Shuffle All",
                                color = TextPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Quick Play",
                                color = TextSecondary,
                                fontSize = 11.sp
                            )
                        }
                    }
                }
            }
        }

        // Section: Recently Added
        if (recentlyAdded.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(16.dp))
                SectionHeader(title = "Recently Added")
                Spacer(modifier = Modifier.height(8.dp))

                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(recentlyAdded, key = { it.id }) { track ->
                        RecentTrackCard(
                            track = track,
                            onClick = { playerViewModel.playTrack(track, recentlyAdded) }
                        )
                    }
                }
            }
        }

        // Section: Explore by Parent Genre
        if (parentGenres.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(20.dp))
                SectionHeader(title = "Explore by Genre")
                Spacer(modifier = Modifier.height(8.dp))

                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(parentGenres, key = { it }) { genre ->
                        CategoryCard(
                            title = genre,
                            subtitle = "Genre",
                            onClick = { onNavigateToLibraryWithGenre(genre) }
                        )
                    }
                }
            }
        }

        // Section: Explore by Decade
        if (decades.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(20.dp))
                SectionHeader(title = "Explore by Era / Decade")
                Spacer(modifier = Modifier.height(8.dp))

                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(decades, key = { it }) { decade ->
                        CategoryCard(
                            title = decade,
                            subtitle = "Decade",
                            onClick = { onNavigateToLibraryWithDecade(decade) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun StatMetric(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            color = SoundScopePrimary,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = label,
            color = TextSecondary,
            fontSize = 11.sp
        )
    }
}

@Composable
fun SectionHeader(title: String, modifier: Modifier = Modifier) {
    Text(
        text = title,
        color = TextPrimary,
        fontSize = 17.sp,
        fontWeight = FontWeight.Bold,
        modifier = modifier.padding(horizontal = 20.dp)
    )
}

@Composable
fun RecentTrackCard(
    track: TrackEntity,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .width(130.dp)
            .clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier
                .size(130.dp)
                .clip(RoundedCornerShape(10.dp))
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
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            } else {
                Icon(
                    imageVector = Icons.Default.MusicNote,
                    contentDescription = null,
                    tint = TextMuted,
                    modifier = Modifier.size(44.dp)
                )
            }

            // Quick Play overlay button on bottom right
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(8.dp)
                    .size(30.dp)
                    .clip(RoundedCornerShape(15.dp))
                    .background(SoundScopePrimary),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = "Play",
                    tint = Color.White,
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

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
}

@Composable
fun CategoryCard(
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(SoundScopeSurfaceElevated)
            .border(1.dp, SoundScopeBorder, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 12.dp)
    ) {
        Column {
            Text(
                text = title,
                color = TextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = subtitle,
                color = SoundScopePrimary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
