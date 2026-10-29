package com.mrdoomscroller.core.service

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.DisplayMetrics
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import androidx.core.content.ContextCompat
import com.mrdoomscroller.core.CounterBus
import com.mrdoomscroller.core.db.Repository
import com.mrdoomscroller.core.detect.DetectorEvent
import com.mrdoomscroller.core.detect.Profiles
import com.mrdoomscroller.core.detect.ReelDetector
import com.mrdoomscroller.core.detect.ScrollSignal
import com.mrdoomscroller.core.detect.TargetApp
import com.mrdoomscroller.core.detect.WindowSignal
import com.mrdoomscroller.core.enforce.LimitEnforcer
import com.mrdoomscroller.core.overlay.OverlayController
import com.mrdoomscroller.core.widget.CounterWidgetProvider
import com.mrdoomscroller.core.work.MaintenanceWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * The observer. Watches scroll and window events in the five target apps, hands them
 * to [ReelDetector], and persists whatever it concludes.
 *
 * ## Threading
 *
 * [onAccessibilityEvent] runs on the main thread and is called while the user's thumb
 * is moving. Anything slow here is felt directly as jank in Instagram, so this method
 * only ever reads event fields, does a bounded node walk, and hands off. Every write
 * goes to [writeScope], a single-threaded dispatcher: it keeps Room off the main
 * thread while still serialising commits so the read-modify-write in
 * `StatsDao.commitReel` cannot interleave with itself.
 *
 * The React Native JS context is deliberately not in this path. It may not exist —
 * the service runs with the app closed, which is the normal case — and crossing the
 * bridge per swipe would be both slow and unreliable.
 */
class ScrollWatchService : AccessibilityService() {

  @OptIn(ExperimentalCoroutinesApi::class)
  private val writeScope = CoroutineScope(
    SupervisorJob() + Dispatchers.IO.limitedParallelism(1)
  )

  private lateinit var repository: Repository
  private lateinit var detector: ReelDetector
  private lateinit var overlay: OverlayController
  private lateinit var enforcer: LimitEnforcer

  private var screenOffReceiver: ScreenOffReceiver? = null

  /**
   * Cached so the hot path never touches the database. Updated on every commit and
   * re-read when the service connects.
   */
  @Volatile
  private var todayTotal: Int = 0

  @Volatile
  private var debugLogging: Boolean = false

  /**
   * Reels in the current sitting. A sitting ends after `LimitEnforcer.SESSION_GAP_MS`
   * away from any feed, which is tracked here rather than in the detector because it
   * is an enforcement concept, not a detection one.
   */
  private var sessionCount: Int = 0
  private var lastReelAt: Long = 0

