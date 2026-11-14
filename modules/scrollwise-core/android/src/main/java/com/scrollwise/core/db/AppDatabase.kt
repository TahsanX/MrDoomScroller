package com.scrollwise.core.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
  entities = [DailyStats::class, DailyAppStats::class, ReelEvent::class, AppSettings::class],
  version = 3,
  exportSchema = true
)
abstract class AppDatabase : RoomDatabase() {
  abstract fun stats(): StatsDao
  abstract fun settings(): SettingsDao

  companion object {
    private const val NAME = "scrollwise.db"

    /**
     * Version 2 tags ads. Additive only, so existing counts survive the upgrade: a
     * user who has been counting for weeks must not lose that history to an update.
     */
    val MIGRATION_1_2 = object : Migration(1, 2) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE daily_stats ADD COLUMN adReels INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE reel_events ADD COLUMN isAd INTEGER NOT NULL DEFAULT 0")
      }
    }

    /** Version 3 adds the tracking pause. Additive, like 1 → 2. */
    val MIGRATION_2_3 = object : Migration(2, 3) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE app_settings ADD COLUMN pausedUntil INTEGER NOT NULL DEFAULT 0")
      }
    }

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
        )
          .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
          .build()
          .also { instance = it }
      }
  }
}
