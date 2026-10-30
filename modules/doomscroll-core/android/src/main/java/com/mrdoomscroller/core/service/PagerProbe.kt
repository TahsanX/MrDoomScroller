package com.mrdoomscroller.core.service

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import com.mrdoomscroller.core.detect.AdDetector
import com.mrdoomscroller.core.detect.DetectionProfile
import com.mrdoomscroller.core.detect.Fingerprint
import kotlin.math.roundToInt

/**
 * Looks at the live node tree once and answers: is the short-form feed on screen,
 * and which reel is showing on it?
 *
 * In order:
 *
 * 1. **Paused?** A comment sheet or snackbar over the reel ([DetectionProfile.pauseIds])
 *    means the user is doing something else on the same reel. Report that and stop.
 * 2. **On the feed?** A visible node with one of the app's surface ids settles it.
 *    Failing that, two app-agnostic tests:
 *    - the innermost full-screen scrollable is a vertical pager whose visible pages
 *      are each the height of the pager — the home feed's posts, a profile grid's
 *      rows and a comment list all fail that shape;
 *    - or a column of at least three action buttons (like, comment, share…) stacked
 *      at the edge of the screen. Every short-form player has one; a feed post's
 *      buttons sit in a horizontal row instead.
 *    There is no separate "profile detector": a profile shows none of these.
 * 3. **Which reel?** Labels from the app's identity nodes (author, caption) when it
 *    has them; otherwise everything on the visible page. Hashed by [Fingerprint].
 * 4. **An ad?** Sponsored markers anywhere on the visible page. See [AdDetector].
 *
 * Bounded in nodes and depth, because this runs while the user is scrolling.
 */
object PagerProbe {

  private const val MAX_NODES = 450
  private const val MAX_DEPTH = 30
  private const val MAX_CHILDREN_EXAMINED = 8
  private const val MAX_LABEL_NODES = 160
  private const val MAX_LABEL_DEPTH = 16

  /**
   * A visible child with less than this share of the pager's height on screen is
   * ignored when checking shape: it is a sliver at the edge of a swipe.
   */
  private const val SLIVER_RATIO = 0.10f

  data class Result(
    val paused: Boolean,
    val onShortForm: Boolean,
    val fingerprint: String?,
    val isAd: Boolean,
    /** For debug logging only: never contains user content. */
    val reason: String
  )

  fun probe(
    root: AccessibilityNodeInfo?,
    packages: Collection<String>,
    profile: DetectionProfile,
    screenWidth: Int,
    screenHeight: Int
  ): Result {
    if (root == null) return Result(false, false, null, false, "no-root")

    val held = ArrayList<AccessibilityNodeInfo>()
    val screen = Rect(0, 0, screenWidth, screenHeight)
    try {
      if (mostVisibleById(root, profile.qualified(packages, profile.pauseIds), screen, held) != null) {
        return Result(true, false, null, false, "paused")
      }

      // Surface by id first; the geometric test is the fallback for an app that
      // renamed its views.
      val surfaceNode = mostVisibleById(root, profile.qualified(packages, profile.surfaceIds), screen, held)
      var page: AccessibilityNodeInfo? = null
      var pageArea: Rect = screen
      val how: String

      if (surfaceNode != null) {
        how = "id"
        // Narrow the identity search to the page actually on screen, if the surface
        // is a pager that exposes its pages.
        val bounds = Rect().also(surfaceNode::getBoundsInScreen)
        val shape = pageShape(surfaceNode, bounds, profile, held)
        page = shape.visiblePage
        pageArea = page?.let { visibleRectOf(it, bounds) } ?: bounds
      } else {
        val pager = innermostFullScreenScrollable(root, profile, screenWidth, screenHeight, held)
        val excluded = pager != null && profile.isExcluded(pager.viewIdResourceName)
        val bounds = Rect()
        pager?.getBoundsInScreen(bounds)
        val shape = if (pager != null && !excluded) pageShape(pager, bounds, profile, held) else null

        if (shape != null && shape.isPager) {
          how = "shape:${shape.reason}"
          page = shape.visiblePage
          pageArea = page?.let { visibleRectOf(it, bounds) } ?: bounds
        } else if (!excluded && hasEdgeActionColumn(root, screenWidth, screenHeight, held)) {
          how = "action-column"
        } else {
          val why = when {
            excluded -> "excluded-id"
            pager == null -> "no-fullscreen-scrollable"
            else -> "shape:${shape?.reason}"
          }
          return Result(false, false, null, false, why)
        }
      }

      // Everything on the visible page: the ad check needs it whatever happens, and it
      // is the identity fallback.
      val pageLabels = ArrayList<String>()
      collectLabels(page ?: surfaceNode ?: root, pageArea, pageLabels, held)

      // Identity from the app's own author/caption nodes when it has them, limited to
      // the page on screen: these apps keep the neighbouring reels laid out off screen
      // with the same ids, and fingerprinting those would mix two reels together.
      val idLabels = ArrayList<String>()
      for (name in profile.identityIds) {
        val node = mostVisibleById(root, profile.qualified(packages, listOf(name)), pageArea, held)
          ?: continue
        collectLabels(node, pageArea, idLabels, held)
      }
      val labels = if (idLabels.isNotEmpty()) idLabels else pageLabels
      val fingerprint = Fingerprint.of(labels, profile.genericTokens)
      val isAd = AdDetector.isAd(pageLabels)

      val source = if (idLabels.isNotEmpty()) "idnodes" else "page"
      return Result(false, true, fingerprint, isAd, "$how labels=${labels.size}/$source ad=$isAd")
    } finally {
      // Every node obtained from the tree must be released on older releases or the
      // system's node pool leaks while the user scrolls. The root belongs to the caller.
      for (node in held) {
        @Suppress("DEPRECATION")
        runCatching { node.recycle() }
      }
    }
  }

