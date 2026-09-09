package com.rayyan.soundscope.player

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.rayyan.soundscope.player.ui.screens.MainScreen
import com.rayyan.soundscope.player.ui.theme.SoundScopeTheme
import com.rayyan.soundscope.player.ui.viewmodel.LibraryViewModel
import com.rayyan.soundscope.player.ui.viewmodel.PlayerViewModel
import com.rayyan.soundscope.player.ui.viewmodel.PlaylistViewModel

class MainActivity : ComponentActivity() {

    private val libraryViewModel: LibraryViewModel by viewModels()
    private val playerViewModel: PlayerViewModel by viewModels()
    private val playlistViewModel: PlaylistViewModel by viewModels()

    private var hasStoragePermission by mutableStateOf(false)

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions.values.any { it }
        hasStoragePermission = granted
        if (granted) {
            libraryViewModel.startAudioScan()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        checkAndRequestPermissions()

        setContent {
            SoundScopeTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainScreen(
                        libraryViewModel = libraryViewModel,
                        playerViewModel = playerViewModel,
                        playlistViewModel = playlistViewModel
                    )
                }
            }
        }
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.READ_MEDIA_AUDIO)
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }

        val allGranted = permissions.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }

        hasStoragePermission = allGranted

        if (!allGranted) {
            permissionLauncher.launch(permissions.toTypedArray())
        } else {
            libraryViewModel.startAudioScan()
        }
    }
}
