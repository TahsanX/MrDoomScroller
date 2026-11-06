package com.scrollwise.core.db

import android.content.Context
import com.scrollwise.core.Dates
import com.scrollwise.core.detect.TargetApp

/**
 * The one way into storage. Both the accessibility service and the React Native
 * module go through here, so there is a single place where "today" is defined and a
 * single place settings get their defaults.
 */
class Repository(context: Context) {

  private val db = AppDatabase.get(context)
  private val stats = db.stats()
  private val settingsDao = db.settings()

  suspend fun settings(): AppSettings = settingsDao.get() ?: AppSettings().also {
    // Materialise the defaults on first read so later partial updates have a row to
    // merge into.
    settingsDao.put(it)
  }

  suspend fun putSettings(settings: AppSettings) =
    settingsDao.put(settings.copy(id = AppSettings.SINGLETON_ID))

  /**
   * Commit one counted reel and return the new daily total.
   *
   * Returns null when the app is switched off in settings — checked here rather than
   * in the detector so the detector stays a pure function of the event stream.
   */
  suspend fun commitReel(app: TargetApp, timestamp: Long, dwellMs: Int, isAd: Boolean): Int? {
    val settings = settings()
    if (!settings.enabledApps.split(',').map(String::trim).contains(app.id)) return null
    return stats.commitReel(Dates.isoDate(timestamp), app.id, timestamp, dwellMs, isAd)
  }

  suspend fun addFeedTime(timestamp: Long, dwellMs: Int) {
    if (dwellMs <= 0) return
    stats.addFeedTime(Dates.isoDate(timestamp), dwellMs.toLong())
  }

  suspend fun todayTotal(): Int = stats.dayOrNull(Dates.isoDate())?.totalReels ?: 0

  suspend fun today(): DayTotal {
    val date = Dates.isoDate()
    val row = stats.dayOrNull(date)
    return DayTotal(date, row?.totalReels ?: 0, row?.feedMs ?: 0L, row?.adReels ?: 0)
  }

  suspend fun appCountsToday(): List<AppCount> = stats.appCounts(Dates.isoDate())

  suspend fun range(from: String, to: String): List<DayTotal> = stats.range(from, to)

  suspend fun appCountsInRange(from: String, to: String): List<AppCount> =
    stats.appCountsInRange(from, to)

  suspend fun hourHistogram(days: Int): List<HourBucket> =
    stats.hourHistogram(Dates.startOfDay() - days.toLong() * 86_400_000L)

  suspend fun averageDwellMs(days: Int): Int =
    (stats.averageDwellMs(Dates.startOfDay() - days.toLong() * 86_400_000L) ?: 0.0).toInt()

  suspend fun resetToday() {
    val now = System.currentTimeMillis()
    stats.resetDay(Dates.isoDate(now), Dates.startOfDay(now), Dates.endOfDay(now))
  }

  suspend fun pruneEventsOlderThan(days: Int): Int =
    stats.pruneEventsBefore(System.currentTimeMillis() - days.toLong() * 86_400_000L)

  /** Everything the user owns, for the local-only export. */
  suspend fun exportAll(): ExportBundle = ExportBundle(
    days = stats.allDays(),
    appStats = stats.allAppStats(),
    events = stats.eventsSince(0),
    settings = settings()
  )

  data class ExportBundle(
    val days: List<DayTotal>,
    val appStats: List<DailyAppStats>,
    val events: List<ReelEvent>,
    val settings: AppSettings
  )

  companion object {
    const val EVENT_RETENTION_DAYS = 30

    @Volatile
    private var instance: Repository? = null

    fun get(context: Context): Repository =
      instance ?: synchronized(this) {
        instance ?: Repository(context.applicationContext).also { instance = it }
      }
  }
}
