package com.rayyan.soundscope.player.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rayyan.soundscope.player.ui.components.MiniPlayer
import com.rayyan.soundscope.player.ui.navigation.NavDestination
import com.rayyan.soundscope.player.ui.theme.SoundScopeBackground
import com.rayyan.soundscope.player.ui.theme.SoundScopePrimary
import com.rayyan.soundscope.player.ui.theme.TextMuted
import com.rayyan.soundscope.player.ui.theme.TextSecondary
import com.rayyan.soundscope.player.ui.viewmodel.LibraryViewModel
import com.rayyan.soundscope.player.ui.viewmodel.PlayerViewModel
import com.rayyan.soundscope.player.ui.viewmodel.PlaylistViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    libraryViewModel: LibraryViewModel,
    playerViewModel: PlayerViewModel,
    playlistViewModel: PlaylistViewModel,
    modifier: Modifier = Modifier
) {
    var currentTab by remember { mutableStateOf<NavDestination>(NavDestination.Home) }
    val playerState by playerViewModel.playerState.collectAsState()
    val isNowPlayingExpanded by playerViewModel.isNowPlayingExpanded.collectAsState()
    val isQueueSheetVisible by playerViewModel.isQueueSheetVisible.collectAsState()

    // Handle back button when full-screen player is open
    BackHandler(enabled = isNowPlayingExpanded) {
        playerViewModel.setNowPlayingExpanded(false)
    }

    Box(modifier = modifier.fillMaxSize()) {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            containerColor = SoundScopeBackground,
            bottomBar = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SoundScopeBackground)
                ) {
                    // Persistent MiniPlayer bar
                    AnimatedVisibility(
                        visible = playerState.currentTrack != null,
                        enter = slideInVertically(initialOffsetY = { it }),
                        exit = slideOutVertically(targetOffsetY = { it })
                    ) {
                        playerState.currentTrack?.let { track ->
                            MiniPlayer(
                                track = track,
                                isPlaying = playerState.isPlaying,
                                progressMs = playerState.currentPositionMs,
                                durationMs = playerState.durationMs,
                                onTogglePlayPause = { playerViewModel.togglePlayPause() },
                                onSkipNext = { playerViewModel.skipToNext() },
                                onLikeToggle = { isLiked -> playerViewModel.toggleLike(track, isLiked) },
                                onExpand = { playerViewModel.setNowPlayingExpanded(true) }
                            )
                        }
                    }

                    // Bottom Navigation Bar
                    NavigationBar(
                        containerColor = SoundScopeBackground,
                        tonalElevation = 0.dp,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        NavDestination.bottomNavItems.forEach { destination ->
                            val isSelected = currentTab == destination
                            NavigationBarItem(
                                selected = isSelected,
                                onClick = { currentTab = destination },
                                icon = {
                                    Icon(
                                        imageVector = destination.icon,
                                        contentDescription = destination.title
                                    )
                                },
                                label = {
                                    Text(
                                        text = destination.title,
                                        fontSize = 11.sp,
                                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
                                    )
                                },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = SoundScopePrimary,
                                    selectedTextColor = SoundScopePrimary,
                                    unselectedIconColor = TextMuted,
                                    unselectedTextColor = TextSecondary,
                                    indicatorColor = SoundScopePrimary.copy(alpha = 0.12f)
                                )
                            )
                        }
                    }
                }
            }
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                when (currentTab) {
                    NavDestination.Home -> {
                        HomeScreen(
                            libraryViewModel = libraryViewModel,
                            playerViewModel = playerViewModel,
                            onNavigateToLibraryWithGenre = { genre ->
                                libraryViewModel.setParentGenreFilter(genre)
                                currentTab = NavDestination.Search
                            },
                            onNavigateToLibraryWithDecade = { decade ->
                                libraryViewModel.setDecadeFilter(decade)
                                currentTab = NavDestination.Search
                            },
                            onNavigateToLiked = {
                                libraryViewModel.setLikedOnlyFilter(true)
                                currentTab = NavDestination.Search
                            }
                        )
                    }

                    NavDestination.Library -> {
                        LibraryScreen(
                            libraryViewModel = libraryViewModel,
                            playerViewModel = playerViewModel,
                            playlistViewModel = playlistViewModel
                        )
                    }

                    NavDestination.Playlists -> {
                        PlaylistsScreen(
                            playlistViewModel = playlistViewModel,
                            playerViewModel = playerViewModel,
                            libraryViewModel = libraryViewModel
                        )
                    }

                    NavDestination.Search -> {
                        SearchScreen(
                            libraryViewModel = libraryViewModel,
                            playerViewModel = playerViewModel
                        )
                    }
                }
            }
        }

        // Full-screen Now Playing overlay
        AnimatedVisibility(
            visible = isNowPlayingExpanded,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
        ) {
            NowPlayingScreen(
                playerViewModel = playerViewModel,
                onCollapse = { playerViewModel.setNowPlayingExpanded(false) }
            )
        }

        // Slide-up Queue Bottom Sheet
        if (isQueueSheetVisible) {
            QueueBottomSheet(
                playerViewModel = playerViewModel,
                onDismiss = { playerViewModel.setQueueSheetVisible(false) }
            )
        }
    }
}
