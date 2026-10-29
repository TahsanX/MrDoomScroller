package com.mrdoomscroller.core.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert

data class AppCount(val appId: String, val count: Int)

data class DayTotal(val date: String, val totalReels: Int, val feedMs: Long)

data class HourBucket(val hour: Int, val count: Int)

/**
 * Abstract class rather than an interface so the `@Transaction` methods below can have
 * real bodies without relying on Kotlin default-interface-method codegen.
 */
@Dao
abstract class StatsDao {

  @Query("SELECT * FROM daily_stats WHERE date = :date")
  abstract suspend fun dayOrNull(date: String): DailyStats?

  @Query("SELECT date, totalReels, feedMs FROM daily_stats WHERE date BETWEEN :from AND :to ORDER BY date")
  abstract suspend fun range(from: String, to: String): List<DayTotal>

  @Query("SELECT date, totalReels, feedMs FROM daily_stats ORDER BY date DESC")
  abstract suspend fun allDays(): List<DayTotal>

  @Query("SELECT appId, count FROM daily_app_stats WHERE date = :date ORDER BY count DESC")
  abstract suspend fun appCounts(date: String): List<AppCount>

  @Query("SELECT appId, SUM(count) AS count FROM daily_app_stats WHERE date BETWEEN :from AND :to GROUP BY appId ORDER BY count DESC")
  abstract suspend fun appCountsInRange(from: String, to: String): List<AppCount>

  @Query("SELECT * FROM daily_app_stats ORDER BY date DESC")
  abstract suspend fun allAppStats(): List<DailyAppStats>

  @Query("SELECT count FROM daily_app_stats WHERE date = :date AND appId = :appId")
  abstract suspend fun appCountOrNull(date: String, appId: String): Int?

  /**
   * Hour-of-day histogram over the retained event window. SQLite is given
   * `timestamp / 1000` with 'unixepoch' and 'localtime' so the buckets line up with
   * the user's own clock rather than UTC.
   */
  @Query(
    """
    SELECT CAST(strftime('%H', timestamp / 1000, 'unixepoch', 'localtime') AS INTEGER) AS hour,
           COUNT(*) AS count
    FROM reel_events
    WHERE timestamp >= :since
    GROUP BY hour
    ORDER BY hour
    """
  )
  abstract suspend fun hourHistogram(since: Long): List<HourBucket>

  @Query("SELECT AVG(dwellMs) FROM reel_events WHERE timestamp >= :since")
  abstract suspend fun averageDwellMs(since: Long): Double?

  @Query("SELECT * FROM reel_events WHERE timestamp >= :since ORDER BY timestamp")
  abstract suspend fun eventsSince(since: Long): List<ReelEvent>

  @Upsert
  abstract suspend fun upsertDay(day: DailyStats)

  @Upsert
  abstract suspend fun upsertAppStats(row: DailyAppStats)

  @Insert(onConflict = OnConflictStrategy.IGNORE)
  abstract suspend fun insertEvent(event: ReelEvent): Long

  @Query("DELETE FROM reel_events WHERE timestamp < :cutoff")
  abstract suspend fun pruneEventsBefore(cutoff: Long): Int

  @Query("DELETE FROM daily_stats WHERE date = :date")
  abstract suspend fun deleteDay(date: String)

  @Query("DELETE FROM daily_app_stats WHERE date = :date")
  abstract suspend fun deleteDayApps(date: String)

  @Query("DELETE FROM reel_events WHERE timestamp >= :from AND timestamp < :to")
  abstract suspend fun deleteEventsBetween(from: Long, to: Long)

  /**
   * The whole commit for one counted reel, in a single transaction, so the daily
   * total, the per-app total and the granular event can never drift apart. A
   * dashboard reading 41 while the per-app breakdown sums to 40 is exactly the kind
   * of bug that makes a user stop trusting the number.
   *
   * Read-modify-write is safe here because every write goes through the service's
   * single-threaded dispatcher, and the transaction makes it atomic regardless.
   *
   * @return the new running total for [date], so callers need no second read.
   */
  @Transaction
  open suspend fun commitReel(date: String, appId: String, timestamp: Long, dwellMs: Int): Int {
    val day = dayOrNull(date)
    val newTotal = (day?.totalReels ?: 0) + 1
    upsertDay(
      DailyStats(
        date = date,
        totalReels = newTotal,
        feedMs = (day?.feedMs ?: 0L) + dwellMs.toLong()
      )
    )
    upsertAppStats(
      DailyAppStats(date = date, appId = appId, count = (appCountOrNull(date, appId) ?: 0) + 1)
    )
    insertEvent(ReelEvent(timestamp = timestamp, appId = appId, dwellMs = dwellMs))
    return newTotal
  }

  @Transaction
  open suspend fun resetDay(date: String, dayStart: Long, dayEnd: Long) {
    deleteDay(date)
    deleteDayApps(date)
    deleteEventsBetween(dayStart, dayEnd)
  }
}

@Dao
interface SettingsDao {

  @Query("SELECT * FROM app_settings WHERE id = 1")
  suspend fun get(): AppSettings?

  @Upsert
  suspend fun put(settings: AppSettings)
}
