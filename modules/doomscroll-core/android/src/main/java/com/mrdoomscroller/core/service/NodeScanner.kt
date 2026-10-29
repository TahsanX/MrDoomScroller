package com.mrdoomscroller.core.service

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import com.mrdoomscroller.core.detect.DetectionProfile

/**
 * Reads the few structural facts the detector needs out of a live node tree.
 *
 * This runs inside the accessibility callback while the user is actively swiping, so
 * it is deliberately cheap: the walk is bounded in both depth and breadth, it stops
 * the moment it has an answer, and it never collects text. Walking an unbounded tree
 * here is the classic way these apps end up stuttering the app they are watching.
 *
 * Nothing read here is stored. Only the booleans and the bounds leave this file.
 */
object NodeScanner {

  /** Deep enough to reach an action column, shallow enough to stay cheap. */
  private const val MAX_DEPTH = 12

  /** A feed node has a handful of children, not hundreds. */
  private const val MAX_CHILDREN_PER_NODE = 24

  /** Hard ceiling on nodes touched per event, whatever the tree looks like. */
  private const val MAX_NODES = 220

  /**
   * True when the subtree contains the vertically stacked like/comment/share column
   * that every short-form player has and almost nothing else does.
   *
   * Matching is on content descriptions, which are the one thing these apps must
   * expose for their own accessibility compliance, so it survives redesigns better
   * than view ids. It is still locale-specific, which is why no profile relies on it
   * alone unless it has to.
   */
  fun hasActionColumn(root: AccessibilityNodeInfo?, profile: DetectionProfile): Boolean {
    if (root == null) return false
    val keywords = profile.actionKeywords.map { it.lowercase() }
    if (keywords.isEmpty()) return false

    val matched = HashSet<String>(keywords.size)
    var budget = MAX_NODES

    fun walk(node: AccessibilityNodeInfo, depth: Int) {
      if (depth > MAX_DEPTH || budget <= 0) return
      budget--

      val description = node.contentDescription?.toString()?.lowercase()
      if (!description.isNullOrEmpty()) {
        for (keyword in keywords) {
          // Substring rather than equality: real descriptions read like
          // "Like. 12.4K likes." rather than a bare verb.
          if (description.contains(keyword)) matched.add(keyword)
        }
        // Two independent action labels is enough. Demanding all of them would fail
        // on the players that drop "share" behind an overflow menu.
        if (matched.size >= REQUIRED_KEYWORD_MATCHES) return
      }

      val children = minOf(node.childCount, MAX_CHILDREN_PER_NODE)
      for (i in 0 until children) {
        if (matched.size >= REQUIRED_KEYWORD_MATCHES || budget <= 0) return
        val child = node.getChild(i) ?: continue
        try {
          walk(child, depth + 1)
        } finally {
          // Every node obtained from getChild must be recycled on older releases or
          // the system's node pool leaks while the user scrolls.
          @Suppress("DEPRECATION")
          child.recycle()
        }
      }
    }

    walk(root, 0)
    return matched.size >= REQUIRED_KEYWORD_MATCHES
  }

  /** On-screen bounds of [node], or an empty rect when it reports none. */
  fun boundsOf(node: AccessibilityNodeInfo?): Rect {
    val rect = Rect()
    node?.getBoundsInScreen(rect)
    return rect
  }

  const val REQUIRED_KEYWORD_MATCHES = 2
}
