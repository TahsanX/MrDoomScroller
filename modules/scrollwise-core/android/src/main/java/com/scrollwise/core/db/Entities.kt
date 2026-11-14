package com.scrollwise.core.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Durable daily total. Never pruned: a user who has had the app for two years should
 * still be able to see their first week.
 */
@Entity(tableName = "daily_stats")
data class DailyStats(
  /** Local-timezone ISO date, `yyyy-MM-dd`. */
  @PrimaryKey val date: String,
  val totalReels: Int = 0,
  /** Milliseconds of attributed dwell time, summed over counted reels. */
  val feedMs: Long = 0,
  /** How many of [totalReels] were ads. Added in schema version 2. */
  @ColumnInfo(defaultValue = "0")
  val adReels: Int = 0
)

/**
 * Per-app daily total, normalised rather than held as fixed columns on [DailyStats]:
 * TikTok ships as two different package names in different regions and both have to
 * fold into one app, and adding a sixth target app should not need a migration.
 */
@Entity(tableName = "daily_app_stats", primaryKeys = ["date", "appId"])
data class DailyAppStats(
  val date: String,
  /** Our own stable id, not the package name. See `TargetApp`. */
  val appId: String,
  val count: Int = 0
)

/**
 * One row per counted reel. Pruned to 30 days by `MaintenanceWorker`; this is what the
 * hour-of-day heatmap, average dwell and session insights are computed from.
 */
@Entity(tableName = "reel_events")
data class ReelEvent(
  @PrimaryKey(autoGenerate = true) val id: Long = 0,
  val timestamp: Long,
  val appId: String,
  /** How long this reel was on screen before the user moved on. */
  val dwellMs: Int,
  /** Sponsored. Added in schema version 2. */
  @ColumnInfo(defaultValue = "0")
  val isAd: Boolean = false
)

enum class BlockMode {
  /** Post a notification at the cap and otherwise stay out of the way. */
  NOTIFY,

  /** Full-screen overlay with a dismiss button and a snooze. */
  NUDGE,

  /** Overlay plus GLOBAL_ACTION_HOME, re-fired on return. Opt-in. */
  HARD
}

/** Single-row settings table. */
@Entity(tableName = "app_settings")
data class AppSettings(
  @PrimaryKey val id: Int = SINGLETON_ID,
  /** 0 disables the cap entirely. */
  val dailyLimit: Int = 0,
  /** Reels per sitting, where a sitting ends after `SESSION_GAP_MS` of no scrolling. 0 disables. */
  val sessionLimit: Int = 0,
  val blockMode: String = "NUDGE",
  val overlayEnabled: Boolean = true,
  val overlayX: Int = 24,
  val overlayY: Int = 240,
  /** Comma-separated app ids the user has switched on. */
  val enabledApps: String = "instagram,youtube,tiktok,facebook,snapchat",
  /** Records raw accessibility event metadata for profile tuning. Off by default. */
  val debugLogging: Boolean = false,
  val onboardingComplete: Boolean = false,
  val healthyMax: Int = 20,
  val fatiguedMax: Int = 60,
  /**
   * Epoch millis until which nothing is counted, the bubble stays hidden and no
   * limit fires. 0 means not paused; [PAUSED_INDEFINITELY] means until the user
   * resumes by hand. Added in schema version 3.
   */
  @ColumnInfo(defaultValue = "0")
  val pausedUntil: Long = 0
) {
  fun isPaused(now: Long = System.currentTimeMillis()): Boolean = pausedUntil > now

  companion object {
    const val SINGLETON_ID = 1

    /** Far enough out to mean "until resumed", small enough to survive a JS number. */
    const val PAUSED_INDEFINITELY = 8_640_000_000_000_000L
  }
}

/**
 * [AppSettings.blockMode] is stored as a string so the table needs no type converter
 * and an unknown value from a future version degrades to the safe default instead of
 * throwing while the user is mid-scroll.
 *
 * Kept as an extension rather than a computed property on the entity so Room never
 * has to reason about a property with no backing field.
 */
val AppSettings.mode: BlockMode
  get() = runCatching { BlockMode.valueOf(blockMode) }.getOrDefault(BlockMode.NUDGE)
