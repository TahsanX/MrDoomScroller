package com.mrdoomscroller.core.detect

/**
 * Recognises a sponsored reel from the labels on its page.
 *
 * Ads are still counted — swiping past one is still a swipe — but they are tagged,
 * so the dashboard can say how many of the day's reels were ads.
 *
 * The rules follow what the platforms actually render, and match whole labels rather
 * than words inside a caption, so a creator writing "this is not an ad" in their
 * caption is not flagged:
 *
 * - Instagram's video carries a description starting "Sponsored Reel by …", and a
 *   "Sponsored" label sits under the account name.
 * - YouTube Shorts shows a standalone "Ad" badge.
 * - Facebook shows "Sponsored" or "Paid partnership".
 * - Every platform's ads carry a call-to-action button with a fixed label.
 */
object AdDetector {

  private val EXACT = setOf("sponsored", "paid partnership", "ad", "promoted")

  private const val INSTAGRAM_SPONSORED = "sponsored reel by "

  private val PREFIXES = listOf("sponsored ", "sponsored·", "sponsored ·", "paid partnership")

  /** Call-to-action button labels that only ever appear on ads. */
  private val CALL_TO_ACTION = setOf(
    // Bare "download" and "install" are left out on purpose: share sheets use them on
    // ordinary reels.
    "shop now", "watch more", "sign up", "install now", "order now", "download now",
    "send whatsapp message", "get quote", "see menu", "play game", "learn more",
    "apply now", "book now", "get app", "get offer", "get directions", "subscribe now",
    "use app", "open app", "buy now", "get started", "contact us", "send message",
    // Bangla, for a phone set to Bangla.
    "স্পনসর্ড", "প্রচারিত", "আরও জানুন", "এখনই কিনুন", "ইনস্টল করুন"
  )

  fun isAd(labels: List<String>): Boolean {
    for (raw in labels) {
      // Lowercased, trimmed and with whitespace collapsed, but otherwise intact:
      // the match is on the whole label.
      val label = raw.trim().lowercase().replace(WHITESPACE, " ")
      if (label.isEmpty()) continue
      // Instagram's sponsored description carries the whole caption after the prefix,
      // so this one is checked before the length cut-off.
      if (label.startsWith(INSTAGRAM_SPONSORED)) return true
      if (label.length > MAX_LABEL_LENGTH) continue
      if (label in EXACT) return true
      if (label in CALL_TO_ACTION) return true
      if (PREFIXES.any { label.startsWith(it) }) return true
    }
    return false
  }

  /** Long labels are captions, where these words mean nothing. */
  private const val MAX_LABEL_LENGTH = 120

  private val WHITESPACE = Regex("\\s+")
}