  override fun onServiceConnected() {
    super.onServiceConnected()
    repository = Repository.get(this)
    detector = ReelDetector(Profiles.load(this))
    enforcer = LimitEnforcer(this)
    overlay = OverlayController(this) { x, y ->
      // The drag happens on the main thread; the write belongs on ours.
      writeScope.launch {
        repository.putSettings(repository.settings().copy(overlayX = x, overlayY = y))
      }
    }

    // ContextCompat with an explicit flag rather than bare registerReceiver: apps
    // targeting Android 14+ must declare export intent, and relying on the
    // system-broadcast exemption is not worth a SecurityException at runtime.
    screenOffReceiver = ScreenOffReceiver { onSessionInterrupted() }.also {
      ContextCompat.registerReceiver(
        this,
        it,
        IntentFilter(Intent.ACTION_SCREEN_OFF),
        ContextCompat.RECEIVER_NOT_EXPORTED
      )
    }

    MaintenanceWorker.schedule(this)

    writeScope.launch {
      val settings = repository.settings()
      debugLogging = settings.debugLogging
      todayTotal = repository.todayTotal()
      overlay.configure(settings.overlayEnabled, settings.overlayX, settings.overlayY)
    }

    Log.i(TAG, "Connected. Watching ${TargetApp.allPackages.size} packages.")
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    val app = TargetApp.forPackage(event.packageName?.toString())

    when (event.eventType) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> handleWindow(event, app)
      AccessibilityEvent.TYPE_VIEW_SCROLLED -> handleScroll(event, app)
      else -> Unit
    }
  }

  private fun handleWindow(event: AccessibilityEvent, app: TargetApp?) {
    val source = event.source
    try {
      val profile = app?.let { detector.profileFor(it) }
      val hasActionColumn = if (profile != null) {
        NodeScanner.hasActionColumn(source, profile)
      } else {
        false
      }

      val signal = WindowSignal(
        timestamp = System.currentTimeMillis(),
        app = app,
        packageName = event.packageName?.toString(),
        className = event.className?.toString(),
        viewIdResourceName = source?.viewIdResourceName,
        hasActionColumn = hasActionColumn
      )

      if (debugLogging) {
        Log.d(TAG, "window pkg=${signal.packageName} cls=${signal.className} id=${signal.viewIdResourceName} actions=$hasActionColumn")
      }

      dispatch(detector.onWindow(signal))
    } finally {
      @Suppress("DEPRECATION")
      source?.recycle()
    }
  }

  private fun handleScroll(event: AccessibilityEvent, app: TargetApp?) {
    if (app == null) return
    // Cheap rejection before any node work: if we are not on a recognised feed
    // surface there is nothing to count, and almost all scroll events in these apps
    // are not on one.
    if (!detector.isOnSurface) return

    val source = event.source
    try {
      val profile = detector.profileFor(app)
      val bounds = NodeScanner.boundsOf(source)
      val metrics: DisplayMetrics = resources.displayMetrics

      val signal = ScrollSignal(
        timestamp = System.currentTimeMillis(),
        app = app,
        sourceClassName = event.className?.toString(),
        viewIdResourceName = source?.viewIdResourceName,
        fromIndex = event.fromIndex,
        toIndex = event.toIndex,
        itemCount = event.itemCount,
        // Deltas arrived in API 28. Below that the detector falls through to its
        // index tier, or to the de-bounced fallback.
        scrollDeltaX = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) event.scrollDeltaX else 0,
        scrollDeltaY = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) event.scrollDeltaY else 0,
        sourceHeightPx = bounds.height(),
        sourceWidthPx = bounds.width(),
        screenHeightPx = metrics.heightPixels,
        screenWidthPx = metrics.widthPixels,
        hasActionColumn = NodeScanner.hasActionColumn(source, profile)
      )

      if (debugLogging) {
        Log.d(
          TAG,
          "scroll pkg=${app.id} cls=${signal.sourceClassName} idx=${signal.fromIndex}..${signal.toIndex}/${signal.itemCount} " +
            "d=(${signal.scrollDeltaX},${signal.scrollDeltaY}) h=${signal.heightRatio} actions=${signal.hasActionColumn}"
        )
      }

      dispatch(detector.onScroll(signal))
    } finally {
      @Suppress("DEPRECATION")
      source?.recycle()
    }
  }

  private fun dispatch(events: List<DetectorEvent>) {
    if (events.isEmpty()) return
    for (event in events) {
      when (event) {
        is DetectorEvent.SurfaceEntered -> {
          overlay.show(todayTotal)
          // Re-opening a feed after already passing the cap has to be caught here:
          // in hard mode the user never gets as far as another swipe.
          writeScope.launch {
            enforcer.onSurfaceEntered(
              this@ScrollWatchService,
              repository.settings(),
              todayTotal,
              event.app
            )
          }
        }

        is DetectorEvent.SurfaceExited -> {
          overlay.hide()
          enforcer.dismiss()
        }

        is DetectorEvent.ReelViewed -> onReelViewed(event)
      }
    }
  }

  private fun onReelViewed(event: DetectorEvent.ReelViewed) {
    // A long enough gap means this is a new sitting.
    if (event.timestamp - lastReelAt > LimitEnforcer.SESSION_GAP_MS) sessionCount = 0
    lastReelAt = event.timestamp
    sessionCount += 1

    // Optimistic bump so the overlay tracks the thumb rather than the disk. The
    // authoritative value comes back from the commit a moment later.
    todayTotal += 1
    overlay.update(todayTotal)

    writeScope.launch {
      val committed = repository.commitReel(event.app, event.timestamp, event.dwellMs)
      if (committed == null) {
        // The app was switched off in settings between the detection and the write.
        todayTotal -= 1
        sessionCount -= 1
        overlay.update(todayTotal)
        return@launch
      }
      todayTotal = committed
      overlay.update(committed)
      CounterWidgetProvider.requestUpdate(this@ScrollWatchService, committed)

      // Only costs anything when the app is actually open and listening.
      if (CounterBus.hasListeners) {
        CounterBus.publishReel(event.app, committed, event.dwellMs)
      }

      val settings = repository.settings()
      debugLogging = settings.debugLogging
      if (settings.dailyLimit in 1..committed) {
        CounterBus.publishLimit(event.app, committed, settings.dailyLimit)
      }
      enforcer.onCount(this@ScrollWatchService, settings, committed, sessionCount, event.app)
    }
  }

  private fun onSessionInterrupted() {
    dispatch(detector.onSessionEnd(System.currentTimeMillis()))
  }

  override fun onInterrupt() {
    onSessionInterrupted()
  }

  override fun onUnbind(intent: Intent?): Boolean {
    onSessionInterrupted()
    overlay.hide()
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    screenOffReceiver?.let { runCatching { unregisterReceiver(it) } }
    screenOffReceiver = null
    overlay.destroy()
    writeScope.cancel()
    super.onDestroy()
  }

  companion object {
    const val TAG = "DoomScroll/Service"
  }
}
