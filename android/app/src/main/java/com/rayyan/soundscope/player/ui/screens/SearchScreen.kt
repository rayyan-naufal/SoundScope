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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rayyan.soundscope.player.ui.components.TrackRowItem
import com.rayyan.soundscope.player.ui.theme.ColorLiked
import com.rayyan.soundscope.player.ui.theme.SoundScopeBackground
import com.rayyan.soundscope.player.ui.theme.SoundScopeBorder
import com.rayyan.soundscope.player.ui.theme.SoundScopeBorderSubtle
import com.rayyan.soundscope.player.ui.theme.SoundScopePrimary
import com.rayyan.soundscope.player.ui.theme.SoundScopePrimaryDim
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurface
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurfaceElevated
import com.rayyan.soundscope.player.ui.theme.SoundScopeSurfaceHighlight
import com.rayyan.soundscope.player.ui.theme.TempoFastColor
import com.rayyan.soundscope.player.ui.theme.TempoMidColor
import com.rayyan.soundscope.player.ui.theme.TempoSlowColor
import com.rayyan.soundscope.player.ui.theme.TempoVeryFastColor
import com.rayyan.soundscope.player.ui.theme.TextMuted
import com.rayyan.soundscope.player.ui.theme.TextPrimary
import com.rayyan.soundscope.player.ui.theme.TextSecondary
import com.rayyan.soundscope.player.ui.theme.TextTertiary
import com.rayyan.soundscope.player.ui.viewmodel.LibraryViewModel
import com.rayyan.soundscope.player.ui.viewmodel.PlayerViewModel

