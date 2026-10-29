package com.mrdoomscroller.core.detect

import android.content.Context
import android.util.Log
import org.json.JSONArray

/**
 * Loads `assets/detection_profiles.json`, falling back to built-in defaults for any
 * app the file does not cover. A malformed file degrades to defaults rather than
 * crashing the accessibility service, which would leave the user with a silently dead
 * counter and no way to tell.
 */
object Profiles {

  private const val TAG = "DoomScroll/Profiles"
  private const val ASSET = "detection_profiles.json"

  @Volatile
  private var cached: Map<String, DetectionProfile>? = null

  fun load(context: Context): Map<String, DetectionProfile> {
    cached?.let { return it }
    return synchronized(this) {
      cached ?: read(context).also { cached = it }
    }
  }

  private fun read(context: Context): Map<String, DetectionProfile> {
    val defaults = TargetApp.entries.associate { it.id to DetectionProfile.defaultFor(it.id) }
    val raw = runCatching {
      context.assets.open(ASSET).bufferedReader().use { it.readText() }
    }.getOrElse {
      Log.w(TAG, "No $ASSET bundled; using defaults for every app.", it)
      return defaults
    }

    val parsed = runCatching {
      val array = JSONArray(raw)
      (0 until array.length()).mapNotNull { index ->
        array.optJSONObject(index)?.let { DetectionProfile.fromJson(it) }
      }.associateBy { it.appId }
    }.getOrElse {
      Log.e(TAG, "$ASSET is malformed; using defaults for every app.", it)
      return defaults
    }

    return defaults + parsed
  }
}
