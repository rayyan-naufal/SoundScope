package com.rayyan.soundscope.player.ui.theme

import androidx.compose.ui.graphics.Color

// ============================================================
// SoundScope — Professional Audio Tool Design System
// Aesthetic: Mp3tag × MusicBee × Spotify desktop × Ableton Live
// Exact match with static/styles.css
// ============================================================

// Base Background & Surfaces
val SoundScopeBackground = Color(0xFF101114)        // --bg: #101114 (app background)
val SoundScopeSurface = Color(0xFF16181D)           // --surface: #16181D (panels, table, cards)
val SoundScopeSurfaceElevated = Color(0xFF1C1F26)   // --surface-hover: #1C1F26 (hover, dropdowns, elevated)
val SoundScopeSurfaceHighlight = Color(0xFF20242C)  // --surface-active: #20242C (active row, selected item)

// Borders
val SoundScopeBorder = Color(0xFF262A33)            // --border: #262A33 (borders)
val SoundScopeBorderSubtle = Color(0x0FFFFFFF)      // --border-subtle: rgba(255, 255, 255, 0.06)

// Brand Accents — SoundScope Amber Gold (the ONLY signature accent)
val SoundScopePrimary = Color(0xFFE8A33D)           // --accent: #E8A33D
val SoundScopePrimaryLight = Color(0xFFF0B050)      // --accent-hover: #F0B050
val SoundScopePrimaryDark = Color(0xFFC68424)       // Darker shade for containers
val SoundScopePrimaryDim = Color(0x1FE8A33D)        // --accent-dim: rgba(232, 163, 61, 0.12)

// Typography & Neutrals
val TextPrimary = Color(0xFFE7E9EC)                 // --text: #E7E9EC (primary text)
val TextSecondary = Color(0xFF9AA0AA)               // --text-2: #9AA0AA (secondary text)
val TextTertiary = Color(0xFF666D78)                // --text-3: #666D78 (muted labels, counts, hints)
val TextMuted = Color(0xFF666D78)

// Status & Indicators
val ColorSuccess = Color(0xFF3FB950)                // --ok: #3FB950
val ColorWarning = Color(0xFFD29922)                // --warn: #D29922
val ColorDanger = Color(0xFFF85149)                 // --danger: #F85149
val ColorLiked = Color(0xFFEF4444)                  // Liked heart red

// Badge Defaults
val BadgeBackground = Color(0x0FFFFFFF)             // rgba(255, 255, 255, 0.06)
val BadgeBorder = Color(0x1AFFFFFF)                 // rgba(255, 255, 255, 0.10)
val BadgeText = Color(0xFF9AA0AA)                   // --text-2

// Tempo Specific Colors (From static/styles.css .sp-tempo-*)
val TempoSlowColor = Color(0xFF38BDF8)              // --sp-tempo-slow: #38bdf8 (sky blue)
val TempoSlowDim = Color(0x1A38BDF8)                // rgba(56, 189, 248, 0.1)
val TempoSlowBorder = Color(0x4038BDF8)             // rgba(56, 189, 248, 0.25)

val TempoMidColor = Color(0xFF34D399)               // --sp-tempo-mid: #34d399 (emerald green)
val TempoMidDim = Color(0x1A34D399)                 // rgba(52, 211, 153, 0.1)
val TempoMidBorder = Color(0x4034D399)              // rgba(52, 211, 153, 0.25)

val TempoFastColor = Color(0xFFF59E0B)              // --sp-tempo-fast: #f59e0b (amber)
val TempoFastDim = Color(0x1EF59E0B)                // rgba(245, 158, 11, 0.12)
val TempoFastBorder = Color(0x4DF59E0B)             // rgba(245, 158, 11, 0.3)

val TempoVeryFastColor = Color(0xFFF87171)          // --sp-tempo-vfast: #f87171 (coral red)
val TempoVeryFastDim = Color(0x1EF87171)            // rgba(239, 68, 68, 0.12)
val TempoVeryFastBorder = Color(0x4DF87171)         // rgba(239, 68, 68, 0.3)
