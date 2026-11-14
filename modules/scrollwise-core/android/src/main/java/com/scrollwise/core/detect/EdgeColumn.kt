package com.scrollwise.core.detect

import kotlin.math.abs

/**
 * One node of the screen, copied out of the accessibility tree so the decision below
 * is a pure function that unit tests can feed directly.
 */
data class NodeSnap(
  val text: String?,
  val desc: String?,
  val className: String?,
  val left: Int,
  val top: Int,
  val right: Int,
  val bottom: Int
) {
  val label: String? get() = text?.takeIf { it.isNotBlank() } ?: desc?.takeIf { it.isNotBlank() }
  val centerX: Int get() = (left + right) / 2
  val centerY: Int get() = (top + bottom) / 2
  val width: Int get() = right - left
  val height: Int get() = bottom - top
}

/**
 * Finds a short-form player by its like/comment/share stack at the edge of the
 * screen — the only signal apps without stable view ids (Facebook) give us.
 *
 * ## Two strictness levels
 *
 * **Loose** (the default, every app): three or more action-labelled nodes stacked in
 * one column in the outer quarter of the screen, spread over a meaningful height.
 *
 * **Strict** (Facebook). The loose rule miscounts the News Feed: every post has its
 * own "Like" button at the same x, so three short posts on screen stack three "Like"s
 * into a convincing column. A Reels player is told apart by everything at once:
 *
 * 1. the column's labels carry counts ("1.2K", "345") — feed buttons do not;
 * 2. they are at least two *different* actions (like + comment, comment + share…),
 *    not the same button repeated down the feed;
 * 3. the stack is tightly aligned (left edges within a few percent of the width);
 * 4. a full-width, tall media node sits behind it, described but without text —
 *    the video surface itself.
 *
 * Learned from studying how an established counter (BrainPal) decides the same
 * question; the implementation and thresholds here are our own.
 */
object EdgeColumn {

  data class Verdict(
    val found: Boolean,
    /** Author and caption, when strict mode could read them; else empty. */
    val identity: List<String>,
    /** Strict mode only: a text field (comment box) is open and no player was found. */
    val typing: Boolean,
    /** For debug logging only: never contains user content. */
    val reason: String
  )

  private enum class Kind { LIKE, COMMENT, SHARE, OTHER }

  private val WORDS: Map<String, Kind> = buildMap {
    listOf("like", "liked", "unlike", "likes", "reaction", "reactions", "react", "dislike",
      "favorite", "favourite", "লাইক", "रिएक्शन", "लाइक").forEach { put(it, Kind.LIKE) }
    listOf("comment", "comments", "reply", "কমেন্ট", "মন্তব্য", "कमेंट", "टिप्पणी")
      .forEach { put(it, Kind.COMMENT) }
    listOf("share", "shares", "send", "শেয়ার", "শেয়ার", "शेयर").forEach { put(it, Kind.SHARE) }
    listOf("remix", "save").forEach { put(it, Kind.OTHER) }
  }

  /** Words in a button label that make it chrome, never an author name. */
  private val NOT_AUTHOR = setOf(
    "back", "search", "mention", "share", "more", "sponsored", "follow", "following",
    "close", "menu", "reels", "home", "create", "like", "comment", "send"
  )

  private const val EDGE_FRACTION = 0.25f

  // Loose mode.
  private const val LOOSE_BUCKET_FRACTION = 0.06f
  private const val LOOSE_MIN_BUTTONS = 3
  private const val LOOSE_MIN_SPREAD = 0.12f

  // Strict mode.
  private const val STRICT_ALIGN_FRACTION = 0.045f
  private const val STRICT_MIN_LABELS = 2
  private const val STRICT_MIN_KINDS = 2
  private const val MEDIA_EDGE_FRACTION = 0.03f
  private const val MEDIA_MIN_HEIGHT = 0.33f
  private const val CAPTION_MIN_LENGTH = 20
  private const val CAPTION_KEEP = 40
  private const val CAPTION_LEFT_FRACTION = 0.06f

  fun evaluate(nodes: List<NodeSnap>, screenWidth: Int, screenHeight: Int, strict: Boolean): Verdict =
    if (strict) strict(nodes, screenWidth, screenHeight) else loose(nodes, screenWidth, screenHeight)

  private fun kindsOf(label: String): Set<Kind> =
    Fingerprint.tokens(label).mapNotNullTo(HashSet()) { WORDS[it] }

