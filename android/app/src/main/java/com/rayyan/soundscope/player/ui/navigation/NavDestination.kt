package com.rayyan.soundscope.player.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.QueueMusic
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Search
import androidx.compose.ui.graphics.vector.ImageVector

sealed class NavDestination(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    data object Home : NavDestination("home", "Home", Icons.Default.Home)
    data object Library : NavDestination("library", "Library", Icons.Default.LibraryMusic)
    data object Playlists : NavDestination("playlists", "Playlists", Icons.AutoMirrored.Filled.QueueMusic)
    data object Search : NavDestination("search", "Search", Icons.Default.Search)

    companion object {
        val bottomNavItems by lazy { listOf(Home, Library, Playlists, Search) }
    }
}
