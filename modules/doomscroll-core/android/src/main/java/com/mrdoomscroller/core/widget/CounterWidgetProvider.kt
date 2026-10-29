package com.mrdoomscroller.core.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.widget.RemoteViews
import com.mrdoomscroller.core.R
import com.mrdoomscroller.core.db.Repository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Home-screen counter.
 *
 * Built on RemoteViews rather than Glance on purpose. Glance needs the Compose
 * compiler plugin inside this module, which couples the build to a specific Kotlin
 * version and is the kind of thing that breaks on an Expo SDK bump. The widget is a
 * number and a label; RemoteViews renders that on every Android version this app
 * supports, with no extra compiler in the build and a far smaller APK.
 */
class CounterWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    manager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    scope.launch {
      val total = Repository.get(context).todayTotal()
      render(context, manager, appWidgetIds, total)
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == ACTION_UPDATE_COUNT && intent.hasExtra(EXTRA_COUNT)) {
      val manager = AppWidgetManager.getInstance(context)
      render(context, manager, idsFor(context, manager), intent.getIntExtra(EXTRA_COUNT, 0))
      return
    }
    super.onReceive(context, intent)
  }

  companion object {
    private const val ACTION_UPDATE_COUNT = "com.mrdoomscroller.core.WIDGET_UPDATE_COUNT"
    private const val EXTRA_COUNT = "count"

    /**
     * Throttle. The service commits once per swipe, and pushing a RemoteViews update
     * at that rate is wasted work the launcher has to absorb while the user is not
     * even looking at the home screen.
     */
    private const val MIN_UPDATE_GAP_MS = 2_000L

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Volatile
    private var lastUpdateAt: Long = 0

    /** Called by the service after each committed reel. Cheap and throttled. */
    fun requestUpdate(context: Context, count: Int) {
      val now = SystemClock.elapsedRealtime()
      if (now - lastUpdateAt < MIN_UPDATE_GAP_MS) return
      lastUpdateAt = now
      context.sendBroadcast(
        Intent(context, CounterWidgetProvider::class.java).apply {
          action = ACTION_UPDATE_COUNT
          putExtra(EXTRA_COUNT, count)
        }
      )
    }

    /** Full refresh from the database. Used after a reboot and on day rollover. */
    fun refreshAll(context: Context) {
      scope.launch {
        val manager = AppWidgetManager.getInstance(context)
        val ids = idsFor(context, manager)
        if (ids.isEmpty()) return@launch
        render(context, manager, ids, Repository.get(context).todayTotal())
      }
    }

    private fun idsFor(context: Context, manager: AppWidgetManager): IntArray =
      manager.getAppWidgetIds(ComponentName(context, CounterWidgetProvider::class.java))

    private fun render(
      context: Context,
      manager: AppWidgetManager,
      ids: IntArray,
      count: Int
    ) {
      if (ids.isEmpty()) return
      val views = RemoteViews(context.packageName, R.layout.ds_counter_widget).apply {
        setTextViewText(R.id.ds_widget_count, count.toString())
        setTextViewText(
          R.id.ds_widget_label,
          if (count == 1) "reel today" else "reels today"
        )
        launchIntent(context)?.let { setOnClickPendingIntent(R.id.ds_widget_root, it) }
      }
      runCatching { manager.updateAppWidget(ids, views) }
    }

    /**
     * Opens the app when the widget is tapped. Resolved by package rather than by a
     * hardcoded activity name, because the host app's launcher activity belongs to
     * the Expo project and this module should not have to know its class.
     */
    private fun launchIntent(context: Context): PendingIntent? {
      val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: return null
      return PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }
  }
}