  /**
   * The visible node, among those with any of [ids], that shows most of itself inside
   * [area]. Null when none is visible there.
   */
  private fun mostVisibleById(
    root: AccessibilityNodeInfo,
    ids: List<String>,
    area: Rect,
    held: MutableList<AccessibilityNodeInfo>
  ): AccessibilityNodeInfo? {
    var best: AccessibilityNodeInfo? = null
    var bestArea = 0
    val rect = Rect()
    for (id in ids) {
      val found = runCatching { root.findAccessibilityNodeInfosByViewId(id) }.getOrNull() ?: continue
      for (node in found) {
        held.add(node)
        if (!node.isVisibleToUser) continue
        node.getBoundsInScreen(rect)
        if (!rect.intersect(area)) continue
        val visible = rect.width() * rect.height()
        if (visible > bestArea) {
          bestArea = visible
          best = node
        }
      }
    }
    return best
  }

  /**
   * Depth-first, returning the deepest scrollable that fills the screen.
   *
   * Innermost wins because Instagram's tab host is itself a full-screen pager of
   * screen-sized pages; judging the outermost container would call every Instagram
   * screen a reel feed.
   */
  private fun innermostFullScreenScrollable(
    root: AccessibilityNodeInfo,
    profile: DetectionProfile,
    screenWidth: Int,
    screenHeight: Int,
    held: MutableList<AccessibilityNodeInfo>
  ): AccessibilityNodeInfo? {
    var best: AccessibilityNodeInfo? = null
    var bestDepth = -1
    var budget = MAX_NODES
    val rect = Rect()

    fun visit(node: AccessibilityNodeInfo, depth: Int) {
      if (budget-- <= 0 || depth > MAX_DEPTH) return
      if (!node.isVisibleToUser) return

      node.getBoundsInScreen(rect)
      val fullScreen = rect.height() >= screenHeight * profile.minPagerHeightRatio &&
        rect.width() >= screenWidth * profile.minPagerWidthRatio
      // Containers smaller than the screen cannot hold a full-screen pager.
      if (!fullScreen && depth > 0) return

      if (fullScreen && looksScrollable(node) && depth > bestDepth) {
        best = node
        bestDepth = depth
      }

      for (i in 0 until node.childCount) {
        if (budget <= 0) return
        val child = node.getChild(i) ?: continue
        held.add(child)
        visit(child, depth + 1)
      }
    }

    visit(root, 0)
    return best
  }

  /**
   * Action words, matched as whole tokens of a button's label. English plus the
   * languages a phone in this app's first market is likely set to.
   */
  private val ACTION_WORDS = setOf(
    "like", "liked", "unlike", "comment", "comments", "share", "send", "remix", "save",
    "dislike", "reply", "favorite", "favourite",
    "লাইক", "কমেন্ট", "মন্তব্য", "শেয়ার", "শেয়ার", "সেভ",
    "लाइक", "कमेंट", "टिप्पणी", "शेयर"
  )

  private const val EDGE_FRACTION = 0.25f
  private const val COLUMN_BUCKET_FRACTION = 0.06f
  private const val MIN_COLUMN_BUTTONS = 3

  /** The column must spread over at least this share of the screen height. */
  private const val MIN_COLUMN_SPREAD = 0.12f

