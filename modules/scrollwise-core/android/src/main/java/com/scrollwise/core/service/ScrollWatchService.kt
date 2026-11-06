package com.scrollwise.core.service

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import androidx.core.content.ContextCompat
import com.scrollwise.core.CounterBus
import com.scrollwise.core.db.Repository
import com.scrollwise.core.detect.DetectionProfile
import com.scrollwise.core.detect.DetectorEvent
import com.scrollwise.core.detect.PageObservation
import com.scrollwise.core.detect.Profiles
import com.scrollwise.core.detect.ReelCounter
import com.scrollwise.core.detect.TargetApp
import com.scrollwise.core.enforce.LimitEnforcer
import com.scrollwise.core.overlay.OverlayController
import com.scrollwise.core.widget.CounterWidgetProvider
import com.scrollwise.core.work.MaintenanceWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlin.math.abs

/**
 * The observer. Turns accessibility events into "look at the screen now" moments,
 * hands what it sees to [ReelCounter], and persists whatever that concludes.
 *
 * ## Events are triggers, not evidence
 *
 * The first version tried to count from the scroll events themselves and scored
 * under 30% on a real device. Events are now only used to decide *when* to look:
 *
 * - a scroll schedules a probe for once the swipe has settled,
 * - a window change schedules one for once the new screen has drawn,
 * - and while a target app is in front, a slow poll catches what sends no event at
 *   all — Instagram switching tabs, or the user leaving for the launcher, which this
 *   service never hears about because it only listens to the five target packages.
 *
 * Each probe reads the screen with [PagerProbe] and [ReelCounter] decides.
 *
 * ## Threading
 *
 * Probes and the counter live on [probeThread], so the bounded node walk never
 * competes with the overlay on the main thread and the counter needs no locking.
 * Writes go to [writeScope], single-threaded so the read-modify-write in
 * `StatsDao.commitReel` cannot interleave with itself. The React Native JS context
 * is never in this path; it is usually not running at all.
 */
class ScrollWatchService : AccessibilityService() {

  @OptIn(ExperimentalCoroutinesApi::class)
  private val writeScope = CoroutineScope(
    SupervisorJob() + Dispatchers.IO.limitedParallelism(1)
  )

  private lateinit var probeThread: HandlerThread
  private lateinit var probeHandler: Handler

  private lateinit var repository: Repository
  private lateinit var profiles: Map<String, DetectionProfile>
  private lateinit var overlay: OverlayController
  private lateinit var enforcer: LimitEnforcer

  /** Only touched on [probeThread]. */
  private val counter = ReelCounter()

  private var screenOffReceiver: ScreenOffReceiver? = null

  /** Cached so the overlay never waits on the database. */
  @Volatile
  private var todayTotal: Int = 0

  @Volatile
  private var debugLogging: Boolean = false

  // Probe-thread state.
  private var scrolledSinceProbe = false
  private var anyScrollSinceProbe = false
  private var targetInFront = false
  private var lastProbeAt = 0L

  /**
   * A settle probe is waiting. The poll stays out of the way meanwhile: a poll landing
   * mid-swipe would consume the scroll flags while the old reel is still on screen,
   * and the settle probe would then see the new reel with no scroll behind it.
   */
  private var settlePending = false

  /**
   * Reels in the current sitting. A sitting ends after `LimitEnforcer.SESSION_GAP_MS`
   * away from any feed — an enforcement concept, so it lives here, not in the counter.
   */
  private var sessionCount: Int = 0
  private var lastReelAt: Long = 0

  private val probeRunnable = Runnable {
    settlePending = false
    runProbe()
  }