private enum class FilterSheetType {
    DECADE,
    PARENT_GENRE,
    GENRE,
    SUBGENRE,
    TEMPO
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    libraryViewModel: LibraryViewModel,
    playerViewModel: PlayerViewModel,
    modifier: Modifier = Modifier
) {
    val searchQuery by libraryViewModel.searchQuery.collectAsState()
    val searchResults by libraryViewModel.tracks.collectAsState()
    val filterOptions by libraryViewModel.filterOptions.collectAsState()
    val filteredDurationMs by libraryViewModel.filteredDurationMs.collectAsState()

    val selectedDecade by libraryViewModel.selectedDecade.collectAsState()
    val selectedParentGenre by libraryViewModel.selectedParentGenre.collectAsState()
    val selectedGenre by libraryViewModel.selectedGenre.collectAsState()
    val selectedSubGenre by libraryViewModel.selectedSubGenre.collectAsState()
    val selectedTempo by libraryViewModel.selectedTempo.collectAsState()
    val isLikedOnly by libraryViewModel.isLikedOnly.collectAsState()

    val playerState by playerViewModel.playerState.collectAsState()

    var activeSheet by remember { mutableStateOf<FilterSheetType?>(null) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(SoundScopeBackground)
    ) {
        // --- 1. Top Header ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Filter & Search",
                    color = TextPrimary,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = if (filterOptions.activeFilterCount > 0)
                        "${filterOptions.activeFilterCount} active filters • ${searchResults.size} tracks"
                    else
                        "Explore library by decade, genre, subgenre & tempo",
                    color = TextTertiary,
                    fontSize = 11.sp
                )
            }

            if (filterOptions.activeFilterCount > 0) {
                Row(
                    modifier = Modifier
                        .height(30.dp)
                        .clip(RoundedCornerShape(15.dp))
                        .background(SoundScopePrimaryDim)
                        .border(1.dp, SoundScopePrimary.copy(alpha = 0.4f), RoundedCornerShape(15.dp))
                        .clickable { libraryViewModel.clearAllFilters() }
                        .padding(horizontal = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Reset All Filters",
                        tint = SoundScopePrimary,
                        modifier = Modifier.size(13.dp)
                    )
                    Text(
                        text = "Reset (${filterOptions.activeFilterCount})",
                        color = SoundScopePrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        // --- 2. Search Text Input ---
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp)
                .height(44.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(SoundScopeSurfaceElevated)
                .border(1.dp, SoundScopeBorderSubtle, RoundedCornerShape(10.dp))
                .padding(horizontal = 12.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Search",
                    tint = if (searchQuery.isNotEmpty()) SoundScopePrimary else TextSecondary,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))

                Box(modifier = Modifier.weight(1f)) {
                    if (searchQuery.isEmpty()) {
                        Text(
                            text = "Search by title, artist, album, genre...",
                            color = TextMuted,
                            fontSize = 13.sp
                        )
                    }
                    BasicTextField(
                        value = searchQuery,
                        onValueChange = { libraryViewModel.setSearchQuery(it) },
                        singleLine = true,
                        textStyle = TextStyle(
                            color = TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Normal
                        ),
                        cursorBrush = SolidColor(SoundScopePrimary),
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                if (searchQuery.isNotEmpty()) {
                    IconButton(
                        onClick = { libraryViewModel.setSearchQuery("") },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Clear,
                            contentDescription = "Clear search",
                            tint = TextSecondary,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }

        // --- 3. Cascading Taxonomy Filter Selectors (Decades, Parent Genre, Genre, Subgenre, Tempo) ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp, bottom = 4.dp)
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 📅 Decades Chip
            SearchFilterChip(
                icon = "📅",
                label = "Decades",
                selectedValue = selectedDecade,
                count = if (selectedDecade != null) filterOptions.decadeCounts[selectedDecade] else null,
                onClick = { activeSheet = FilterSheetType.DECADE },
                onClear = { libraryViewModel.setDecadeFilter(null) }
            )

            // 🏷️ Parent Genre Chip
            SearchFilterChip(
                icon = "🏷️",
                label = "Parent Genre",
                selectedValue = selectedParentGenre,
                count = if (selectedParentGenre != null) filterOptions.parentCounts[selectedParentGenre] else null,
                onClick = { activeSheet = FilterSheetType.PARENT_GENRE },
                onClear = { libraryViewModel.setParentGenreFilter(null) }
            )

            // 🎸 Core Genre Chip (Cascading)
            SearchFilterChip(
                icon = "🎸",
                label = "Genre",
                selectedValue = selectedGenre,
                count = if (selectedGenre != null) filterOptions.genreCounts[selectedGenre] else null,
                onClick = { activeSheet = FilterSheetType.GENRE },
                onClear = { libraryViewModel.setGenreFilter(null) }
            )

            // 🎛️ Sub-genre Chip (Cascading)
            SearchFilterChip(
                icon = "🎛️",
                label = "Subgenre",
                selectedValue = selectedSubGenre,
                count = if (selectedSubGenre != null) filterOptions.subGenreCounts[selectedSubGenre] else null,
                onClick = { activeSheet = FilterSheetType.SUBGENRE },
                onClear = { libraryViewModel.setSubGenreFilter(null) }
            )

            // ⚡ Tempo Chip
            SearchFilterChip(
                icon = "⚡",
                label = "Tempo",
                selectedValue = selectedTempo,
                count = if (selectedTempo != null) filterOptions.tempoCounts[selectedTempo] else null,
                onClick = { activeSheet = FilterSheetType.TEMPO },
                onClear = { libraryViewModel.setTempoFilter(null) }
            )
        }

        // --- 4. Quick Pills Row (Favorites + Tempo Quick Toggles) ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp)
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Liked Only Pill
            QuickSearchPill(
                isSelected = isLikedOnly,
                onClick = { libraryViewModel.setLikedOnlyFilter(!isLikedOnly) },
                activeColor = ColorLiked,
                activeBg = ColorLiked.copy(alpha = 0.2f)
            ) {
                Icon(
                    imageVector = Icons.Default.Favorite,
                    contentDescription = "Liked",
                    tint = if (isLikedOnly) ColorLiked else TextMuted,
                    modifier = Modifier.size(12.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "Favorites",
                    fontSize = 11.sp,
                    fontWeight = if (isLikedOnly) FontWeight.Bold else FontWeight.Normal,
                    color = if (isLikedOnly) ColorLiked else TextSecondary
                )
            }

            // Tempo Pills (Slow, Mid, Fast, Very Fast)
            val slowCount = filterOptions.tempoCounts["Slow"] ?: 0
            if (slowCount > 0 || selectedTempo == "Slow") {
                QuickSearchPill(
                    isSelected = selectedTempo == "Slow",
                    onClick = { libraryViewModel.setTempoFilter(if (selectedTempo == "Slow") null else "Slow") },
                    activeColor = TempoSlowColor,
                    activeBg = TempoSlowColor.copy(alpha = 0.2f)
                ) {
                    Text(
                        text = "🐢 Slow ($slowCount)",
                        fontSize = 11.sp,
                        fontWeight = if (selectedTempo == "Slow") FontWeight.Bold else FontWeight.Normal,
                        color = if (selectedTempo == "Slow") TempoSlowColor else TextSecondary
                    )
                }
            }

            val midCount = filterOptions.tempoCounts["Mid-tempo"] ?: 0
            if (midCount > 0 || selectedTempo == "Mid-tempo") {
                QuickSearchPill(
                    isSelected = selectedTempo == "Mid-tempo",
                    onClick = { libraryViewModel.setTempoFilter(if (selectedTempo == "Mid-tempo") null else "Mid-tempo") },
                    activeColor = TempoMidColor,
                    activeBg = TempoMidColor.copy(alpha = 0.2f)
                ) {
                    Text(
                        text = "🚶 Mid ($midCount)",
                        fontSize = 11.sp,
                        fontWeight = if (selectedTempo == "Mid-tempo") FontWeight.Bold else FontWeight.Normal,
                        color = if (selectedTempo == "Mid-tempo") TempoMidColor else TextSecondary
                    )
                }
            }

            val fastCount = filterOptions.tempoCounts["Fast"] ?: 0
            if (fastCount > 0 || selectedTempo == "Fast") {
                QuickSearchPill(
                    isSelected = selectedTempo == "Fast",
                    onClick = { libraryViewModel.setTempoFilter(if (selectedTempo == "Fast") null else "Fast") },
                    activeColor = TempoFastColor,
                    activeBg = TempoFastColor.copy(alpha = 0.2f)
                ) {
                    Text(
                        text = "⚡ Fast ($fastCount)",
                        fontSize = 11.sp,
                        fontWeight = if (selectedTempo == "Fast") FontWeight.Bold else FontWeight.Normal,
                        color = if (selectedTempo == "Fast") TempoFastColor else TextSecondary
                    )
                }
            }

            val vfastCount = filterOptions.tempoCounts["Very Fast"] ?: 0
            if (vfastCount > 0 || selectedTempo == "Very Fast") {
                QuickSearchPill(
                    isSelected = selectedTempo == "Very Fast",
                    onClick = { libraryViewModel.setTempoFilter(if (selectedTempo == "Very Fast") null else "Very Fast") },
                    activeColor = TempoVeryFastColor,
                    activeBg = TempoVeryFastColor.copy(alpha = 0.2f)
                ) {
                    Text(
                        text = "🔥 V.Fast ($vfastCount)",
                        fontSize = 11.sp,
                        fontWeight = if (selectedTempo == "Very Fast") FontWeight.Bold else FontWeight.Normal,
                        color = if (selectedTempo == "Very Fast") TempoVeryFastColor else TextSecondary
                    )
                }
            }
        }

        // --- 5. Action Bar (Results Count, Total Duration, Play All, Shuffle) ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "${searchResults.size} tracks • ${formatDurationSummary(filteredDurationMs)}",
                color = TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        if (searchResults.isNotEmpty()) {
                            playerViewModel.playQueue(searchResults, 0)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = SoundScopePrimary,
                        contentColor = Color(0xFF101114)
                    ),
                    shape = RoundedCornerShape(20.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                    modifier = Modifier.height(30.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = null,
                        modifier = Modifier.size(15.dp)
                    )
                    Spacer(modifier = Modifier.width(3.dp))
                    Text("Play All", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                OutlinedButton(
                    onClick = {
                        if (searchResults.isNotEmpty()) {
                            playerViewModel.playQueue(searchResults.shuffled(), 0)
                        }
                    },
                    shape = RoundedCornerShape(20.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    modifier = Modifier
                        .height(30.dp)
                        .border(1.dp, SoundScopeBorder, RoundedCornerShape(20.dp))
                ) {
                    Icon(
                        imageVector = Icons.Default.Shuffle,
                        contentDescription = null,
                        tint = TextPrimary,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(3.dp))
                    Text("Shuffle", color = TextPrimary, fontSize = 11.sp)
                }
            }
        }

        // --- 6. Track Results List ---
        if (searchResults.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.FilterList,
                        contentDescription = null,
                        tint = TextMuted,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "No matching songs found",
                        color = TextPrimary,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = if (filterOptions.activeFilterCount > 0)
                            "Try loosening your filters or resetting."
                        else
                            "Try searching with another keyword.",
                        color = TextSecondary,
                        fontSize = 12.sp
                    )
                    if (filterOptions.activeFilterCount > 0) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { libraryViewModel.clearAllFilters() },
                            colors = ButtonDefaults.buttonColors(containerColor = SoundScopePrimaryDim),
                            border = androidx.compose.foundation.BorderStroke(1.dp, SoundScopePrimary),
                            shape = RoundedCornerShape(20.dp)
                        ) {
                            Text("Clear All Filters", color = SoundScopePrimary, fontSize = 12.sp)
                        }
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 24.dp)
            ) {
                itemsIndexed(searchResults, key = { _, t -> t.id }) { index, track ->
                    val isCurrent = playerState.currentTrack?.id == track.id
                    TrackRowItem(
                        track = track,
                        isCurrentTrack = isCurrent,
                        isPlaying = isCurrent && playerState.isPlaying,
                        onClick = { playerViewModel.playQueue(searchResults, index) },
                        onLikeToggle = { isLiked -> libraryViewModel.toggleLike(track, isLiked) },
                        onPlayNext = { playerViewModel.playNext(track) },
                        onAddToQueue = { playerViewModel.addToQueue(track) },
                        onAddToPlaylist = { }
                    )
                }
            }
        }
    }

    // --- 7. Modal Bottom Sheet for Taxonomy Pickers ---
    activeSheet?.let { sheetType ->
        val (title, icon, items, counts, selectedValue, totalCount) = when (sheetType) {
            FilterSheetType.DECADE -> Sextuple(
                "Select Decade",
                "📅",
                filterOptions.availableDecades,
                filterOptions.decadeCounts,
                selectedDecade,
                filterOptions.totalBaseCount
            )
            FilterSheetType.PARENT_GENRE -> Sextuple(
                "Select Parent Genre",
                "🏷️",
                filterOptions.availableParents,
                filterOptions.parentCounts,
                selectedParentGenre,
                filterOptions.totalBaseCount
            )
            FilterSheetType.GENRE -> Sextuple(
                "Select Core Genre",
                "🎸",
                filterOptions.availableGenres,
                filterOptions.genreCounts,
                selectedGenre,
                filterOptions.parentCounts[selectedParentGenre] ?: filterOptions.totalBaseCount
            )
            FilterSheetType.SUBGENRE -> Sextuple(
                "Select Subgenre",
                "🎛️",
                filterOptions.availableSubGenres,
                filterOptions.subGenreCounts,
                selectedSubGenre,
                filterOptions.genreCounts[selectedGenre] ?: filterOptions.totalBaseCount
            )
            FilterSheetType.TEMPO -> Sextuple(
                "Select Tempo / Pace",
                "⚡",
                filterOptions.availableTempos,
                filterOptions.tempoCounts,
                selectedTempo,
                filterOptions.subGenreCounts[selectedSubGenre] ?: filterOptions.totalBaseCount
            )
        }

        TaxonomyFilterBottomSheet(
            title = title,
            icon = icon,
            items = items,
            counts = counts,
            selectedValue = selectedValue,
            totalCount = totalCount,
            onDismiss = { activeSheet = null },
            onSelect = { selectedItem ->
                when (sheetType) {
                    FilterSheetType.DECADE -> libraryViewModel.setDecadeFilter(selectedItem)
                    FilterSheetType.PARENT_GENRE -> libraryViewModel.setParentGenreFilter(selectedItem)
                    FilterSheetType.GENRE -> libraryViewModel.setGenreFilter(selectedItem)
                    FilterSheetType.SUBGENRE -> libraryViewModel.setSubGenreFilter(selectedItem)
                    FilterSheetType.TEMPO -> libraryViewModel.setTempoFilter(selectedItem)
                }
                activeSheet = null
            }
        )
    }
}

