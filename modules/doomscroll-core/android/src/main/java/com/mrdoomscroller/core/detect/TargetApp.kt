package com.mrdoomscroller.core.detect

/**
 * The apps we can count, keyed by our own stable id rather than by package name.
 *
 * TikTok is the reason this indirection exists: it ships as `com.zhiliaoapp.musically`
 * in most of the world and `com.ss.android.ugc.trill` in others, and both must fold
 * into one "tiktok" row so a user who switches builds does not get two sets of stats.
 */
enum class TargetApp(
  val id: String,
  val label: String,
  val packages: Set<String>
) {
  INSTAGRAM("instagram", "Instagram", setOf("com.instagram.android")),
  YOUTUBE("youtube", "YouTube", setOf("com.google.android.youtube")),
  TIKTOK(
    "tiktok",
    "TikTok",
    setOf("com.zhiliaoapp.musically", "com.ss.android.ugc.trill")
  ),
  FACEBOOK("facebook", "Facebook", setOf("com.facebook.katana")),
  SNAPCHAT("snapchat", "Snapchat", setOf("com.snapchat.android"));

  companion object {
    private val byPackage: Map<String, TargetApp> =
      entries.flatMap { app -> app.packages.map { it to app } }.toMap()

    private val byId: Map<String, TargetApp> = entries.associateBy { it.id }

    fun forPackage(packageName: String?): TargetApp? = packageName?.let { byPackage[it] }

    fun forId(id: String): TargetApp? = byId[id]

    /** Every package we are willing to look at. Matches the accessibility config. */
    val allPackages: Array<String> = entries.flatMap { it.packages }.toTypedArray()
  }
}
