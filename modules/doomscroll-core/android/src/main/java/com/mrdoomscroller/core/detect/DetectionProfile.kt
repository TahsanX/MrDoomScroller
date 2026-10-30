package com.mrdoomscroller.core.detect

import org.json.JSONObject

/**
 * Per-app tuning for finding the short-form feed on screen and telling one reel from
 * the next.
 *
 * Two mechanisms, in order:
 *
 * 1. **View ids.** When an app exposes a stable id for its short-form player, a
 *    visible node with that id settles the question outright. This is how the
 *    established counters on the Play Store work, and it is the most precise signal
 *    available while the ids hold.
 * 2. **Geometry.** A full-screen vertical pager whose pages are each screen-sized.
 *    Slower and less precise, but it survives an app renaming its views, so it is the
 *    fallback rather than nothing.
 *
 * Ids are entry names (the part after `:id/`); the app's own package names are
 * prefixed at lookup time.
 *
 * These live in `assets/detection_profiles.json` so they can be re-tuned after an
 * app update without touching detector code.
 */
data class DetectionProfile(
  val appId: String,
  /** A visible node with any of these ids means the short-form feed is on screen. */
  val surfaceIds: List<String> = emptyList(),
  /**
   * A visible node with any of these ids means the user has paused on a reel to do
   * something else — the comment sheet, a share sheet, a snackbar. The probe is
   * skipped entirely: nothing about the current reel changes and nothing is counted.
   */
  val pauseIds: List<String> = emptyList(),
  /**
   * Nodes whose labels identify the reel (author, caption). Fingerprinting just these
   * keeps out the labels that change during playback; when none is found the whole
   * visible page is used instead.
   */
  val identityIds: List<String> = emptyList(),
  /**
   * Substrings of `viewIdResourceName` that rule a pager out even if it has the right
   * shape, e.g. a full-screen photo viewer.
   */
  val excludeIds: List<String> = emptyList(),
  /** The pager must cover at least this fraction of the screen height. */
  val minPagerHeightRatio: Float = 0.70f,
  /** ...and at least this fraction of the screen width. */
  val minPagerWidthRatio: Float = 0.90f,
  /**
   * A child counts as a page when it is at least this fraction of the pager's height.
   * Reels are ~100%; feed posts and grid rows are well under this.
   */
  val minPageHeightRatio: Float = 0.88f,
  /** Extra tokens to drop before fingerprinting, on top of [Fingerprint]'s list. */
  val genericTokens: Set<String> = emptySet(),
  /**
   * Not yet verified on a device. The UI says so, and the calibration screen is how
   * a user finds out how far off it is.
   */
  val experimental: Boolean = true
) {

  /** Fully-qualified ids for [names] in every package this app ships under. */
  fun qualified(packages: Collection<String>, names: List<String>): List<String> =
    packages.flatMap { pkg -> names.map { "$pkg:id/$it" } }

  fun isExcluded(viewId: String?): Boolean = matches(viewId, excludeIds)

  private fun matches(viewId: String?, needles: List<String>): Boolean {
    if (viewId.isNullOrEmpty() || needles.isEmpty()) return false
    val entry = viewId.substringAfter(":id/", viewId).lowercase()
    return needles.any { entry.contains(it.lowercase()) }
  }

  companion object {

    fun defaultFor(appId: String): DetectionProfile = DetectionProfile(appId = appId)

    fun fromJson(json: JSONObject): DetectionProfile {
      val appId = json.getString("appId")
      val fallback = defaultFor(appId)
      return DetectionProfile(
        appId = appId,
        surfaceIds = json.stringList("surfaceIds", fallback.surfaceIds),
        pauseIds = json.stringList("pauseIds", fallback.pauseIds),
        identityIds = json.stringList("identityIds", fallback.identityIds),
        excludeIds = json.stringList("excludeIds", fallback.excludeIds),
        minPagerHeightRatio = json.optDouble(
          "minPagerHeightRatio",
          fallback.minPagerHeightRatio.toDouble()
        ).toFloat(),
        minPagerWidthRatio = json.optDouble(
          "minPagerWidthRatio",
          fallback.minPagerWidthRatio.toDouble()
        ).toFloat(),
        minPageHeightRatio = json.optDouble(
          "minPageHeightRatio",
          fallback.minPageHeightRatio.toDouble()
        ).toFloat(),
        genericTokens = json.stringList("genericTokens", emptyList())
          .map { it.lowercase() }
          .toSet(),
        experimental = json.optBoolean("experimental", fallback.experimental)
      )
    }

    private fun JSONObject.stringList(key: String, fallback: List<String>): List<String> {
      val array = optJSONArray(key) ?: return fallback
      return (0 until array.length()).mapNotNull { array.optString(it).takeIf(String::isNotEmpty) }
    }
  }
}
