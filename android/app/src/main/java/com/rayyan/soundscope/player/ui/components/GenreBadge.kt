package com.rayyan.soundscope.player.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rayyan.soundscope.player.data.taxonomy.GenreTaxonomy
import com.rayyan.soundscope.player.ui.theme.BadgeBackground
import com.rayyan.soundscope.player.ui.theme.BadgeBorder
import com.rayyan.soundscope.player.ui.theme.BadgeText
import com.rayyan.soundscope.player.ui.theme.TempoFastBorder
import com.rayyan.soundscope.player.ui.theme.TempoFastColor
import com.rayyan.soundscope.player.ui.theme.TempoFastDim
import com.rayyan.soundscope.player.ui.theme.TempoMidBorder
import com.rayyan.soundscope.player.ui.theme.TempoMidColor
import com.rayyan.soundscope.player.ui.theme.TempoMidDim
import com.rayyan.soundscope.player.ui.theme.TempoSlowBorder
import com.rayyan.soundscope.player.ui.theme.TempoSlowColor
import com.rayyan.soundscope.player.ui.theme.TempoSlowDim
import com.rayyan.soundscope.player.ui.theme.TempoVeryFastBorder
import com.rayyan.soundscope.player.ui.theme.TempoVeryFastColor
import com.rayyan.soundscope.player.ui.theme.TempoVeryFastDim

@Composable
fun GenreBadge(
    text: String,
    modifier: Modifier = Modifier,
    backgroundColor: Color = BadgeBackground,
    borderColor: Color = BadgeBorder,
    textColor: Color = BadgeText,
    onClick: (() -> Unit)? = null
) {
    val clickModifier = if (onClick != null) modifier.clickable(onClick = onClick) else modifier

    Box(
        modifier = clickModifier
            .background(backgroundColor, RoundedCornerShape(4.dp))
            .border(1.dp, borderColor, RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(
            text = text,
            color = textColor,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1
        )
    }
}

@Composable
fun TempoBadge(
    tempo: String,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    val (label, bg, border, text) = when {
        GenreTaxonomy.matchTempo(tempo, "Very Fast") -> Quadruple(
            "🔥 $tempo",
            TempoVeryFastDim,
            TempoVeryFastBorder,
            TempoVeryFastColor
        )
        GenreTaxonomy.matchTempo(tempo, "Fast") -> Quadruple(
            "⚡ $tempo",
            TempoFastDim,
            TempoFastBorder,
            TempoFastColor
        )
        GenreTaxonomy.matchTempo(tempo, "Mid-tempo") -> Quadruple(
            "🚶 $tempo",
            TempoMidDim,
            TempoMidBorder,
            TempoMidColor
        )
        GenreTaxonomy.matchTempo(tempo, "Slow") -> Quadruple(
            "🐢 $tempo",
            TempoSlowDim,
            TempoSlowBorder,
            TempoSlowColor
        )
        else -> Quadruple(
            tempo,
            BadgeBackground,
            BadgeBorder,
            BadgeText
        )
    }

    GenreBadge(
        text = label,
        modifier = modifier,
        backgroundColor = bg,
        borderColor = border,
        textColor = text,
        onClick = onClick
    )
}

private data class Quadruple<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)