  private val pollRunnable = object : Runnable {
    override fun run() {
      if (!targetInFront) return
      // A scroll-triggered probe may have just run, or be about to; no need to repeat it.
      if (!settlePending && SystemClock.uptimeMillis() - lastProbeAt >= POLL_MS - 100) runProbe()
      if (targetInFront) probeHandler.postDelayed(this, POLL_MS)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    repository = Repository.get(this)
    profiles = Profiles.load(this)
    enforcer = LimitEnforcer(this)
    overlay = OverlayController(
      context = this,
      onPositionChanged = { x, y ->
        writeScope.launch {
          repository.putSettings(repository.settings().copy(overlayX = x, overlayY = y))
        }
      }
    )

    probeThread = HandlerThread("ScrollWise-probe").also { it.start() }
    probeHandler = Handler(probeThread.looper)

    // Explicit export flag: apps targeting Android 14+ must declare it, and relying
    // on the system-broadcast exemption is not worth a SecurityException.
    screenOffReceiver = ScreenOffReceiver {
      probeHandler.post { endSitting() }
    }.also {
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
    val pkg = event.packageName?.toString() ?: return
    // Our own windows (the limit panel) must never count as leaving the feed.
    if (pkg == packageName) return
    val app = TargetApp.forPackage(pkg) ?: return

    when (event.eventType) {
      AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
        val vertical = isFeedSizedVerticalScroll(event)
        probeHandler.post {
          anyScrollSinceProbe = true
          if (vertical) scrolledSinceProbe = true
          scheduleProbe(SCROLL_SETTLE_MS)
          startPolling()
        }
      }

      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> probeHandler.post {
        scheduleProbe(WINDOW_SETTLE_MS)
        startPolling()
      }

      else -> Unit
    }

    if (debugLogging) Log.d(TAG, "event ${AccessibilityEvent.eventTypeToString(event.eventType)} app=${app.id}")
  }

  /**
   * Only scrolls of something feed-sized and not clearly horizontal count as "the
   * user swiped". Used solely by the counter's fallback for pages with no readable
   * labels; the fingerprint path does not need it.
   */
  private fun isFeedSizedVerticalScroll(event: AccessibilityEvent): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val dx = event.scrollDeltaX
      val dy = event.scrollDeltaY
      if (dx != 0 && abs(dx) > abs(dy)) return false
    }
    val source = event.source ?: return true
    return try {
      val rect = Rect()
      source.getBoundsInScreen(rect)
      rect.height() >= resources.displayMetrics.heightPixels * 0.6f
    } finally {
      @Suppress("DEPRECATION")
      runCatching { source.recycle() }
    }
  }

  // ---- Probe thread ----------------------------------------------------------

  private fun scheduleProbe(delayMs: Long) {
    // Each new event pushes the probe back, so a swipe is looked at once, after it
    // has settled, not once per animation frame.
    probeHandler.removeCallbacks(probeRunnable)
    settlePending = true
    probeHandler.postDelayed(probeRunnable, delayMs)
  }

  private fun startPolling() {
    if (targetInFront) return
    targetInFront = true
    probeHandler.removeCallbacks(pollRunnable)
    probeHandler.postDelayed(pollRunnable, POLL_MS)
  }

  private fun stopPolling() {
    targetInFront = false
    probeHandler.removeCallbacks(pollRunnable)
  }

  private fun runProbe() {
    lastProbeAt = SystemClock.uptimeMillis()
    val now = System.currentTimeMillis()
    val root = runCatching { rootInActiveWindow }.getOrNull()
    try {
      val pkg = root?.packageName?.toString()
      // Our own limit panel is in front: nothing has changed about the feed.
      if (pkg == packageName) return

      val app = TargetApp.forPackage(pkg)
      if (app == null) {
        // The launcher, another app, or a window we may not read. Either way the
        // user is no longer in a feed we count.
        stopPolling()
        scrolledSinceProbe = false
        anyScrollSinceProbe = false
        dispatch(counter.onObservation(PageObservation(now, null, false, null, false)))
        return
      }

      val metrics = resources.displayMetrics
      val profile = profiles[app.id] ?: DetectionProfile.defaultFor(app.id)
      val result = PagerProbe.probe(root, app.packages, profile, metrics.widthPixels, metrics.heightPixels)

      if (result.paused) {
        // Comment sheet, share sheet or snackbar over the reel. Nothing about the reel
        // changes, and scrolling the comments must not read as a swipe afterwards.
        scrolledSinceProbe = false
        anyScrollSinceProbe = false
        if (debugLogging) Log.d(TAG, "probe app=${app.id} paused")
        return
      }

      val observation = PageObservation(
        timestamp = now,
        app = app,
        onShortForm = result.onShortForm,
        fingerprint = result.fingerprint,
        scrolledSinceLast = scrolledSinceProbe,
        anyScrollSinceLast = anyScrollSinceProbe,
        isAd = result.isAd
      )
      scrolledSinceProbe = false
      anyScrollSinceProbe = false

      if (debugLogging) {
        // Reason and a fingerprint prefix only. Never the labels themselves.
        Log.d(
          TAG,
          "probe app=${app.id} short=${result.onShortForm} fp=${result.fingerprint?.take(6)} " +
            "scrolled=${observation.scrolledSinceLast} ${result.reason}"
        )
      }

      dispatch(counter.onObservation(observation))
    } catch (error: RuntimeException) {
      // A window torn down mid-walk throws from deep inside the framework. Losing one
      // probe is fine; losing the service is not.
      Log.w(TAG, "Probe failed", error)
    } finally {
      @Suppress("DEPRECATION")
      runCatching { root?.recycle() }
    }
  }

  private fun endSitting() {
    stopPolling()
    probeHandler.removeCallbacks(probeRunnable)
    settlePending = false
    dispatch(counter.onSessionEnd(System.currentTimeMillis()))
  }

  private fun dispatch(events: List<DetectorEvent>) {
    for (event in events) {
      when (event) {
        is DetectorEvent.SurfaceEntered -> {
          overlay.show(todayTotal)
          // In hard mode, re-opening a feed after the cap must be caught here: the
          // user never gets as far as another swipe.
          writeScope.launch {
            enforcer.onSurfaceEntered(this@ScrollWatchService, repository.settings(), todayTotal, event.app)
          }
        }

        is DetectorEvent.SurfaceExited -> {
          overlay.onSurfaceExited()
          enforcer.dismiss()
        }

        is DetectorEvent.ReelViewed -> onReelViewed(event)

        is DetectorEvent.FinalDwell -> writeScope.launch {
          repository.addFeedTime(event.timestamp, event.dwellMs)
        }
      }
    }
  }

  private fun onReelViewed(event: DetectorEvent.ReelViewed) {
    if (event.timestamp - lastReelAt > LimitEnforcer.SESSION_GAP_MS) sessionCount = 0
    lastReelAt = event.timestamp
    sessionCount += 1
    val sitting = sessionCount

    // Optimistic bump so the overlay tracks the thumb rather than the disk. The
    // authoritative value comes back from the commit a moment later.
    todayTotal += 1
    overlay.update(todayTotal)

    writeScope.launch {
      val committed = repository.commitReel(event.app, event.timestamp, event.dwellMs, event.isAd)
      if (committed == null) {
        // The app was switched off in settings between detection and write.
        todayTotal -= 1
        probeHandler.post { sessionCount -= 1 }
        overlay.update(todayTotal)
        return@launch
      }
      todayTotal = committed
      overlay.update(committed)
      CounterWidgetProvider.requestUpdate(this@ScrollWatchService, committed)

      if (CounterBus.hasListeners) CounterBus.publishReel(event.app, committed, event.dwellMs, event.isAd)

      val settings = repository.settings()
      debugLogging = settings.debugLogging
      if (settings.dailyLimit in 1..committed) {
        CounterBus.publishLimit(event.app, committed, settings.dailyLimit)
      }
      enforcer.onCount(this@ScrollWatchService, settings, committed, sitting, event.app)
    }
  }

  // ---- Lifecycle -------------------------------------------------------------

  override fun onInterrupt() {
    if (::probeHandler.isInitialized) probeHandler.post { endSitting() }
  }

  override fun onUnbind(intent: Intent?): Boolean {
    if (::probeHandler.isInitialized) probeHandler.post { endSitting() }
    if (::overlay.isInitialized) overlay.onSurfaceExited()
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    screenOffReceiver?.let { runCatching { unregisterReceiver(it) } }
    screenOffReceiver = null
    if (::overlay.isInitialized) overlay.destroy()
    if (::probeThread.isInitialized) probeThread.quitSafely()
    writeScope.cancel()
    super.onDestroy()
  }

  companion object {
    const val TAG = "ScrollWise/Service"

    /** After the last scroll event; long enough for a reel swipe to snap into place. */
    private const val SCROLL_SETTLE_MS = 350L

    /** After a window change; long enough for the new screen to lay out. */
    private const val WINDOW_SETTLE_MS = 500L

    /**
     * While a target app is in front. Catches tab switches and leaving the app, which
     * send this service no event. Slow enough that the bounded walk costs little.
     */
    private const val POLL_MS = 1200L
  }
}
