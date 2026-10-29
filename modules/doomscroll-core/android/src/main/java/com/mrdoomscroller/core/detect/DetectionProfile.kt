package com.mrdoomscroller.core.detect

import org.json.JSONObject

/**
 * Per-app tuning for the detector.
 *
 * These live in `assets/detection_profiles.json` rather than in code so a profile can
 * be re-tuned after a social app ships a redesign without touching detector logic —
 * and so the values that are really guesses are visibly guesses.
 */
data class DetectionProfile(
  val appId: String,
  /**
   * Substrings matched against the window's class name to decide we are on a
   * short-form surface, e.g. `clips` for Instagram's Reels viewer.
   */
  val surfaceClassMarkers: List<String> = emptyList(),
  /** Substrings matched against `viewIdResourceName` for the same purpose. */
  val surfaceIdMarkers: List<String> = emptyList(),
  /** Substrings matched against the scrolling source's class name. */
  val pagerClassMarkers: List<String> = listOf("RecyclerView", "ViewPager"),
  /**
   * Content-description keywords for the vertical like/comment/share column. Lowercase
   * and locale-specific; English only until someone reports otherwise.
   */
  val actionKeywords: List<String> = listOf("like", "comment", "share"),
  /** The scrolling container must cover at least this fraction of the screen height. */
  val minHeightRatio: Float = 0.80f,
  /** Minimum gap between two accepted advances. Guards against event storms. */
  val minGapMs: Long = 350,
  /** Accumulated vertical delta, as a fraction of container height, that counts as one page. */
  val pageRatio: Float = 0.60f,
  /** Trust `fromIndex`/`toIndex` when the source reports them. */
  val trustIndex: Boolean = true,
  /** Trust API 28+ scroll deltas. */
  val trustDelta: Boolean = true,
  /** Require the action column before counting. Precise, but brittle across locales. */
  val requireActionColumn: Boolean = false,
  /**
   * Profiles we have not verified against a real device. The UI shows these as
   * experimental, and a wrong profile degrades to "not counted" rather than to
   * numbers the user cannot trust.
   */
  val experimental: Boolean = true
) {

  fun looksLikeSurface(className: String?, viewId: String?): Boolean {
    val cls = className?.lowercase().orEmpty()
    val id = viewId?.lowercase().orEmpty()
    return surfaceClassMarkers.any { cls.contains(it.lowercase()) } ||
      surfaceIdMarkers.any { id.contains(it.lowercase()) }
  }

  fun looksLikePager(className: String?): Boolean {
    val cls = className.orEmpty()
    return pagerClassMarkers.any { cls.contains(it, ignoreCase = true) }
  }

  companion object {

    fun defaultFor(appId: String): DetectionProfile = DetectionProfile(appId = appId)

    fun fromJson(json: JSONObject): DetectionProfile {
      val appId = json.getString("appId")
      val fallback = defaultFor(appId)
      return DetectionProfile(
        appId = appId,
        surfaceClassMarkers = json.stringList("surfaceClassMarkers", fallback.surfaceClassMarkers),
        surfaceIdMarkers = json.stringList("surfaceIdMarkers", fallback.surfaceIdMarkers),
        pagerClassMarkers = json.stringList("pagerClassMarkers", fallback.pagerClassMarkers),
        actionKeywords = json.stringList("actionKeywords", fallback.actionKeywords),
        minHeightRatio = json.optDouble("minHeightRatio", fallback.minHeightRatio.toDouble()).toFloat(),
        minGapMs = json.optLong("minGapMs", fallback.minGapMs),
        pageRatio = json.optDouble("pageRatio", fallback.pageRatio.toDouble()).toFloat(),
        trustIndex = json.optBoolean("trustIndex", fallback.trustIndex),
        trustDelta = json.optBoolean("trustDelta", fallback.trustDelta),
        requireActionColumn = json.optBoolean("requireActionColumn", fallback.requireActionColumn),
        experimental = json.optBoolean("experimental", fallback.experimental)
      )
    }

    private fun JSONObject.stringList(key: String, fallback: List<String>): List<String> {
      val array = optJSONArray(key) ?: return fallback
      return (0 until array.length()).mapNotNull { array.optString(it).takeIf(String::isNotEmpty) }
    }
  }
}
