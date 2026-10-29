package com.mrdoomscroller.core.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.mrdoomscroller.core.widget.CounterWidgetProvider
import com.mrdoomscroller.core.work.MaintenanceWorker

/**
 * Closes out the reel that was on screen when the user turned the display off.
 *
 * Without this, locking the phone mid-feed leaves a reel open and its dwell time
 * running until the next window event, which would show up later as a single video
 * apparently watched for nine hours.
 */
class ScreenOffReceiver(private val onScreenOff: () -> Unit) : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    if (intent?.action == Intent.ACTION_SCREEN_OFF) onScreenOff()
  }
}

/**
 * After a reboot the accessibility service is restarted by the system on its own, but
 * the widget shows a stale number and the maintenance work needs rescheduling.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    val ctx = context ?: return
    if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
    MaintenanceWorker.schedule(ctx)
    CounterWidgetProvider.refreshAll(ctx)
  }
}
