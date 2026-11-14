package com.scrollwise.core.detect

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Synthetic Facebook screens on a 1080×2400 display. The layouts are simplified, but
 * the geometry is what matters to [EdgeColumn].
 */
class EdgeColumnTest {

  private val w = 1080
  private val h = 2400

  private fun node(
    text: String? = null,
    desc: String? = null,
    cls: String = "android.view.ViewGroup",
    l: Int,
    t: Int,
    r: Int,
    b: Int
  ) = NodeSnap(text, desc, cls, l, t, r, b)

  /** A Reels player: video surface, counted action stack on the right, author, caption. */
  private fun reel(author: String = "Rahim Uddin", caption: String = "Sunset over the river in Sylhet, best evening of the year") = listOf(
    node(desc = "Video", l = 0, t = 0, r = w, b = h),
    node(desc = "Like, 12K", cls = "android.widget.Button", l = 960, t = 1300, r = 1060, b = 1400),
    node(desc = "Comment, 345", cls = "android.widget.Button", l = 960, t = 1460, r = 1060, b = 1560),
    node(desc = "Share, 89", cls = "android.widget.Button", l = 960, t = 1620, r = 1060, b = 1720),
    node(text = author, desc = author, cls = "android.widget.Button", l = 40, t = 1900, r = 400, b = 1960),
    node(desc = caption, l = 40, t = 1980, r = 900, b = 2100)
  )

  /** Three short feed posts, each with its own Like/Comment/Share row. */
  private fun feedRows(): List<NodeSnap> = (0 until 3).flatMap { i ->
    val y = 500 + i * 650
    listOf(
      node(desc = "Like button", cls = "android.widget.Button", l = 20, t = y, r = 360, b = y + 100),
      node(desc = "Comment", cls = "android.widget.Button", l = 360, t = y, r = 720, b = y + 100),
      node(desc = "Share", cls = "android.widget.Button", l = 720, t = y, r = 1060, b = y + 100)
    )
  }

  @Test
  fun `a reels player is found strictly`() {
    val verdict = EdgeColumn.evaluate(reel(), w, h, strict = true)
    assertTrue(verdict.reason, verdict.found)
  }

  @Test
  fun `stacked feed like buttons fool loose mode but not strict mode`() {
    // The bug this exists for: one "Like" per post lines up at the left edge.
    assertTrue(EdgeColumn.evaluate(feedRows(), w, h, strict = false).found)
    assertFalse(EdgeColumn.evaluate(feedRows(), w, h, strict = true).found)
  }

  @Test
  fun `a tall video post in the feed is not a reel`() {
    // Full-width video with a counted row underneath, not a column.
    val post = listOf(
      node(desc = "Video", l = 0, t = 300, r = w, b = 1700),
      node(desc = "Like, 1.2K", cls = "android.widget.Button", l = 20, t = 1750, r = 360, b = 1850),
      node(desc = "Comment, 40", cls = "android.widget.Button", l = 360, t = 1750, r = 720, b = 1850),
      node(desc = "Share, 3", cls = "android.widget.Button", l = 720, t = 1750, r = 1060, b = 1850)
    )
    assertFalse(EdgeColumn.evaluate(post, w, h, strict = true).found)
  }

  @Test
  fun `the same action repeated is not enough`() {
    val repeated = listOf(
      node(desc = "Video", l = 0, t = 0, r = w, b = h),
      node(desc = "Like, 12K", cls = "android.widget.Button", l = 960, t = 1300, r = 1060, b = 1400),
      node(desc = "Like, 13K", cls = "android.widget.Button", l = 960, t = 1460, r = 1060, b = 1560)
    )
    val verdict = EdgeColumn.evaluate(repeated, w, h, strict = true)
    assertFalse(verdict.found)
  }

  @Test
  fun `no media surface means no reel`() {
    val noMedia = reel().drop(1)
    assertFalse(EdgeColumn.evaluate(noMedia, w, h, strict = true).found)
  }

  @Test
  fun `identity is author and caption start, not counts`() {
    val a = EdgeColumn.evaluate(reel(), w, h, strict = true)
    val countsChanged = reel().map {
      if (it.desc == "Like, 12K") it.copy(desc = "Like, 13K") else it
    }
    val b = EdgeColumn.evaluate(countsChanged, w, h, strict = true)
    assertEquals(a.identity, b.identity)
    assertEquals("Rahim Uddin", a.identity.first())
  }

  @Test
  fun `a different reel has a different identity`() {
    val a = EdgeColumn.evaluate(reel(), w, h, strict = true)
    val b = EdgeColumn.evaluate(reel(author = "Karim Ahmed", caption = "Street food tour of old Dhaka at midnight"), w, h, strict = true)
    assertTrue(a.identity != b.identity)
  }

  @Test
  fun `a comment box with no player reads as typing`() {
    val typing = listOf(node(cls = "android.widget.EditText", l = 0, t = 2200, r = w, b = 2300))
    val verdict = EdgeColumn.evaluate(typing, w, h, strict = true)
    assertFalse(verdict.found)
    assertTrue(verdict.typing)
  }

  @Test
  fun `bangla labels and digits count`() {
    val bn = listOf(
      node(desc = "ভিডিও", l = 0, t = 0, r = w, b = h),
      node(desc = "লাইক ১২হা", cls = "android.widget.Button", l = 960, t = 1300, r = 1060, b = 1400),
      node(desc = "কমেন্ট ৩৪৫", cls = "android.widget.Button", l = 960, t = 1460, r = 1060, b = 1560)
    )
    assertTrue(EdgeColumn.evaluate(bn, w, h, strict = true).found)
  }
}
