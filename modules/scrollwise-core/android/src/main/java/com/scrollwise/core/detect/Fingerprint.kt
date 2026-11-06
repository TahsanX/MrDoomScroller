package com.scrollwise.core.detect

import java.security.MessageDigest

/**
 * Reduces the labels on one reel's page to an anonymous identity.
 *
 * Telling "the next reel" from "the same reel again" is what accuracy hinges on: a
 * swipe that bounces back, a scroll back up to rewatch, a comment sheet opening, a
 * like count ticking from 12.3K to 12.4K, the user tapping like — none of these is a
 * new reel, and every scroll-event heuristic gets at least one of them wrong.
 * Comparing the identity of what is on screen gets all of them right.
 *
 * Privacy: the labels (username, caption, audio name) exist only inside [of] and are
 * hashed before it returns. Nothing readable is kept, logged or stored — only a
 * truncated SHA-256, held in memory long enough to recognise a rewatch.
 */
object Fingerprint {

  /**
   * Words every reel's controls share, plus counters and relative times. Removed
   * token by token, not label by label: "Like. 12.4K likes." and, after the user taps
   * it, "Unlike. 12.5K likes." must both reduce to nothing, or liking a reel would
   * look like a new one.
   */
  private val GENERIC_TOKENS = setOf(
    // Actions and their state variants.
    "like", "liked", "likes", "unlike", "dislike", "disliked", "comment", "comments",
    "share", "shares", "send", "save", "saved", "remix", "repost", "reposts", "favorite",
    "favorites", "follow", "following", "followers", "subscribe", "subscribed",
    "unsubscribe", "more", "options", "menu", "close", "back", "search", "camera",
    "mute", "unmute", "muted", "pause", "paused", "play", "playing", "replay",
    "double", "tap", "to", "turn", "on", "off", "add", "view", "views", "viewed",
    "see", "translation", "less", "this", "the", "and", "or", "of", "a", "an", "by",
    // Surfaces and chrome.
    "reels", "reel", "shorts", "short", "spotlight", "explore", "home", "profile",
    "friends", "for", "you", "inbox", "discover", "video", "videos", "image", "photo",
    "captions", "caption", "sponsored", "ad", "ads", "paid", "partnership",
    // Audio labels, which are often shared across many reels.
    "audio", "original", "sound", "music",
    // Ad call-to-action buttons and playback chrome.
    "progress", "install", "learn", "shop", "download", "order", "quote", "menu", "game",
    "apply", "book", "offer", "directions", "app",
    // The same controls in Bangla, since a Bangla-language phone labels them so.
    "লাইক", "লাইক করুন", "করুন", "কমেন্ট", "মন্তব্য", "শেয়ার", "শেয়ার", "সেভ", "ফলো",
    "আরও", "অডিও", "মূল", "রিলস", "শর্টস",
    // Bangla count words: "১২ হাজার" becomes "১২ লাখ" while the same reel plays.
    "হাজার", "লাখ", "কোটি", "মিলিয়ন", "ভিউ", "বার",
    // Relative time and count suffixes, left over once digits are stripped.
    "ago", "now", "just", "second", "seconds", "minute", "minutes", "hour", "hours",
    "day", "days", "week", "weeks", "month", "months", "year", "years", "yesterday",
    "sec", "min", "hr", "hrs", "wk", "wks", "mo", "yr", "yrs", "k", "m", "b"
  )

  /** Enough distinct labels to identify a reel; more only costs time. */
  private const val MAX_LABELS = 12

  /** Hex characters kept from the digest. 64 bits is plenty to tell reels apart. */
  private const val HASH_HEX_LENGTH = 16

  /**
   * @param labels text and content descriptions collected from the visible page.
   * @param extraGeneric per-app tokens to ignore, from the detection profile.
   * @return a short hex identity, or null when nothing distinctive was left — the
   *   caller then falls back to counting the swipe itself.
   */
  fun of(labels: List<String>, extraGeneric: Set<String> = emptySet()): String? {
    val distinct = sortedSetOf<String>()
    for (raw in labels) {
      val tokens = tokens(raw).filter { it !in GENERIC_TOKENS && it !in extraGeneric }
      if (tokens.isEmpty()) continue
      distinct.add(tokens.joinToString(" "))
    }
    if (distinct.isEmpty()) return null

    // Sorted before truncating so the identity does not depend on the order the
    // node walk happened to visit labels in.
    val joined = distinct.take(MAX_LABELS).joinToString("\u0001")
    val digest = MessageDigest.getInstance("SHA-256").digest(joined.toByteArray())
    return digest.joinToString("") { "%02x".format(it) }.take(HASH_HEX_LENGTH)
  }

  /**
   * Lowercase word tokens with digits removed entirely.
   *
   * Combining marks count as part of a word. Bangla, Hindi and most Indic scripts
   * write vowels as marks attached to a consonant (the া in লাইক); treating those as
   * separators would shred every Bangla caption into fragments.
   *
   * Digits go because like counts, view counts and timestamps all change while the
   * same reel is on screen. Single characters go because once digits are stripped
   * they are almost always suffix debris ("12.4K" leaves "k"). `@`, `_` and `.` stay
   * inside a token so a handle like `@some.user` survives intact.
   */
  fun tokens(raw: String): List<String> {
    val out = ArrayList<String>()
    val current = StringBuilder()

    fun flush() {
      val token = current.toString().trim('.', '_')
      if (token.length >= 2) out.add(token)
      current.setLength(0)
    }

    for (ch in raw.lowercase()) {
      when {
        ch.isDigit() -> Unit
        ch.isLetter() || ch.isCombiningMark() || ch == '@' || ch == '_' || ch == '.' ->
          current.append(ch)
        else -> flush()
      }
    }
    flush()
    return out
  }

  private fun Char.isCombiningMark(): Boolean =
    category == CharCategory.NON_SPACING_MARK || category == CharCategory.COMBINING_SPACING_MARK
}