  /**
   * At least [MIN_COLUMN_BUTTONS] action-labelled nodes stacked in one column within
   * the outer quarter of the screen, at different heights.
   *
   * The established counters use the same signature for apps with no stable ids: a
   * short-form player's like/comment/share stack sits at the screen's edge, while a
   * feed post lays the same buttons out in a horizontal row.
   */
  private fun hasEdgeActionColumn(
    root: AccessibilityNodeInfo,
    screenWidth: Int,
    screenHeight: Int,
    held: MutableList<AccessibilityNodeInfo>
  ): Boolean {
    val bucketWidth = (screenWidth * COLUMN_BUCKET_FRACTION).coerceAtLeast(1f)
    // Column bucket -> centre-y of each action node in it.
    val columns = HashMap<Int, MutableList<Int>>()
    var budget = MAX_NODES
    val rect = Rect()

    fun visit(node: AccessibilityNodeInfo, depth: Int) {
      if (budget-- <= 0 || depth > MAX_DEPTH) return
      if (!node.isVisibleToUser) return
      node.getBoundsInScreen(rect)

      val label = (node.contentDescription ?: node.text)?.toString()
      if (!label.isNullOrBlank() && Fingerprint.tokens(label).any { it in ACTION_WORDS }) {
        val cx = rect.exactCenterX()
        val onEdge = cx >= screenWidth * (1 - EDGE_FRACTION) || cx <= screenWidth * EDGE_FRACTION
        if (onEdge) {
          columns.getOrPut((cx / bucketWidth).roundToInt()) { ArrayList() }.add(rect.centerY())
        }
      }

      for (i in 0 until node.childCount) {
        if (budget <= 0) return
        val child = node.getChild(i) ?: continue
        held.add(child)
        visit(child, depth + 1)
      }
    }

    visit(root, 0)
    return columns.values.any { ys ->
      val distinct = ys.distinct()
      distinct.size >= MIN_COLUMN_BUTTONS &&
        (distinct.max() - distinct.min()) >= screenHeight * MIN_COLUMN_SPREAD
    }
  }

  private fun looksScrollable(node: AccessibilityNodeInfo): Boolean {
    if (node.isScrollable) return true
    val cls = node.className?.toString().orEmpty()
    return cls.contains("ViewPager") || cls.contains("RecyclerView")
  }

  private class Shape(
    val isPager: Boolean,
    val visiblePage: AccessibilityNodeInfo?,
    val reason: String
  )

  /**
   * Every child meaningfully on screen must be page-sized, and there must be at least
   * one. A feed with even one short post visible fails, which is what keeps the home
   * feed and profile grid out.
   */
  private fun pageShape(
    pager: AccessibilityNodeInfo,
    pagerBounds: Rect,
    profile: DetectionProfile,
    held: MutableList<AccessibilityNodeInfo>
  ): Shape {
    val pagerHeight = pagerBounds.height().coerceAtLeast(1)
    var visiblePage: AccessibilityNodeInfo? = null
    var bestVisible = 0
    var pages = 0
    var others = 0

    val childBounds = Rect()
    val clipped = Rect()
    for (i in 0 until minOf(pager.childCount, MAX_CHILDREN_EXAMINED)) {
      val child = pager.getChild(i) ?: continue
      held.add(child)
      child.getBoundsInScreen(childBounds)
      clipped.set(childBounds)
      if (!clipped.intersect(pagerBounds)) continue
      val visibleHeight = clipped.height()
      if (visibleHeight < pagerHeight * SLIVER_RATIO) continue

      // Judged on the child's full height, not the clipped part: mid-swipe, a reel is
      // still a page even though only half of it is on screen.
      if (childBounds.height() >= pagerHeight * profile.minPageHeightRatio) {
        pages++
        if (visibleHeight > bestVisible) {
          bestVisible = visibleHeight
          visiblePage = child
        }
      } else {
        others++
      }
    }

    val isPager = pages > 0 && others == 0
    return Shape(isPager, if (isPager) visiblePage else null, "p$pages/o$others")
  }

  private fun visibleRectOf(node: AccessibilityNodeInfo, clip: Rect): Rect {
    val rect = Rect()
    node.getBoundsInScreen(rect)
    if (!rect.intersect(clip)) rect.setEmpty()
    return rect
  }

  /**
   * Text and content descriptions from nodes inside [area]. These go straight into
   * [Fingerprint.of], which hashes them; they are never stored or logged.
   */
  private fun collectLabels(
    start: AccessibilityNodeInfo,
    area: Rect,
    out: MutableList<String>,
    held: MutableList<AccessibilityNodeInfo>
  ) {
    if (area.isEmpty) return
    var budget = MAX_LABEL_NODES
    val rect = Rect()

    fun visit(node: AccessibilityNodeInfo, depth: Int) {
      if (budget-- <= 0 || depth > MAX_LABEL_DEPTH) return
      node.getBoundsInScreen(rect)
      if (!Rect.intersects(rect, area)) return

      node.text?.toString()?.takeIf { it.isNotBlank() }?.let(out::add)
      node.contentDescription?.toString()?.takeIf { it.isNotBlank() }?.let(out::add)

      for (i in 0 until node.childCount) {
        if (budget <= 0) return
        val child = node.getChild(i) ?: continue
        held.add(child)
        visit(child, depth + 1)
      }
    }

    visit(start, 0)
  }
}
