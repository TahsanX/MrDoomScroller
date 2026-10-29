package com.mrdoomscroller.core.detect

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The detector is a pure state machine, so the cases that matter can be pinned down
 * here with no device and no emulator.
 *
 * These are the false positives that would destroy trust in the number: a comment
 * sheet scroll, a horizontal carousel, and rocking a thumb up and down to inflate
 * the count. Each one gets a test.
 */
class ReelDetectorTest {

  private val profile = DetectionProfile(
    appId = "instagram",
    surfaceClassMarkers = listOf("clips"),
    pagerClassMarkers = listOf("RecyclerView", "ViewPager"),
    actionKeywords = listOf("like", "comment"),
    minHeightRatio = 0.8f,
    minGapMs = 350,
    pageRatio = 0.6f,
    requireActionColumn = false,
    experimental = false
  )

  private fun detector() = ReelDetector(mapOf("instagram" to profile))

  private fun enterFeed(d: ReelDetector, at: Long = 1_000): List<DetectorEvent> =
    d.onWindow(
      WindowSignal(
        timestamp = at,
        app = TargetApp.INSTAGRAM,
        packageName = "com.instagram.android",
        className = "com.instagram.clips.viewer.ClipsViewerFragment",
        viewIdResourceName = null
      )
    )

  private fun scroll(
    at: Long,
    toIndex: Int = -1,
    itemCount: Int = -1,
    deltaY: Int = 0,
    deltaX: Int = 0,
    sourceHeight: Int = 2000,
    sourceWidth: Int = 1080,
    cls: String? = "androidx.recyclerview.widget.RecyclerView",
    actions: Boolean = true
  ) = ScrollSignal(
    timestamp = at,
    app = TargetApp.INSTAGRAM,
    sourceClassName = cls,
    viewIdResourceName = null,
    toIndex = toIndex,
    itemCount = itemCount,
    scrollDeltaX = deltaX,
    scrollDeltaY = deltaY,
    sourceHeightPx = sourceHeight,
    sourceWidthPx = sourceWidth,
    screenHeightPx = 2000,
    screenWidthPx = 1080,
    hasActionColumn = actions
  )

  private fun List<DetectorEvent>.reels() = count { it is DetectorEvent.ReelViewed }

  @Test
  fun `entering a recognised feed opens a surface`() {
    val d = detector()
    val events = enterFeed(d)
    assertTrue(events.any { it is DetectorEvent.SurfaceEntered })
    assertTrue(d.isOnSurface)
  }

  @Test
  fun `scrolls outside a recognised feed are ignored`() {
    val d = detector()
    // No window event first, so no surface is open.
    assertEquals(0, d.onScroll(scroll(at = 2_000, toIndex = 4, itemCount = 50)).reels())
  }

  @Test
  fun `index tier counts one reel per page advance`() {
    val d = detector()
    enterFeed(d)
    // First reading only establishes the baseline.
    assertEquals(0, d.onScroll(scroll(at = 2_000, toIndex = 0, itemCount = 50)).reels())
    assertEquals(1, d.onScroll(scroll(at = 4_000, toIndex = 1, itemCount = 50)).reels())
    assertEquals(1, d.onScroll(scroll(at = 6_000, toIndex = 2, itemCount = 50)).reels())
  }

  @Test
  fun `a fast fling across three pages counts three`() {
    val d = detector()
    enterFeed(d)
    d.onScroll(scroll(at = 2_000, toIndex = 0, itemCount = 50))
    // The whole point: flinging past reels without watching them is still
    // doomscrolling, and gating on dwell time would score it zero.
    val events = d.onScroll(scroll(at = 2_600, toIndex = 3, itemCount = 50))
    assertEquals(3, events.reels())
  }

  @Test
  fun `scrolling back up does not count`() {
    val d = detector()
    enterFeed(d)
    d.onScroll(scroll(at = 2_000, toIndex = 5, itemCount = 50))
    assertEquals(0, d.onScroll(scroll(at = 4_000, toIndex = 4, itemCount = 50)).reels())
    // ...and rocking back to where we were must not re-count it either.
    assertEquals(0, d.onScroll(scroll(at = 6_000, toIndex = 4, itemCount = 50)).reels())
  }

