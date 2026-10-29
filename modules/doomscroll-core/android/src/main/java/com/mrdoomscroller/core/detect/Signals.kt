package com.mrdoomscroller.core.detect

/**
 * A flattened, immutable snapshot of one `TYPE_VIEW_SCROLLED` event plus the bits of
 * node context the detector needs.
 *
 * The detector takes these rather than `AccessibilityEvent` so its logic is pure and
 * can be unit-tested from recorded fixtures with no device and no Android runtime.
 */
data class ScrollSignal(
  val timestamp: Long,
  val app: TargetApp,
  /** Class name reported by the scrolling source, e.g. `androidx.viewpager2.widget.ViewPager2`. */
  val sourceClassName: String?,
  val viewIdResourceName: String?,
  /** Adapter position range, or -1 when the source does not report one. */
  val fromIndex: Int = -1,
  val toIndex: Int = -1,
  val itemCount: Int = -1,
  /** API 28+ scroll deltas; 0 when unavailable or unreported. */
  val scrollDeltaX: Int = 0,
  val scrollDeltaY: Int = 0,
  val sourceHeightPx: Int = 0,
  val sourceWidthPx: Int = 0,
  val screenHeightPx: Int = 1,
  val screenWidthPx: Int = 1,
  /** A vertically stacked like/comment/share column was found in the subtree. */
  val hasActionColumn: Boolean = false
) {
  val heightRatio: Float
    get() = if (screenHeightPx <= 0) 0f else sourceHeightPx.toFloat() / screenHeightPx

  val widthRatio: Float
    get() = if (screenWidthPx <= 0) 0f else sourceWidthPx.toFloat() / screenWidthPx
}

/**
 * A `TYPE_WINDOW_STATE_CHANGED` event. Used only to decide whether the app is
 * currently showing a short-form feed, which gates everything else.
 */
data class WindowSignal(
  val timestamp: Long,
  val app: TargetApp?,
  val packageName: String?,
  val className: String?,
  val viewIdResourceName: String?,
  val hasActionColumn: Boolean = false
)

/** What the detector concluded. Emitted in order. */
sealed interface DetectorEvent {

  /** The user entered a short-form feed in [app]. */
  data class SurfaceEntered(val app: TargetApp, val timestamp: Long) : DetectorEvent

  /** The user left the short-form feed. */
  data class SurfaceExited(val app: TargetApp, val timestamp: Long) : DetectorEvent

  /**
   * One reel was viewed and is now finished with.
   *
   * [dwellMs] is how long it was on screen. It is recorded, never used to decide
   * whether to count: a user who flings past twenty reels in five seconds has
   * doomscrolled twenty reels, and that is precisely the behaviour worth surfacing.
   */
  data class ReelViewed(
    val app: TargetApp,
    val timestamp: Long,
    val dwellMs: Int
  ) : DetectorEvent
}
