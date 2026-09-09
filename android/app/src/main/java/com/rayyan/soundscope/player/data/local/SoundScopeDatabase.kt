package com.rayyan.soundscope.player.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.rayyan.soundscope.player.data.local.dao.PlaylistDao
import com.rayyan.soundscope.player.data.local.dao.TrackDao
import com.rayyan.soundscope.player.data.local.entity.PlaylistEntity
import com.rayyan.soundscope.player.data.local.entity.PlaylistTrackCrossRef
import com.rayyan.soundscope.player.data.local.entity.TrackEntity

@Database(
    entities = [
        TrackEntity::class,
        PlaylistEntity::class,
        PlaylistTrackCrossRef::class
    ],
    version = 1,
    exportSchema = false
)
abstract class SoundScopeDatabase : RoomDatabase() {

    abstract fun trackDao(): TrackDao
    abstract fun playlistDao(): PlaylistDao

    companion object {
        @Volatile
        private var INSTANCE: SoundScopeDatabase? = null

        fun getDatabase(context: Context): SoundScopeDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    SoundScopeDatabase::class.java,
                    "soundscope_player.db"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}
