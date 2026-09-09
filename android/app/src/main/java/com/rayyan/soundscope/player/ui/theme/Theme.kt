package com.rayyan.soundscope.player.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

import android.os.Build
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.ui.graphics.Color

private val SoundScopeDarkColorScheme = darkColorScheme(
    primary = SoundScopePrimary,
    onPrimary = Color(0xFF101114),
    primaryContainer = SoundScopePrimaryDark,
    onPrimaryContainer = Color(0xFF101114),
    secondary = SoundScopePrimaryLight,
    onSecondary = Color(0xFF101114),
    background = SoundScopeBackground,
    onBackground = TextPrimary,
    surface = SoundScopeSurface,
    onSurface = TextPrimary,
    surfaceVariant = SoundScopeSurfaceElevated,
    onSurfaceVariant = TextSecondary,
    outline = SoundScopeBorder,
    outlineVariant = SoundScopeSurfaceHighlight,
    error = ColorDanger,
    onError = Color.White,
    errorContainer = Color(0xFF3E1515),
    onErrorContainer = Color(0xFFFFD2D0)
)

@Composable
fun SoundScopeTheme(
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            dynamicDarkColorScheme(context)
        }
        else -> SoundScopeDarkColorScheme
    }
    val view = LocalView.current

    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            window.statusBarColor = SoundScopeBackground.toArgb()
            window.navigationBarColor = SoundScopeBackground.toArgb()
            val insetsController = WindowCompat.getInsetsController(window, view)
            insetsController.isAppearanceLightStatusBars = false
            insetsController.isAppearanceLightNavigationBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = SoundScopeTypography,
        content = content
    )
}
