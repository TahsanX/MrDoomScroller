package com.mrdoomscroller.core.detect

import kotlin.math.abs
import kotlin.math.min

/**
 * Turns a stream of accessibility signals into "a reel was viewed" decisions.
 *
 * Pure state machine: no Android types, no I/O, no clock of its own. Everything comes
 * in through [onWindow] and [onScroll] and comes out as [DetectorEvent]s, which is what
 * makes it testable against recorded fixtures.
 *
 * ## How an advance is detected
 *
 * Hardcoding view ids is the obvious approach and the one that breaks on every app
 * update: Instagram and TikTok are largely custom-drawn and expose very few stable
 * ids. Instead three tiers are tried, in order of how much they can be trusted.
 *
 *  1. **Adapter index.** If the source reports toIndex/itemCount, a page change is
 *     unambiguous, and a multi-page fling can be recovered exactly.
 *  2. **Scroll delta.** API 28+ reports per-event deltas. Accumulating them and
 *     emitting one advance per container-height crossed handles slow drags and flings
 *     alike, and comparing horizontal against vertical movement is what rejects
 *     carousels.
 *  3. **Debounced event count.** Last resort: one advance per event, rate-limited.
 *
 * Tiers 1 and 2 are per-profile opt-out, because a source reporting garbage indices is
 * worse than one reporting none at all.
 */
