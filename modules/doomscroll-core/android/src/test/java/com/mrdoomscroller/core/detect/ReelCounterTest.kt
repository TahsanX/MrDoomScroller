package com.mrdoomscroller.core.detect

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The counting rules, pinned down without a device. Several cases are the exact
 * failures reported from the first on-device test: profile scrolling counted as
 * reels, and the same reel being counted more than once.
 */
class ReelCounterTest {

  private fun reel(
    at: Long,
    fp: String?,
    scrolled: Boolean = true,
    app: TargetApp = TargetApp.INSTAGRAM,
    ad: Boolean = false
  ) = PageObservation(at, app, onShortForm = true, fingerprint = fp, scrolledSinceLast = scrolled, isAd = ad)

  private fun notShortForm(at: Long, app: TargetApp? = TargetApp.INSTAGRAM) =
    PageObservation(at, app, onShortForm = false, fingerprint = null, scrolledSinceLast = true)

  private fun List<DetectorEvent>.reels() = count { it is DetectorEvent.ReelViewed }

  /** Enter on [fp] and wait out the arrival floor so it counts. */
  private fun ReelCounter.enterAndWatch(at: Long, fp: String?): Int =
    onObservation(reel(at, fp, scrolled = false)).reels() +
      onObservation(reel(at + 1_200, fp, scrolled = false)).reels()

  @Test
  fun `the arrival reel counts once it has been watched`() {
    val c = ReelCounter()
    val entered = c.onObservation(reel(1_000, "a", scrolled = false))
    assertTrue(entered.any { it is DetectorEvent.SurfaceEntered })
    assertEquals(0, entered.reels())
    assertEquals(1, c.onObservation(reel(2_200, "a", scrolled = false)).reels())
    // ...and never again while it stays on screen.
    assertEquals(0, c.onObservation(reel(3_400, "a", scrolled = false)).reels())
  }

  @Test
  fun `passing through reels on the way somewhere else counts nothing`() {
    val c = ReelCounter()
    c.onObservation(reel(1_000, "a", scrolled = false))
    assertEquals(0, c.onObservation(notShortForm(1_400)).reels())
  }

  @Test
  fun `swiping off the arrival reel counts both`() {
    val c = ReelCounter()
    c.onObservation(reel(1_000, "a", scrolled = false))
    assertEquals(2, c.onObservation(reel(3_000, "b")).reels())
  }

  @Test
  fun `a fast swipe off the arrival reel counts only the new one`() {
    val c = ReelCounter()
    c.onObservation(reel(1_000, "a", scrolled = false))
    assertEquals(1, c.onObservation(reel(1_300, "b")).reels())
  }

  @Test
  fun `each new reel counts once`() {
    val c = ReelCounter()
    assertEquals(1, c.enterAndWatch(1_000, "a"))
    assertEquals(1, c.onObservation(reel(4_000, "b")).reels())
    assertEquals(1, c.onObservation(reel(6_000, "c")).reels())
  }

  @Test
  fun `labels changing on their own without a swipe do not count`() {
    val c = ReelCounter()
    c.enterAndWatch(1_000, "a")
    assertEquals(0, c.onObservation(reel(3_400, "a-new-caption", scrolled = false)).reels())
    assertEquals(0, c.onObservation(reel(4_600, "a-other-caption", scrolled = false)).reels())
    assertEquals(1, c.onObservation(reel(5_000, "b", scrolled = true)).reels())
  }

  @Test
  fun `scrolling back to an earlier reel does not count`() {
    val c = ReelCounter()
    c.enterAndWatch(1_000, "a")
    c.onObservation(reel(4_000, "b"))
    assertEquals(0, c.onObservation(reel(6_000, "a")).reels())
    assertEquals(0, c.onObservation(reel(8_000, "b")).reels())
    assertEquals(1, c.onObservation(reel(10_000, "c")).reels())
  }

  @Test
  fun `scrolling a profile or the home feed counts nothing`() {
    val c = ReelCounter()
    repeat(20) { i ->
      assertEquals(0, c.onObservation(notShortForm(1_000L + i * 400)).reels())
    }
    assertFalse(c.isOnSurface)
  }

  @Test
  fun `leaving reels for a profile closes the sitting immediately`() {
    val c = ReelCounter()
    c.enterAndWatch(1_000, "a")
    val events = c.onObservation(notShortForm(4_000))
    assertTrue(events.any { it is DetectorEvent.SurfaceExited })
    assertFalse(c.isOnSurface)
    assertEquals(0, c.onObservation(notShortForm(5_000)).reels())
  }

  @Test
  fun `leaving after watching only the arrival reel still counts it`() {
    val c = ReelCounter()
    c.onObservation(reel(1_000, "a", scrolled = false))
    val events = c.onObservation(notShortForm(3_000, app = null))
    assertEquals(1, events.reels())
    assertEquals(2_000, events.filterIsInstance<DetectorEvent.FinalDwell>().single().dwellMs)
  }

  @Test
  fun `dwell on a new reel is the time spent on the previous one`() {
    val c = ReelCounter()
    c.enterAndWatch(1_000, "a")
    val next = c.onObservation(reel(4_500, "b")).filterIsInstance<DetectorEvent.ReelViewed>().single()
    assertEquals(3_500, next.dwellMs)
  }

  @Test
  fun `returning to reels on the reel you left does not recount it`() {
    val c = ReelCounter()
    c.enterAndWatch(1_000, "a")
    c.onObservation(notShortForm(3_000))
    val back = c.onObservation(reel(10_000, "a", scrolled = false))
    assertTrue(back.any { it is DetectorEvent.SurfaceEntered })
    assertEquals(0, back.reels() + c.onObservation(reel(11_200, "a", scrolled = false)).reels())
  }

  @Test
  fun `a reel seen long ago counts again`() {
    val c = ReelCounter(rewatchWindowMs = 60_000)
    c.enterAndWatch(1_000, "a")
    c.onObservation(reel(4_000, "b"))
    assertEquals(1, c.onObservation(reel(200_000, "a")).reels())
  }

  @Test
  fun `without a fingerprint each settled swipe counts once`() {
    val c = ReelCounter()
    assertEquals(1, c.enterAndWatch(1_000, null))
    assertEquals(0, c.onObservation(reel(3_400, null, scrolled = false)).reels())
    assertEquals(1, c.onObservation(reel(4_000, null, scrolled = true)).reels())
  }

  @Test
  fun `ads are counted and tagged`() {
    val c = ReelCounter()
    c.enterAndWatch(1_000, "a")
    val ad = c.onObservation(reel(4_000, "sponsored-one", ad = true))
      .filterIsInstance<DetectorEvent.ReelViewed>().single()
    assertTrue(ad.isAd)
  }

  @Test
  fun `switching apps starts a new sitting`() {
    val c = ReelCounter()
    c.enterAndWatch(1_000, "a")
    val events = c.onObservation(reel(5_000, "z", app = TargetApp.YOUTUBE))
    assertTrue(events.any { it is DetectorEvent.SurfaceExited && it.app == TargetApp.INSTAGRAM })
    assertTrue(events.any { it is DetectorEvent.SurfaceEntered && it.app == TargetApp.YOUTUBE })
    assertEquals(1, c.onObservation(reel(6_200, "z", scrolled = false, app = TargetApp.YOUTUBE)).reels())
  }
}
