package com.mrdoomscroller.core.detect

/**
 * Decides, from settled looks at the screen, when a new reel has been viewed.
 *
 * Pure state machine: no Android types, no I/O, no clock of its own, which is what
 * makes it testable from recorded observations.
 *
 * ## Why this replaced counting scroll events
 *
 * The first detector counted scroll events and tried to work out page changes from
 * adapter indices and deltas. On a real device it scored under 30%: Instagram's and
 * TikTok's pagers report indices and deltas inconsistently, one swipe emits a burst of
 * events, and the "am I on a reel feed" decision was made on window events, which
 * Instagram does not send when switching tabs. Leaving Reels for a profile kept the
 * surface open, and scrolling a profile grid was counted as reels.
 *
 * This version asks two questions after each swipe has settled, both answered from
 * what is actually on screen:
 *
 *  1. Is the short-form feed showing? (Decided per observation, so tab switches and
 *     profile visits are caught immediately.)
 *  2. Is the reel on it one we have not just seen? (Decided by [Fingerprint], so
 *     bounce-backs, rewatches, comment sheets and like-count changes do not count.)
 *
 * The established counters on the Play Store work the same way: they classify each
 * reel as new, the same one, or recently counted, and count only the first.
 */
class ReelCounter(
  /** A reel seen within this window is a rewatch, not a new view. */
  private val rewatchWindowMs: Long = 30 * 60 * 1000L,
  /** Bound on remembered fingerprints; oldest are forgotten first. */
  private val maxRemembered: Int = 300,
  /** Dwell longer than this means the user walked away; clamped so averages stay honest. */
  private val maxDwellMs: Int = 5 * 60 * 1000,
  /**
   * The first reel of a sitting must stay on screen this long to count. Passing
   * through the Reels tab, or a reel flashing up while the app navigates, is not
   * watching one.
   */
  private val arrivalMinDwellMs: Long = 750
) {

  private var surfaceApp: TargetApp? = null
  private var currentFingerprint: String? = null
  private var reelStartedAt: Long = 0
  private var countedInSurface: Int = 0

  /** The reel the sitting opened on, not yet counted. See [arrivalMinDwellMs]. */
  private var arrivalPending: Boolean = false
  private var arrivalIsAd: Boolean = false

  /** Fingerprint -> last time it was on screen. Insertion-ordered for cheap pruning. */
  private val recent = LinkedHashMap<String, Long>()

  val isOnSurface: Boolean get() = surfaceApp != null

  val currentApp: TargetApp? get() = surfaceApp

  fun onObservation(o: PageObservation): List<DetectorEvent> {
    val events = mutableListOf<DetectorEvent>()
    val app = o.app

    // Not on a short-form feed (another app, the home feed, a profile, a DM thread):
    // close the sitting if one was open, and count nothing.
    if (app == null || !o.onShortForm) {
      closeSurface(o.timestamp, events)
      return events
    }

    if (surfaceApp != app) {
      closeSurface(o.timestamp, events)
      openSurface(app, o, events)
      return events
    }

    // Still on the arrival reel — same identity, or no swipe since — so count it once
    // it has been watched long enough.
    if (arrivalPending && o.timestamp - reelStartedAt >= arrivalMinDwellMs &&
      (o.fingerprint == null || o.fingerprint == currentFingerprint || !o.anyScrollSinceLast)
    ) {
      commitArrival(app, o.timestamp, events)
    }

    val fingerprint = o.fingerprint
    if (fingerprint == null) {
      // Nothing readable on the page. Fall back to the swipe itself: one count per
      // settled vertical scroll. Less precise — it cannot see a rewatch — but far
      // better than counting nothing.
      if (o.scrolledSinceLast) {
        settleArrival(app, o.timestamp, events)
        countNewReel(app, o.timestamp, o.isAd, events)
      }
      return events
    }

    // Same reel still on screen: a bounce-back, a comment sheet, a like.
    if (fingerprint == currentFingerprint) {
      remember(fingerprint, o.timestamp)
      return events
    }

    // A different identity with no scroll in between is the same reel whose labels
    // changed by themselves: auto-captions, a countdown, a live viewer count.
    if (!o.anyScrollSinceLast) return events

    pruneRecent(o.timestamp)
    val seenRecently = recent.containsKey(fingerprint)
    remember(fingerprint, o.timestamp)
    settleArrival(app, o.timestamp, events)

    if (seenRecently) {
      // Scrolled back to something already counted. Move the dwell clock to it so
      // time is still attributed, but do not count it again — otherwise rocking a
      // thumb up and down would inflate the number.
      currentFingerprint = fingerprint
      reelStartedAt = o.timestamp
      return events
    }

    currentFingerprint = fingerprint
    countNewReel(app, o.timestamp, o.isAd, events)
    return events
  }

  /** The screen turned off or the service is going away. */
  fun onSessionEnd(timestamp: Long): List<DetectorEvent> {
    val events = mutableListOf<DetectorEvent>()
    closeSurface(timestamp, events)
    return events
  }

  private fun openSurface(app: TargetApp, o: PageObservation, events: MutableList<DetectorEvent>) {
    surfaceApp = app
    currentFingerprint = o.fingerprint
    reelStartedAt = o.timestamp
    countedInSurface = 0
    events.add(DetectorEvent.SurfaceEntered(app, o.timestamp))

    val fingerprint = o.fingerprint
    if (fingerprint != null) {
      pruneRecent(o.timestamp)
      val seenRecently = recent.containsKey(fingerprint)
      remember(fingerprint, o.timestamp)
      // Instagram often reopens Reels on the reel you left; that is not a new view.
      if (seenRecently) {
        arrivalPending = false
        return
      }
    }
    arrivalPending = true
    arrivalIsAd = o.isAd
  }

  /**
   * The user is moving on from the arrival reel. Count it if it was watched long
   * enough; drop it if it only flashed past.
   */
  private fun settleArrival(app: TargetApp, timestamp: Long, events: MutableList<DetectorEvent>) {
    if (!arrivalPending) return
    if (timestamp - reelStartedAt >= arrivalMinDwellMs) {
      commitArrival(app, timestamp, events)
    } else {
      arrivalPending = false
    }
  }

  private fun commitArrival(app: TargetApp, timestamp: Long, events: MutableList<DetectorEvent>) {
    arrivalPending = false
    events.add(DetectorEvent.ReelViewed(app, timestamp, 0, arrivalIsAd))
    countedInSurface++
    // reelStartedAt stays put: the arrival reel's dwell is still running.
  }

  private fun countNewReel(
    app: TargetApp,
    timestamp: Long,
    isAd: Boolean,
    events: MutableList<DetectorEvent>
  ) {
    val dwell = if (reelStartedAt > 0) clampDwell(timestamp - reelStartedAt) else 0
    events.add(DetectorEvent.ReelViewed(app, timestamp, dwell, isAd))
    reelStartedAt = timestamp
    countedInSurface++
  }

  private fun closeSurface(timestamp: Long, events: MutableList<DetectorEvent>) {
    val app = surfaceApp ?: return
    settleArrival(app, timestamp, events)
    // Watch time for the last reel, but only if some reel in this sitting counted:
    // a sitting that was only ever a flash-past adds no time either.
    if (reelStartedAt > 0 && countedInSurface > 0) {
      events.add(DetectorEvent.FinalDwell(app, timestamp, clampDwell(timestamp - reelStartedAt)))
    }
    events.add(DetectorEvent.SurfaceExited(app, timestamp))
    surfaceApp = null
    currentFingerprint = null
    reelStartedAt = 0
    countedInSurface = 0
    arrivalPending = false
    // `recent` deliberately survives: Instagram often reopens Reels on the reel you
    // left, and that should not count as a new view.
  }

  private fun clampDwell(ms: Long): Int = ms.coerceIn(0, maxDwellMs.toLong()).toInt()

  /** Re-insert rather than overwrite, so insertion order tracks last-seen order. */
  private fun remember(fingerprint: String, timestamp: Long) {
    recent.remove(fingerprint)
    recent[fingerprint] = timestamp
  }

  private fun pruneRecent(now: Long) {
    val iterator = recent.entries.iterator()
    while (iterator.hasNext()) {
      val entry = iterator.next()
      if (now - entry.value > rewatchWindowMs || recent.size > maxRemembered) {
        iterator.remove()
      } else {
        // Insertion order tracks last-seen order, so everything after this is newer.
        break
      }
    }
  }
}