@Composable
private fun SearchFilterChip(
    icon: String,
    label: String,
    selectedValue: String?,
    count: Int?,
    onClick: () -> Unit,
    onClear: () -> Unit
) {
    val isActive = selectedValue != null
    val displayText = if (isActive) "$icon $selectedValue ($count)" else "$icon $label"

    Row(
        modifier = Modifier
            .height(32.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(if (isActive) SoundScopePrimaryDim else SoundScopeSurfaceElevated)
            .border(
                1.dp,
                if (isActive) SoundScopePrimary else SoundScopeBorder,
                RoundedCornerShape(8.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = displayText,
            color = if (isActive) SoundScopePrimary else TextSecondary,
            fontSize = 11.sp,
            fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Normal
        )

        if (isActive) {
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = "Clear $label",
                tint = SoundScopePrimary,
                modifier = Modifier
                    .size(14.dp)
                    .clickable(onClick = onClear)
            )
        } else {
            Icon(
                imageVector = Icons.Default.ArrowDropDown,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
private fun QuickSearchPill(
    isSelected: Boolean,
    onClick: () -> Unit,
    activeColor: Color,
    activeBg: Color,
    content: @Composable () -> Unit
) {
    Row(
        modifier = Modifier
            .height(28.dp)
            .clip(CircleShape)
            .background(if (isSelected) activeBg else SoundScopeSurfaceElevated)
            .border(
                1.dp,
                if (isSelected) activeColor else SoundScopeBorderSubtle,
                CircleShape
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        content()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TaxonomyFilterBottomSheet(
    title: String,
    icon: String,
    items: List<String>,
    counts: Map<String, Int>,
    selectedValue: String?,
    totalCount: Int,
    onDismiss: () -> Unit,
    onSelect: (String?) -> Unit
) {
    var searchFilter by remember { mutableStateOf("") }
    val sheetState = rememberModalBottomSheetState()

    val filteredItems = remember(items, searchFilter) {
        if (searchFilter.isBlank()) items
        else items.filter { it.contains(searchFilter.trim(), ignoreCase = true) }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = SoundScopeSurface,
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(vertical = 10.dp)
                    .width(36.dp)
                    .height(4.dp)
                    .clip(CircleShape)
                    .background(SoundScopeBorder)
            )
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
        ) {
            // Title Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "$icon $title",
                    color = TextPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )

                if (selectedValue != null) {
                    Text(
                        text = "Clear selection",
                        color = SoundScopePrimary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable { onSelect(null) }
                    )
                }
            }

            // In-sheet search box (useful when there are many genres/subgenres)
            if (items.size > 8) {
                Spacer(modifier = Modifier.height(10.dp))
                TextField(
                    value = searchFilter,
                    onValueChange = { searchFilter = it },
                    placeholder = { Text("Filter options...", color = TextMuted, fontSize = 12.sp) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(46.dp)
                        .clip(RoundedCornerShape(8.dp)),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = SoundScopeSurfaceElevated,
                        unfocusedContainerColor = SoundScopeSurfaceElevated,
                        cursorColor = SoundScopePrimary,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent
                    ),
                    singleLine = true
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Option List
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(340.dp)
            ) {
                // "All" option
                item {
                    val isAllSelected = selectedValue == null
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isAllSelected) SoundScopePrimaryDim else Color.Transparent)
                            .clickable { onSelect(null) }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "All ($totalCount)",
                            color = if (isAllSelected) SoundScopePrimary else TextPrimary,
                            fontWeight = if (isAllSelected) FontWeight.Bold else FontWeight.Medium,
                            fontSize = 14.sp
                        )

                        if (isAllSelected) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = null,
                                tint = SoundScopePrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }

                // Individual taxonomy options
                items(filteredItems, key = { it }) { item ->
                    val isItemSelected = selectedValue == item
                    val count = counts[item] ?: 0

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isItemSelected) SoundScopePrimaryDim else Color.Transparent)
                            .clickable { onSelect(item) }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = item,
                            color = if (isItemSelected) SoundScopePrimary else TextPrimary,
                            fontWeight = if (isItemSelected) FontWeight.Bold else FontWeight.Normal,
                            fontSize = 14.sp
                        )

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "($count)",
                                color = if (isItemSelected) SoundScopePrimary else TextTertiary,
                                fontSize = 12.sp
                            )
                            if (isItemSelected) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = SoundScopePrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun formatDurationSummary(durationMs: Long): String {
    val totalSeconds = (durationMs / 1000).coerceAtLeast(0)
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    return if (hours > 0) {
        "$hours hr $minutes min"
    } else {
        "$minutes min"
    }
}

private data class Sextuple<A, B, C, D, E, F>(
    val first: A,
    val second: B,
    val third: C,
    val fourth: D,
    val fifth: E,
    val sixth: F
)