  @Test
  fun `a comment sheet scroll is rejected on height`() {
    val d = detector()
    enterFeed(d)
    d.onScroll(scroll(at = 2_000, toIndex = 0, itemCount = 50))
    // A nested list covering 40% of the screen is a comment sheet, not the feed.
    val events = d.onScroll(
      scroll(at = 4_000, toIndex = 1, itemCount = 50, sourceHeight = 800)
    )
    assertEquals(0, events.reels())
  }

  @Test
  fun `a horizontal carousel swipe is rejected`() {
    val d = detector()
    enterFeed(d)
    d.onScroll(scroll(at = 2_000, toIndex = 0, itemCount = 50))
    val events = d.onScroll(
      scroll(at = 4_000, toIndex = 1, itemCount = 50, deltaX = 900, deltaY = 10)
    )
    assertEquals(0, events.reels())
  }

  @Test
  fun `an event burst from one gesture counts once`() {
    val d = detector()
    enterFeed(d)
    d.onScroll(scroll(at = 2_000, deltaY = 10, sourceHeight = 2000))
    // Delta tier: 1200px is one page at pageRatio 0.6 of a 2000px container.
    val first = d.onScroll(scroll(at = 2_100, deltaY = 1_300))
    // Arrives 50ms later, inside the de-bounce window.
    val second = d.onScroll(scroll(at = 2_150, deltaY = 1_300))
    assertEquals(1, first.reels())
    assertEquals(0, second.reels())
  }

  @Test
  fun `delta tier ignores upward movement`() {
    val d = detector()
    enterFeed(d)
    assertEquals(0, d.onScroll(scroll(at = 2_000, deltaY = -1_500)).reels())
  }

  @Test
  fun `leaving the feed closes out the reel on screen`() {
    val d = detector()
    enterFeed(d, at = 1_000)
    // Left the app 4 seconds later: that reel was genuinely watched and must count,
    // otherwise every session total sits one light.
    val events = d.onSessionEnd(5_000)
    assertEquals(1, events.reels())
    assertTrue(events.any { it is DetectorEvent.SurfaceExited })
  }

  @Test
  fun `a blink on screen is not counted as a reel`() {
    val d = detector()
    enterFeed(d, at = 1_000)
    assertEquals(0, d.onSessionEnd(1_200).reels())
  }

  @Test
  fun `dwell time is recorded against the reel being left`() {
    val d = detector()
    enterFeed(d, at = 1_000)
    d.onScroll(scroll(at = 2_000, toIndex = 0, itemCount = 50))
    val events = d.onScroll(scroll(at = 5_000, toIndex = 1, itemCount = 50))
    val reel = events.filterIsInstance<DetectorEvent.ReelViewed>().single()
    assertEquals(4_000, reel.dwellMs)
  }

  @Test
  fun `moving to a non-feed screen in the same app closes the surface`() {
    val d = detector()
    enterFeed(d)
    val events = d.onWindow(
      WindowSignal(
        timestamp = 8_000,
        app = TargetApp.INSTAGRAM,
        packageName = "com.instagram.android",
        className = "com.instagram.direct.inbox.InboxFragment",
        viewIdResourceName = null
      )
    )
    assertTrue(events.any { it is DetectorEvent.SurfaceExited })
    assertTrue(!d.isOnSurface)
  }

  @Test
  fun `an unknown container class needs the action column to vouch for it`() {
    val d = detector()
    enterFeed(d)
    d.onScroll(scroll(at = 2_000, toIndex = 0, itemCount = 50, cls = "X", actions = false))
    val withoutActions = d.onScroll(
      scroll(at = 4_000, toIndex = 1, itemCount = 50, cls = "com.obfuscated.X", actions = false)
    )
    assertEquals(0, withoutActions.reels())
  }
}
