package com.mrdoomscroller.core

import java.util.Calendar
import java.util.Locale

/**
 * All date handling is local-timezone, because "how many reels did I watch today"
 * means the user's today. Using UTC here would roll the counter over mid-evening for
 * anyone east of Greenwich.
 */
object Dates {

  fun isoDate(millis: Long = System.currentTimeMillis()): String {
    val c = Calendar.getInstance().apply { timeInMillis = millis }
    return String.format(
      Locale.US,
      "%04d-%02d-%02d",
      c.get(Calendar.YEAR),
      c.get(Calendar.MONTH) + 1,
      c.get(Calendar.DAY_OF_MONTH)
    )
  }

  /** Midnight at the start of the local day containing [millis]. */
  fun startOfDay(millis: Long = System.currentTimeMillis()): Long {
    val c = Calendar.getInstance().apply {
      timeInMillis = millis
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    return c.timeInMillis
  }

  fun endOfDay(millis: Long = System.currentTimeMillis()): Long =
    startOfDay(millis) + 24L * 60 * 60 * 1000

  fun isoDaysAgo(days: Int, from: Long = System.currentTimeMillis()): String {
    val c = Calendar.getInstance().apply {
      timeInMillis = from
      add(Calendar.DAY_OF_YEAR, -days)
    }
    return isoDate(c.timeInMillis)
  }

  fun millisUntilNextLocalMidnight(from: Long = System.currentTimeMillis()): Long =
    (endOfDay(from) - from).coerceAtLeast(1_000L)
}
