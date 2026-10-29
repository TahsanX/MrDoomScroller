package com.mrdoomscroller.core.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
  entities = [DailyStats::class, DailyAppStats::class, ReelEvent::class, AppSettings::class],
  version = 1,
  exportSchema = true
)
abstract class AppDatabase : RoomDatabase() {
  abstract fun stats(): StatsDao
  abstract fun settings(): SettingsDao

  companion object {
    private const val NAME = "doomscroll.db"

    @Volatile
    private var instance: AppDatabase? = null

    /**
     * The accessibility service and the React Native activity are separate entry
     * points into the same process, and either can be first. Double-checked locking
     * keeps them on one connection.
     */
    fun get(context: Context): AppDatabase =
      instance ?: synchronized(this) {
        instance ?: Room.databaseBuilder(
          context.applicationContext,
          AppDatabase::class.java,
          NAME
        ).build().also { instance = it }
      }
  }
}