class ReelDetector(
  private val profiles: Map<String, DetectionProfile>,
  /** Dwell longer than this means the user walked away; clamped so averages stay honest. */
  private val maxDwellMs: Int = 5 * 60 * 1000,
  /** Guards against one fling being reported as an absurd index jump. */
  private val maxAdvancesPerEvent: Int = 10
) {

  private var surfaceApp: TargetApp? = null
  private var reelStartedAt: Long = 0
  private var lastAdvanceAt: Long = 0
  private var lastToIndex: Int = -1
  private var accumulatedDeltaY: Float = 0f
  private var sawActionColumn: Boolean = false

  val isOnSurface: Boolean get() = surfaceApp != null

  val currentApp: TargetApp? get() = surfaceApp

  fun profileFor(app: TargetApp): DetectionProfile =
    profiles[app.id] ?: DetectionProfile.defaultFor(app.id)

  /**
   * A window changed. This is the only thing that opens or closes a surface, so a
   * detector that never recognises a surface never counts anything. That is the
   * deliberate failure mode: silence rather than fiction.
   */
  fun onWindow(signal: WindowSignal): List<DetectorEvent> {
    val events = mutableListOf<DetectorEvent>()
    val app = signal.app

    val looksLikeFeed = app != null &&
      (profileFor(app).looksLikeSurface(signal.className, signal.viewIdResourceName) ||
        signal.hasActionColumn)

    val current = surfaceApp
    if (current != null && (app != current || !looksLikeFeed)) {
      // Close out the reel that was on screen. Without this the last reel of every
      // session would go uncounted and every total would sit one light.
      closeCurrentReel(signal.timestamp)?.let(events::add)
      events.add(DetectorEvent.SurfaceExited(current, signal.timestamp))
      reset()
    }

    if (app != null && looksLikeFeed && surfaceApp != app) {
      surfaceApp = app
      reelStartedAt = signal.timestamp
      lastAdvanceAt = 0
      lastToIndex = -1
      accumulatedDeltaY = 0f
      sawActionColumn = signal.hasActionColumn
      events.add(DetectorEvent.SurfaceEntered(app, signal.timestamp))
    }

    return events
  }

  fun onScroll(signal: ScrollSignal): List<DetectorEvent> {
    val app = surfaceApp ?: return emptyList()
    if (signal.app != app) return emptyList()

    val profile = profileFor(app)
    if (signal.hasActionColumn) sawActionColumn = true

    if (!isPlausibleFeedScroll(signal, profile)) return emptyList()

    val advances = countAdvances(signal, profile)
    if (advances <= 0) return emptyList()

    // A single gesture emits a burst of scroll events; without this the counter runs
    // away. Checked after advance counting so the index tier can still recover a
    // genuine multi-page jump that arrives inside one event.
    if (lastAdvanceAt != 0L && signal.timestamp - lastAdvanceAt < profile.minGapMs) {
      return emptyList()
    }

    val capped = min(advances, maxAdvancesPerEvent)
    val events = mutableListOf<DetectorEvent>()
    repeat(capped) {
      // Dwell is split evenly across a multi-page fling. An approximation, and only
      // ever used for averages: never for the count itself.
      val span = (signal.timestamp - reelStartedAt).coerceAtLeast(0)
      val dwell = (span / capped).coerceIn(0, maxDwellMs.toLong())
      events.add(DetectorEvent.ReelViewed(app, signal.timestamp, dwell.toInt()))
      reelStartedAt = signal.timestamp
    }
    lastAdvanceAt = signal.timestamp
    return events
  }

  /** The app went to the background, or the screen turned off. */
  fun onSessionEnd(timestamp: Long): List<DetectorEvent> {
    val app = surfaceApp ?: return emptyList()
    val events = mutableListOf<DetectorEvent>()
    closeCurrentReel(timestamp)?.let(events::add)
    events.add(DetectorEvent.SurfaceExited(app, timestamp))
    reset()
    return events
  }

  private fun closeCurrentReel(timestamp: Long): DetectorEvent.ReelViewed? {
    val app = surfaceApp ?: return null
    if (reelStartedAt <= 0) return null
    val dwell = (timestamp - reelStartedAt).coerceIn(0, maxDwellMs.toLong())
    // A reel on screen for a blink was never really viewed. This is the one place a
    // dwell floor belongs, because there is no swipe backing the count up.
    if (dwell < MIN_CLOSING_DWELL_MS) return null
    return DetectorEvent.ReelViewed(app, timestamp, dwell.toInt())
  }

  /**
   * Structural sanity checks: these reject the comment sheet, the Explore grid and
   * horizontal carousels, the three biggest sources of phantom counts.
   */
  private fun isPlausibleFeedScroll(signal: ScrollSignal, profile: DetectionProfile): Boolean {
    // A nested scrollable covering a fraction of the screen is a comment sheet, a
    // caption or a story tray. Not the feed.
    if (signal.sourceHeightPx > 0 && signal.heightRatio < profile.minHeightRatio) return false

    // Clearly horizontal movement is a carousel or a tab swipe, never a reel advance.
    if (signal.scrollDeltaX != 0 && abs(signal.scrollDeltaX) > abs(signal.scrollDeltaY)) return false

    // Unknown container class is allowed only when the action column vouches for it,
    // so a redesign degrades to under-counting rather than to nonsense.
    if (signal.sourceClassName != null &&
      !profile.looksLikePager(signal.sourceClassName) &&
      !sawActionColumn
    ) {
      return false
    }

    if (profile.requireActionColumn && !sawActionColumn) return false

    return true
  }

  private fun countAdvances(signal: ScrollSignal, profile: DetectionProfile): Int {
    // Tier 1: adapter index.
    if (profile.trustIndex && signal.itemCount > 0 && signal.toIndex >= 0) {
      val previous = lastToIndex
      lastToIndex = signal.toIndex
      // The first reading only establishes a baseline.
      if (previous < 0) return 0
      // Only forward movement counts. Scrolling back up to rewatch something is not a
      // new reel, and counting it would let a user inflate their own number by
      // rocking one thumb back and forth.
      if (signal.toIndex <= previous) return 0
      return min(signal.toIndex - previous, maxAdvancesPerEvent)
    }

    // Tier 2: accumulated vertical delta.
    if (profile.trustDelta && signal.scrollDeltaY != 0) {
      val containerPx = signal.sourceHeightPx.takeIf { it > 0 } ?: signal.screenHeightPx
      val pagePx = containerPx * profile.pageRatio
      if (pagePx <= 1f) return 0
      if (signal.scrollDeltaY < 0) {
        // Upward: a rewatch. Drop the accumulator so a jitter back and forth cannot
        // ratchet the count upward.
        accumulatedDeltaY = 0f
        return 0
      }
      accumulatedDeltaY += signal.scrollDeltaY
      var advances = 0
      while (accumulatedDeltaY >= pagePx && advances < maxAdvancesPerEvent) {
        accumulatedDeltaY -= pagePx
        advances++
      }
      return advances
    }

    // Tier 3: one advance per event, with the de-bounce in onScroll doing the work.
    return 1
  }

  private fun reset() {
    surfaceApp = null
    reelStartedAt = 0
    lastAdvanceAt = 0
    lastToIndex = -1
    accumulatedDeltaY = 0f
    sawActionColumn = false
  }

  companion object {
    /**
     * A reel closed out by leaving the app counts only if it was on screen at least
     * this long, so a stray window event cannot invent one.
     */
    const val MIN_CLOSING_DWELL_MS = 700L
  }
}