  private fun onEdge(cx: Int, width: Int) =
    cx >= width * (1 - EDGE_FRACTION) || cx <= width * EDGE_FRACTION

  private fun loose(nodes: List<NodeSnap>, width: Int, height: Int): Verdict {
    val bucket = (width * LOOSE_BUCKET_FRACTION).coerceAtLeast(1f)
    val columns = HashMap<Int, MutableSet<Int>>()
    for (n in nodes) {
      val label = n.label ?: continue
      if (kindsOf(label).isEmpty() || !onEdge(n.centerX, width)) continue
      columns.getOrPut(Math.round(n.centerX / bucket)) { HashSet() }.add(n.centerY)
    }
    val found = columns.values.any { ys ->
      ys.size >= LOOSE_MIN_BUTTONS && (ys.max() - ys.min()) >= height * LOOSE_MIN_SPREAD
    }
    return Verdict(found, emptyList(), false, if (found) "column" else "no-column")
  }

  private fun strict(nodes: List<NodeSnap>, width: Int, height: Int): Verdict {
    // 1. Counted action labels on the screen's edges.
    val candidates = nodes.filter { n ->
      val label = n.label ?: return@filter false
      n.left >= 0 && n.right <= width && n.right > 0 &&
        onEdge(n.centerX, width) &&
        label.any(Char::isDigit) &&
        kindsOf(label).isNotEmpty()
    }

    // 2. Group into columns by left edge, tightly.
    val tolerance = width * STRICT_ALIGN_FRACTION
    val columns = ArrayList<MutableList<NodeSnap>>()
    for (n in candidates.sortedBy { it.left }) {
      val column = columns.lastOrNull()
      if (column != null && abs(n.left - column.first().left) <= tolerance) column.add(n)
      else columns.add(mutableListOf(n))
    }

    // 3. The best column needs several distinct labels covering distinct actions.
    val best = columns.maxByOrNull { col -> col.mapTo(HashSet()) { it.label!!.trim().lowercase() }.size }
    val distinctLabels = best?.mapTo(HashSet()) { it.label!!.trim().lowercase() }?.size ?: 0
    val kinds = best?.flatMapTo(HashSet()) { kindsOf(it.label!!) }?.minus(Kind.OTHER)?.size ?: 0
    val typing = nodes.any { n ->
      val cls = n.className.orEmpty()
      cls.endsWith("EditText") || cls.endsWith("AutoCompleteTextView")
    }

    if (best == null || distinctLabels < STRICT_MIN_LABELS) {
      return Verdict(false, emptyList(), typing, "no-column labels=$distinctLabels")
    }
    if (kinds < STRICT_MIN_KINDS) {
      return Verdict(false, emptyList(), typing, "one-action kinds=$kinds")
    }

    // 4. The video surface behind the stack.
    val media = nodes.any { n ->
      n.text.isNullOrBlank() && !n.desc.isNullOrBlank() &&
        n.left <= width * MEDIA_EDGE_FRACTION && n.right >= width * (1 - MEDIA_EDGE_FRACTION) &&
        n.height >= height * MEDIA_MIN_HEIGHT
    }
    if (!media) return Verdict(false, emptyList(), typing, "no-media")

    return Verdict(true, identity(nodes, width, height), false, "strict-column")
  }

  /**
   * Who posted it and how the caption starts. Counts, timestamps and view numbers
   * change while a reel plays, so they are kept out of the fingerprint.
   */
  private fun identity(nodes: List<NodeSnap>, width: Int, height: Int): List<String> {
    val author = nodes.firstOrNull { n ->
      val t = n.text?.trim()
      n.className.orEmpty().endsWith("Button") &&
        !t.isNullOrEmpty() && t.length > 2 && t == n.desc?.trim() &&
        Fingerprint.tokens(t).none { it in NOT_AUTHOR } && t.none(Char::isDigit)
    }?.text?.trim()

    val caption = nodes
      .filter { n ->
        n.text.isNullOrBlank() && (n.desc?.trim()?.length ?: 0) > CAPTION_MIN_LENGTH &&
          n.left <= width * CAPTION_LEFT_FRACTION && n.height < height * MEDIA_MIN_HEIGHT
      }
      .maxByOrNull { it.desc!!.length }
      ?.desc?.trim()?.take(CAPTION_KEEP)

    return listOfNotNull(author, caption)
  }
}
