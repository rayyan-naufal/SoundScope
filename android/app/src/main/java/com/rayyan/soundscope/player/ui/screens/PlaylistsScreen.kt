package com.rayyan.soundscope.player.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.QueueMusic
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rayyan.soundscope.player.data.local.entity.PlaylistEntity
import com.rayyan.soundscope.player.ui.components.TrackRowItem
import com.rayyan.soundscope.player.ui.theme.SoundScopeBackground
import com.rayyan.soundscope.player.ui.theme.SoundScopeBorder
import com.rayyan.soundscope.player.ui.theme.SoundScopePrimary
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurface
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurfaceElevated
import com.rayyan.soundscope.player.ui.theme.TextMuted
import com.rayyan.soundscope.player.ui.theme.TextPrimary
import androidx.activity.compose.BackHandler
import com.rayyan.soundscope.player.ui.theme.TextSecondary
import com.rayyan.soundscope.player.ui.viewmodel.LibraryViewModel
import com.rayyan.soundscope.player.ui.viewmodel.PlayerViewModel
import com.rayyan.soundscope.player.ui.viewmodel.PlaylistViewModel

@Composable
fun PlaylistsScreen(
    playlistViewModel: PlaylistViewModel,
    playerViewModel: PlayerViewModel,
    libraryViewModel: LibraryViewModel,
    modifier: Modifier = Modifier
) {
    val playlists by playlistViewModel.playlists.collectAsState()
    val selectedPlaylistId by playlistViewModel.selectedPlaylistId.collectAsState()
    val currentTracks by playlistViewModel.currentPlaylistTracks.collectAsState()
    val playerState by playerViewModel.playerState.collectAsState()

    var showCreateDialog by remember { mutableStateOf(false) }

    // Intercept back button when inspecting a specific playlist
    BackHandler(enabled = selectedPlaylistId != null) {
        playlistViewModel.selectPlaylist(null)
    }

    // Dialog for creating a new playlist
    if (showCreateDialog) {
        CreatePlaylistDialog(
            onDismiss = { showCreateDialog = false },
            onConfirm = { name, desc ->
                playlistViewModel.createPlaylist(name, desc)
                showCreateDialog = false
            }
        )
    }

    if (selectedPlaylistId != null) {
        // --- Playlist Detail View ---
        val selectedPlaylist = playlists.find { it.id == selectedPlaylistId }
        PlaylistDetailView(
            playlist = selectedPlaylist,
            tracks = currentTracks,
            playerState = playerState,
            onBack = { playlistViewModel.selectPlaylist(null) },
            onPlayAll = {
                if (currentTracks.isNotEmpty()) {
                    playerViewModel.playQueue(currentTracks, 0)
                }
            },
            onShuffleAll = {
                if (currentTracks.isNotEmpty()) {
                    playerViewModel.playQueue(currentTracks.shuffled(), 0)
                }
            },
            onTrackClick = { index -> playerViewModel.playQueue(currentTracks, index) },
            onLikeToggle = { track, isLiked -> libraryViewModel.toggleLike(track, isLiked) },
            onPlayNext = { track -> playerViewModel.playNext(track) },
            onAddToQueue = { track -> playerViewModel.addToQueue(track) },
            modifier = modifier
        )
    } else {
        // --- Playlists List View ---
        Column(
            modifier = modifier
                .fillMaxSize()
                .background(SoundScopeBackground)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Playlists",
                    color = TextPrimary,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )

                IconButton(
                    onClick = { showCreateDialog = true },
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
                            imageVector = Icons.Default.Add,
                            contentDescription = "Create new playlist",
                            tint = Color(0xFF101114),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            if (playlists.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.QueueMusic,
                            contentDescription = null,
                            tint = TextMuted,
                            modifier = Modifier.size(54.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "No custom playlists yet",
                            color = TextPrimary,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Tap '+' to create your first offline playlist.",
                            color = TextSecondary,
                            fontSize = 12.sp
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(playlists, key = { it.id }) { playlist ->
                        PlaylistRowItem(
                            playlist = playlist,
                            onClick = { playlistViewModel.selectPlaylist(playlist.id) },
                            onDelete = { playlistViewModel.deletePlaylist(playlist.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun PlaylistRowItem(
    playlist: PlaylistEntity,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SoundScopeSurfaceElevated)
            .border(1.dp, SoundScopeBorder, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(SoundScopeSurface),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.QueueMusic,
                contentDescription = null,
                tint = SoundScopePrimary,
                modifier = Modifier.size(24.dp)
            )
        }

        Spacer(modifier = Modifier.width(14.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = playlist.name,
                color = TextPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (playlist.description.isNotBlank()) {
                Text(
                    text = playlist.description,
                    color = TextSecondary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        IconButton(onClick = onDelete) {
            Icon(
                imageVector = Icons.Default.Delete,
                contentDescription = "Delete Playlist",
                tint = TextMuted,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@Composable
fun PlaylistDetailView(
    playlist: PlaylistEntity?,
    tracks: List<com.rayyan.soundscope.player.data.local.entity.TrackEntity>,
    playerState: com.rayyan.soundscope.player.player.PlayerState,
    onBack: () -> Unit,
    onPlayAll: () -> Unit,
    onShuffleAll: () -> Unit,
    onTrackClick: (Int) -> Unit,
    onLikeToggle: (com.rayyan.soundscope.player.data.local.entity.TrackEntity, Boolean) -> Unit,
    onPlayNext: (com.rayyan.soundscope.player.data.local.entity.TrackEntity) -> Unit,
    onAddToQueue: (com.rayyan.soundscope.player.data.local.entity.TrackEntity) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(SoundScopeBackground)
    ) {
        // Back Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = TextPrimary
                )
            }
            Text(
                text = playlist?.name ?: "Playlist",
                color = TextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        // Action Toolbar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "${tracks.size} tracks",
                color = TextSecondary,
                fontSize = 13.sp
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onPlayAll,
                    colors = ButtonDefaults.buttonColors(containerColor = SoundScopePrimary),
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.height(34.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.size(4.dp))
                    Text("Play", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }

                OutlinedButton(
                    onClick = onShuffleAll,
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.height(34.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Shuffle,
                        contentDescription = null,
                        tint = TextPrimary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.size(4.dp))
                    Text("Shuffle", color = TextPrimary, fontSize = 12.sp)
                }
            }
        }

        // Tracks List
        if (tracks.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No tracks in this playlist yet.",
                    color = TextSecondary,
                    fontSize = 14.sp
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 20.dp)
            ) {
                itemsIndexed(tracks, key = { _, t -> t.id }) { index, track ->
                    val isCurrent = playerState.currentTrack?.id == track.id
                    TrackRowItem(
                        track = track,
                        isCurrentTrack = isCurrent,
                        isPlaying = isCurrent && playerState.isPlaying,
                        onClick = { onTrackClick(index) },
                        onLikeToggle = { isLiked -> onLikeToggle(track, isLiked) },
                        onPlayNext = { onPlayNext(track) },
                        onAddToQueue = { onAddToQueue(track) },
                        onAddToPlaylist = { }
                    )
                }
            }
        }
    }
}

@Composable
fun CreatePlaylistDialog(
    onDismiss: () -> Unit,
    onConfirm: (name: String, desc: String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SoundScopeSurfaceElevated,
        title = {
            Text(
                text = "New Playlist",
                color = TextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Playlist Name", color = TextSecondary) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = desc,
                    onValueChange = { desc = it },
                    label = { Text("Description (optional)", color = TextSecondary) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { if (name.isNotBlank()) onConfirm(name, desc) },
                colors = ButtonDefaults.buttonColors(containerColor = SoundScopePrimary),
                enabled = name.isNotBlank()
            ) {
                Text("Create", color = TextPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = TextSecondary)
            }
        }
    )
}
