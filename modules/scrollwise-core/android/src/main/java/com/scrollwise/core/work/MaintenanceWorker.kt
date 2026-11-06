package com.scrollwise.core.work

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.scrollwise.core.Dates
import com.scrollwise.core.db.Repository
import com.scrollwise.core.widget.CounterWidgetProvider
import java.util.concurrent.TimeUnit

/**
 * Housekeeping: prune the granular event table to its retention window and roll the
 * widget over to the new day.
 *
 * Daily totals are never pruned — a user who has had the app a year should still see
 * their first week. Only `reel_events`, which exists for the heatmap and dwell
 * insights, has a retention limit.
 *
 * Deliberately not an alarm at exactly midnight: a minute of drift does not matter
 * here, and WorkManager batching costs the user far less battery than an exact wakeup.
 */
class MaintenanceWorker(
  context: Context,
  params: WorkerParameters
) : CoroutineWorker(context, params) {

  // try/catch rather than runCatching: `Result` here is WorkManager's, and nesting it
  // inside a kotlin.Result makes which one is meant genuinely ambiguous to a reader.
  override suspend fun doWork(): Result {
    val repository = Repository.get(applicationContext)
    return try {
      val pruned = repository.pruneEventsOlderThan(Repository.EVENT_RETENTION_DAYS)
      CounterWidgetProvider.refreshAll(applicationContext)
      Log.i(TAG, "Maintenance ran: pruned $pruned events, widget refreshed.")
      Result.success()
    } catch (error: Exception) {
      Log.w(TAG, "Maintenance failed; will retry.", error)
      Result.retry()
    }
  }

  companion object {
    private const val TAG = "ScrollWise/Maintenance"
    private const val WORK_NAME = "scrollwise_maintenance"

    fun schedule(context: Context) {
      val request = PeriodicWorkRequestBuilder<MaintenanceWorker>(1, TimeUnit.DAYS)
        // First run lands just after the next local midnight, so the widget flips to
        // zero close to when the user's day actually turns over.
        .setInitialDelay(Dates.millisUntilNextLocalMidnight() + 60_000L, TimeUnit.MILLISECONDS)
        .setConstraints(
          Constraints.Builder()
            .setRequiresBatteryNotLow(true)
            .build()
        )
        .build()

      WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        WORK_NAME,
        // KEEP rather than REPLACE: re-scheduling on every app launch would push the
        // first run back past midnight every time the user opened the app.
        ExistingPeriodicWorkPolicy.KEEP,
        request
      )
    }
  }
}
