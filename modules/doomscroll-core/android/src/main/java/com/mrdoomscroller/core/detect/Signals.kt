package com.mrdoomscroller.core.detect

/**
 * One look at the screen, taken after scrolling has settled.
 *
 * The service produces these from the live node tree; [ReelCounter] consumes them.
 * Keeping the counter on this flattened type rather than on `AccessibilityNodeInfo`
 * is what lets the counting rules be unit-tested with no device.
 */
data class PageObservation(
  val timestamp: Long,
  /** Null when the foreground app is not one we count. */
  val app: TargetApp?,
  /**
   * A full-screen vertical pager whose pages are each the height of the screen is on
   * screen. This is the shape every short-form player shares and that a home feed,
   * a profile grid or a comment sheet does not.
   */
  val onShortForm: Boolean,
  /**
   * Anonymous identity of the reel currently on screen, or null when the page
   * exposed nothing usable. Never the text itself — see [Fingerprint].
   */
  val fingerprint: String?,
  /**
   * Something feed-sized was scrolled vertically since the previous observation.
   * Drives the fallback for pages with no fingerprint.
   */
  val scrolledSinceLast: Boolean,
  /**
   * Any scroll at all in the app since the previous observation. A reel cannot change
   * without one, so a fingerprint that changes without a scroll is the same reel with
   * a live label (auto-captions, a timer) and must not count.
   */
  val anyScrollSinceLast: Boolean = scrolledSinceLast,
  /** The reel on screen carries a sponsored marker. See [AdDetector]. */
  val isAd: Boolean = false
)

/** What the counter concluded. Emitted in order. */
sealed interface DetectorEvent {

  /** The user arrived on a short-form feed in [app]. */
  data class SurfaceEntered(val app: TargetApp, val timestamp: Long) : DetectorEvent

  /** The user left the short-form feed. */
  data class SurfaceExited(val app: TargetApp, val timestamp: Long) : DetectorEvent

  /**
   * A reel the user had not seen recently came on screen.
   *
   * Counted when it arrives by a swipe, so the floating counter ticks with the thumb.
   * The first reel of a sitting is the exception: it is counted only once it has been
   * on screen long enough to have been watched, so passing through Reels on the way
   * to somewhere else does not count. [dwellMs] is how long the *previous* reel was on
   * screen — the only dwell known at this moment — and 0 for the first reel.
   */
  data class ReelViewed(
    val app: TargetApp,
    val timestamp: Long,
    val dwellMs: Int,
    /** Counted like any other reel, but tagged so ads can be shown separately. */
    val isAd: Boolean = false
  ) : DetectorEvent

  /**
   * The last reel of a sitting has been left. Carries its dwell so watch time is not
   * short by one reel per sitting; it is not a new reel and is not counted.
   */
  data class FinalDwell(val app: TargetApp, val timestamp: Long, val dwellMs: Int) : DetectorEvent
}
