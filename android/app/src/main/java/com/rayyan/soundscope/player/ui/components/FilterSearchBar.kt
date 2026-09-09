package com.rayyan.soundscope.player.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rayyan.soundscope.player.ui.theme.ColorLiked
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
import com.rayyan.soundscope.player.ui.viewmodel.PlayerFilterOptions

@Composable
fun FilterSearchBar(
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    filterOptions: PlayerFilterOptions,
    selectedDecade: String?,
    onSelectDecade: (String?) -> Unit,
    selectedParentGenre: String?,
    onSelectParentGenre: (String?) -> Unit,
    selectedGenre: String?,
    onSelectGenre: (String?) -> Unit,
    selectedSubGenre: String?,
    onSelectSubGenre: (String?) -> Unit,
    selectedTempo: String?,
    onSelectTempo: (String?) -> Unit,
    isLikedOnly: Boolean,
    onToggleLikedOnly: () -> Unit,
    onResetAllFilters: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SoundScopeSurface)
            .border(1.dp, SoundScopeBorder, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // --- 1. Search Bar with Active Reset Badge ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Search Input Box
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(SoundScopeSurfaceElevated)
                    .border(1.dp, SoundScopeBorderSubtle, RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp),
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
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))

                    Box(modifier = Modifier.weight(1f)) {
                        if (searchQuery.isEmpty()) {
                            Text(
                                text = "Search title, artist, album, genre...",
                                color = TextMuted,
                                fontSize = 12.sp
                            )
                        }
                        BasicTextField(
                            value = searchQuery,
                            onValueChange = onSearchChange,
                            singleLine = true,
                            textStyle = TextStyle(
                                color = TextPrimary,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Normal
                            ),
                            cursorBrush = SolidColor(SoundScopePrimary),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    if (searchQuery.isNotEmpty()) {
                        IconButton(
                            onClick = { onSearchChange("") },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Clear search",
                                tint = TextSecondary,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }
                }
            }

            // Reset Button with Active Badge (if any filter is active)
            if (filterOptions.activeFilterCount > 0) {
                Spacer(modifier = Modifier.width(8.dp))
                Row(
                    modifier = Modifier
                        .height(32.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(SoundScopePrimaryDim)
                        .border(1.dp, SoundScopePrimary.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
                        .clickable(onClick = onResetAllFilters)
                        .padding(horizontal = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Reset Filters",
                        tint = SoundScopePrimary,
                        modifier = Modifier.size(13.dp)
                    )
                    Text(
                        text = "${filterOptions.activeFilterCount} active",
                        color = SoundScopePrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        // --- 2. Cascading Taxonomy Dropdown Chips Row ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Decades Selector
            FilterDropdownChip(
                icon = "📅",
                label = "Decades",
                selectedValue = selectedDecade,
                items = filterOptions.availableDecades,
                counts = filterOptions.decadeCounts,
                allLabel = "All Decades",
                totalCount = filterOptions.totalBaseCount,
                onSelect = onSelectDecade
            )

            // Parent Genre Selector
            FilterDropdownChip(
                icon = "🏷️",
                label = "Parent Genre",
                selectedValue = selectedParentGenre,
                items = filterOptions.availableParents,
                counts = filterOptions.parentCounts,
                allLabel = "All Parents",
                totalCount = filterOptions.totalBaseCount,
                onSelect = onSelectParentGenre
            )

            // Core Genre Selector (Dependent on Parent & Decade)
            FilterDropdownChip(
                icon = "🎸",
                label = "Genre",
                selectedValue = selectedGenre,
                items = filterOptions.availableGenres,
                counts = filterOptions.genreCounts,
                allLabel = "All Genres",
                totalCount = filterOptions.parentCounts[selectedParentGenre] ?: filterOptions.totalBaseCount,
                onSelect = onSelectGenre
            )

            // Sub-Genre Selector (Dependent on Core Genre, Parent, Decade)
            FilterDropdownChip(
                icon = "🎛️",
                label = "Subgenre",
                selectedValue = selectedSubGenre,
                items = filterOptions.availableSubGenres,
                counts = filterOptions.subGenreCounts,
                allLabel = "All Subgenres",
                totalCount = filterOptions.genreCounts[selectedGenre] ?: filterOptions.totalBaseCount,
                onSelect = onSelectSubGenre
            )

            // Tempo Selector
            FilterDropdownChip(
                icon = "⚡",
                label = "Tempo",
                selectedValue = selectedTempo,
                items = filterOptions.availableTempos,
                counts = filterOptions.tempoCounts,
                allLabel = "All Tempos",
                totalCount = filterOptions.subGenreCounts[selectedSubGenre] ?: filterOptions.totalBaseCount,
                onSelect = onSelectTempo
            )
        }

        // --- 3. Quick Pills Row (Liked + Tempo Quick Toggles) ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Liked Only Pill
            QuickPill(
                isSelected = isLikedOnly,
                onClick = onToggleLikedOnly,
                selectedBg = ColorLiked.copy(alpha = 0.2f),
                selectedBorder = ColorLiked,
                selectedText = ColorLiked
            ) {
                Icon(
                    imageVector = Icons.Default.Favorite,
                    contentDescription = "Liked only",
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

            // Quick Tempo Pills (Slow, Mid, Fast, Very Fast)
            val slowCount = filterOptions.tempoCounts["Slow"] ?: 0
            if (slowCount > 0 || selectedTempo == "Slow") {
                QuickPill(
                    isSelected = selectedTempo == "Slow",
                    onClick = { onSelectTempo(if (selectedTempo == "Slow") null else "Slow") },
                    selectedBg = TempoSlowColor.copy(alpha = 0.2f),
                    selectedBorder = TempoSlowColor,
                    selectedText = TempoSlowColor
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
                QuickPill(
                    isSelected = selectedTempo == "Mid-tempo",
                    onClick = { onSelectTempo(if (selectedTempo == "Mid-tempo") null else "Mid-tempo") },
                    selectedBg = TempoMidColor.copy(alpha = 0.2f),
                    selectedBorder = TempoMidColor,
                    selectedText = TempoMidColor
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
                QuickPill(
                    isSelected = selectedTempo == "Fast",
                    onClick = { onSelectTempo(if (selectedTempo == "Fast") null else "Fast") },
                    selectedBg = TempoFastColor.copy(alpha = 0.2f),
                    selectedBorder = TempoFastColor,
                    selectedText = TempoFastColor
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
                QuickPill(
                    isSelected = selectedTempo == "Very Fast",
                    onClick = { onSelectTempo(if (selectedTempo == "Very Fast") null else "Very Fast") },
                    selectedBg = TempoVeryFastColor.copy(alpha = 0.2f),
                    selectedBorder = TempoVeryFastColor,
                    selectedText = TempoVeryFastColor
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
    }
}

@Composable
private fun FilterDropdownChip(
    icon: String,
    label: String,
    selectedValue: String?,
    items: List<String>,
    counts: Map<String, Int>,
    allLabel: String,
    totalCount: Int,
    onSelect: (String?) -> Unit
) {
    var isExpanded by remember { mutableStateOf(false) }
    val isActive = selectedValue != null

    val displayText = if (selectedValue != null) {
        val count = counts[selectedValue] ?: 0
        "$icon $selectedValue ($count)"
    } else {
        "$icon $label"
    }

    Box {
        Row(
            modifier = Modifier
                .height(30.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(
                    if (isActive) SoundScopePrimaryDim else SoundScopeSurfaceElevated
                )
                .border(
                    width = 1.dp,
                    color = if (isActive) SoundScopePrimary else SoundScopeBorder,
                    shape = RoundedCornerShape(6.dp)
                )
                .clickable { isExpanded = true }
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp)
        ) {
            Text(
                text = displayText,
                color = if (isActive) SoundScopePrimary else TextSecondary,
                fontSize = 11.sp,
                fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Normal
            )
            Icon(
                imageVector = Icons.Default.ArrowDropDown,
                contentDescription = null,
                tint = if (isActive) SoundScopePrimary else TextTertiary,
                modifier = Modifier.size(16.dp)
            )
        }

        DropdownMenu(
            expanded = isExpanded,
            onDismissRequest = { isExpanded = false },
            modifier = Modifier
                .background(SoundScopeSurfaceElevated)
                .border(1.dp, SoundScopeBorder, RoundedCornerShape(6.dp))
                .heightIn(max = 280.dp)
        ) {
            // "All" option
            DropdownMenuItem(
                text = {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = allLabel,
                            color = if (selectedValue == null) SoundScopePrimary else TextPrimary,
                            fontWeight = if (selectedValue == null) FontWeight.Bold else FontWeight.Normal,
                            fontSize = 12.sp
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "($totalCount)",
                            color = TextTertiary,
                            fontSize = 11.sp
                        )
                    }
                },
                onClick = {
                    isExpanded = false
                    onSelect(null)
                }
            )

            items.forEach { item ->
                val count = counts[item] ?: 0
                val isItemSelected = selectedValue == item
                DropdownMenuItem(
                    text = {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = item,
                                color = if (isItemSelected) SoundScopePrimary else TextPrimary,
                                fontWeight = if (isItemSelected) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 12.sp
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "($count)",
                                color = if (isItemSelected) SoundScopePrimary else TextTertiary,
                                fontSize = 11.sp
                            )
                        }
                    },
                    onClick = {
                        isExpanded = false
                        onSelect(item)
                    }
                )
            }
        }
    }
}

@Composable
private fun QuickPill(
    isSelected: Boolean,
    onClick: () -> Unit,
    selectedBg: Color = SoundScopePrimaryDim,
    selectedBorder: Color = SoundScopePrimary,
    selectedText: Color = SoundScopePrimary,
    content: @Composable () -> Unit
) {
    Row(
        modifier = Modifier
            .height(26.dp)
            .clip(CircleShape)
            .background(if (isSelected) selectedBg else SoundScopeSurfaceElevated)
            .border(
                1.dp,
                if (isSelected) selectedBorder else SoundScopeBorderSubtle,
                CircleShape
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        content()
    }
}
