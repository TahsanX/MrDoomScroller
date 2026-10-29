package com.mrdoomscroller.core.enforce

import android.accessibilityservice.AccessibilityService
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.util.Log
import com.mrdoomscroller.core.R
import com.mrdoomscroller.core.db.AppSettings
import com.mrdoomscroller.core.db.BlockMode
import com.mrdoomscroller.core.db.mode
import com.mrdoomscroller.core.detect.TargetApp
import com.mrdoomscroller.core.overlay.BlockOverlay
import androidx.core.app.NotificationCompat

/**
 * Decides what happens when the user crosses their own cap.
 *
 * ## Why this is not a wall
 *
 * An un-dismissible overlay is not actually un-dismissible. The system strips
 * overlays over permission dialogs, the back gesture and the notification shade keep
 * working, and the user can always switch the accessibility service off in system
 * settings — which the app tells them, rather than pretending otherwise. The reliable
 * primitive is [AccessibilityService.GLOBAL_ACTION_HOME]; the overlay is the message,
 * not the lock.
 *
 * So the default is a soft landing: show the number, show the time, offer one tap to
 * leave. [BlockMode.HARD] is opt-in for people who have decided they want it.
 */
class LimitEnforcer(context: Context) {

  private val appContext = context.applicationContext
  private val notifications =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  private val blockOverlay = BlockOverlay(context)

  /** Guards against re-firing on every single swipe once the cap is already crossed. */
  private var lastFiredForTotal: Int = -1
  private var snoozedUntil: Long = 0

  /**
   * @param sessionCount reels counted in the current sitting, where a sitting ends
   *   after [SESSION_GAP_MS] away from a feed.
   */
  fun onCount(
    service: AccessibilityService,
    settings: AppSettings,
    todayTotal: Int,
    sessionCount: Int,
    app: TargetApp
  ) {
    val now = System.currentTimeMillis()
    if (now < snoozedUntil) return

    // Whichever cap is crossed first wins. The session cap is the one that tends to
    // land, because it arrives while the user is still in the habit rather than at
    // the end of the day.
    val dailyCrossed = settings.dailyLimit > 0 && todayTotal >= settings.dailyLimit
    val sessionCrossed = settings.sessionLimit > 0 && sessionCount >= settings.sessionLimit
    if (!dailyCrossed && !sessionCrossed) return

    val limit = if (sessionCrossed) settings.sessionLimit else settings.dailyLimit
    val count = if (sessionCrossed) sessionCount else todayTotal

    val firstCrossing = lastFiredForTotal < limit
    lastFiredForTotal = count

    when (settings.mode) {
      BlockMode.NOTIFY -> if (firstCrossing) notify(count, limit)

      BlockMode.NUDGE -> blockOverlay.show(
        count = count,
        limit = limit,
        appLabel = app.label,
        allowDismiss = true,
        onSnooze = { snoozedUntil = System.currentTimeMillis() + SNOOZE_MS },
        onLeave = { goHome(service) }
      )

      BlockMode.HARD -> {
        blockOverlay.show(
          count = count,
          limit = limit,
          appLabel = app.label,
          allowDismiss = false,
          onSnooze = null,
          onLeave = { goHome(service) }
        )
        goHome(service)
      }
    }
  }

  /** Called when the user re-opens a target app after already hitting the cap. */
  fun onSurfaceEntered(
    service: AccessibilityService,
    settings: AppSettings,
    todayTotal: Int,
    app: TargetApp
  ) {
    val limit = settings.dailyLimit
    if (limit <= 0 || todayTotal < limit) return
    if (System.currentTimeMillis() < snoozedUntil) return
    if (settings.mode != BlockMode.HARD) return

    blockOverlay.show(
      count = todayTotal,
      limit = limit,
      appLabel = app.label,
      allowDismiss = false,
      onSnooze = null,
      onLeave = { goHome(service) }
    )
    goHome(service)
  }

  fun dismiss() = blockOverlay.hide()

  /** A new day resets the enforcement state along with the count. */
  fun onDayRollover() {
    lastFiredForTotal = -1
    snoozedUntil = 0
    blockOverlay.hide()
  }

  private fun goHome(service: AccessibilityService) {
    val performed = service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME)
    if (!performed) Log.w(TAG, "GLOBAL_ACTION_HOME was refused.")
  }

  private fun notify(count: Int, limit: Int) {
    ensureChannel()
    val text = "You have passed your limit of $limit. That is $count today."
    val notification = NotificationCompat.Builder(appContext, CHANNEL_ID)
      .setSmallIcon(R.drawable.ds_ic_notification)
      .setContentTitle("Daily reel limit reached")
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text))
      .setOnlyAlertOnce(true)
      .setAutoCancel(true)
      .build()
    runCatching { notifications.notify(NOTIFICATION_ID, notification) }
      .onFailure { Log.w(TAG, "Could not post limit notification", it) }
  }

  private fun ensureChannel() {
    if (notifications.getNotificationChannel(CHANNEL_ID) != null) return
    notifications.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        "Daily limit",
        NotificationManager.IMPORTANCE_DEFAULT
      ).apply {
        description = "Tells you when you have passed the reel limit you set."
      }
    )
  }

  companion object {
    private const val TAG = "DoomScroll/Limit"
    private const val CHANNEL_ID = "doomscroll_limit"
    private const val NOTIFICATION_ID = 4201
    private const val SNOOZE_MS = 60_000L

    /** Time away from a feed that ends a sitting. */
    const val SESSION_GAP_MS = 5 * 60 * 1000L
  }
}
