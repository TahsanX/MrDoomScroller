package com.scrollwise.core

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.text.TextUtils
import androidx.core.os.bundleOf
import com.scrollwise.core.db.AppSettings
import com.scrollwise.core.db.Repository
import com.scrollwise.core.detect.Profiles
import com.scrollwise.core.detect.TargetApp
import com.scrollwise.core.service.ScrollWatchService
import com.scrollwise.core.widget.CounterWidgetProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * The only bridge between the native layer and the JS UI.
 *
 * Reads and settings writes only: the counting path never comes through here. The
 * service has to work with the React Native context torn down, which is the normal
 * case — the user is in Instagram, not in this app — so JS can never be in the write
 * path.
 */
class ScrollWiseCoreModule : Module() {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val repository: Repository
    get() = Repository.get(context)

  override fun definition() = ModuleDefinition {
    Name("ScrollWiseCore")

    Events(ON_REEL_COUNTED, ON_LIMIT_REACHED)

    // ---- Permissions and service state -------------------------------------

    Function("isServiceEnabled") {
      isAccessibilityServiceEnabled(context)
    }

    Function("hasOverlayPermission") {
      Settings.canDrawOverlays(context)
    }

    /**
     * Android gives no way to request the accessibility permission in-app; it can
     * only be granted by the user in system settings. All we can do is take them
     * there, which is why onboarding has to explain it properly first.
     */
    Function("openAccessibilitySettings") {
      context.startActivity(
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }

    Function("openOverlaySettings") {
      context.startActivity(
        Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }

    // ---- Reads --------------------------------------------------------------

    AsyncFunction("getToday") { promise: Promise ->
      launch(promise) {
        val today = repository.today()
        val apps = repository.appCountsToday()
        val settings = repository.settings()
        mapOf(
          "date" to today.date,
          "total" to today.totalReels,
          "feedMs" to today.feedMs,
          "adReels" to today.adReels,
          "brainState" to brainStateFor(today.totalReels, settings),
          "apps" to apps.map { mapOf("appId" to it.appId, "count" to it.count) }
        )
      }
    }

    AsyncFunction("getRange") { from: String, to: String, promise: Promise ->
      launch(promise) {
        val days = repository.range(from, to)
        val apps = repository.appCountsInRange(from, to)
        mapOf(
          "days" to days.map {
            mapOf(
              "date" to it.date,
              "total" to it.totalReels,
              "feedMs" to it.feedMs,
              "adReels" to it.adReels
            )
          },
          "apps" to apps.map { mapOf("appId" to it.appId, "count" to it.count) }
        )
      }
    }

    AsyncFunction("getInsights") { days: Int, promise: Promise ->
      launch(promise) {
        mapOf(
          "hours" to repository.hourHistogram(days)
            .map { mapOf("hour" to it.hour, "count" to it.count) },
          "averageDwellMs" to repository.averageDwellMs(days)
        )
      }
    }

    /** Static metadata for the UI: labels, and which profiles are still unverified. */
    Function("getTargetApps") {
      val profiles = Profiles.load(context)
      TargetApp.entries.map { app ->
        mapOf(
          "appId" to app.id,
          "label" to app.label,
          "packages" to app.packages.toList(),
          "experimental" to (profiles[app.id]?.experimental ?: true)
        )
      }
    }

    // ---- Settings -----------------------------------------------------------

    AsyncFunction("getSettings") { promise: Promise ->
      launch(promise) { repository.settings().toJs() }
    }

    /**
     * Partial update: only the keys present are changed. Keeps the JS side from
     * having to read-modify-write and accidentally clobbering a field the service
     * changed in between.
     */
    AsyncFunction("setSettings") { patch: Map<String, Any>, promise: Promise ->
      launch(promise) {
        val current = repository.settings()
        val updated = current.copy(
          dailyLimit = patch.int("dailyLimit") ?: current.dailyLimit,
          sessionLimit = patch.int("sessionLimit") ?: current.sessionLimit,
          blockMode = patch.string("blockMode") ?: current.blockMode,
          overlayEnabled = patch.bool("overlayEnabled") ?: current.overlayEnabled,
          enabledApps = patch.stringList("enabledApps")?.joinToString(",")
            ?: current.enabledApps,
          debugLogging = patch.bool("debugLogging") ?: current.debugLogging,
          onboardingComplete = patch.bool("onboardingComplete") ?: current.onboardingComplete,
          healthyMax = patch.int("healthyMax") ?: current.healthyMax,
          fatiguedMax = patch.int("fatiguedMax") ?: current.fatiguedMax
        )
        repository.putSettings(updated)
        CounterWidgetProvider.refreshAll(context)
        updated.toJs()
      }
    }

    AsyncFunction("resetToday") { promise: Promise ->
      launch(promise) {
        repository.resetToday()
        CounterWidgetProvider.refreshAll(context)
        0
      }
    }

    /** Local-only export. The caller writes it wherever the user chooses. */
    AsyncFunction("exportAll") { promise: Promise ->
      launch(promise) {
        val bundle = repository.exportAll()
        mapOf(
          "exportedAt" to System.currentTimeMillis(),
          "settings" to bundle.settings.toJs(),
          "days" to bundle.days.map {
            mapOf(
              "date" to it.date,
              "total" to it.totalReels,
              "feedMs" to it.feedMs,
              "adReels" to it.adReels
            )
          },
          "appStats" to bundle.appStats.map {
            mapOf("date" to it.date, "appId" to it.appId, "count" to it.count)
          },
          "events" to bundle.events.map {
            mapOf(
              "timestamp" to it.timestamp,
              "appId" to it.appId,
              "dwellMs" to it.dwellMs,
              "isAd" to it.isAd
            )
          }
        )
      }
    }

    // Only attached while JS actually holds a subscription, so a backgrounded app
    // costs the counting path nothing.
    OnStartObserving {
      CounterBus.addListener(reelListener)
      CounterBus.addLimitListener(limitListener)
    }

    OnStopObserving {
      CounterBus.removeListener(reelListener)
      CounterBus.removeLimitListener(limitListener)
    }

    OnDestroy {
      CounterBus.removeListener(reelListener)
      CounterBus.removeLimitListener(limitListener)
      scope.cancel()
    }
  }

  private val reelListener = CounterBus.Listener { appId, total, dwellMs, isAd ->
    sendEvent(
      ON_REEL_COUNTED,
      bundleOf("appId" to appId, "total" to total, "dwellMs" to dwellMs, "isAd" to isAd)
    )
  }

  private val limitListener = CounterBus.LimitListener { appId, total, limit ->
    sendEvent(
      ON_LIMIT_REACHED,
      bundleOf("appId" to appId, "total" to total, "limit" to limit)
    )
  }

  private fun launch(promise: Promise, block: suspend () -> Any?) {
    scope.launch {
      runCatching { block() }
        .onSuccess { promise.resolve(it) }
        .onFailure { promise.reject("ERR_SCROLLWISE", it.message ?: "Unknown error", it) }
    }
  }

  private fun AppSettings.toJs(): Map<String, Any> = mapOf(
    "dailyLimit" to dailyLimit,
    "sessionLimit" to sessionLimit,
    "blockMode" to blockMode,
    "overlayEnabled" to overlayEnabled,
    "enabledApps" to enabledApps.split(',').map(String::trim).filter(String::isNotEmpty),
    "debugLogging" to debugLogging,
    "onboardingComplete" to onboardingComplete,
    "healthyMax" to healthyMax,
    "fatiguedMax" to fatiguedMax
  )

  private fun brainStateFor(total: Int, settings: AppSettings): String = when {
    total <= settings.healthyMax -> "healthy"
    total <= settings.fatiguedMax -> "fatigued"
    else -> "fried"
  }

  /**
   * Whether our service is in the system's enabled-accessibility-services list.
   *
   * `Settings.Secure` is the only reliable way to ask: a service that has been
   * granted but not yet started would otherwise look disabled, and the onboarding
   * screen polls this on resume to know whether the user actually granted it.
   */
  private fun isAccessibilityServiceEnabled(context: Context): Boolean {
    val expected = ComponentName(context, ScrollWatchService::class.java).flattenToString()
    val enabled = Settings.Secure.getString(
      context.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    ) ?: return false

    val splitter = TextUtils.SimpleStringSplitter(':')
    splitter.setString(enabled)
    for (entry in splitter) {
      if (entry.equals(expected, ignoreCase = true)) return true
      // Some OEM builds store the short form, so compare on the class too.
      if (entry.endsWith(ScrollWatchService::class.java.name, ignoreCase = true)) return true
    }
    return false
  }

  // A partial patch: an absent key means "leave it alone", so every accessor
  // returns null rather than a default and the caller falls back to the current
  // value. JS numbers arrive as Double, hence the Number widening.
  private fun Map<String, Any>.int(key: String): Int? = (this[key] as? Number)?.toInt()

  private fun Map<String, Any>.bool(key: String): Boolean? = this[key] as? Boolean

  private fun Map<String, Any>.string(key: String): String? = this[key] as? String

  private fun Map<String, Any>.stringList(key: String): List<String>? =
    (this[key] as? List<*>)?.mapNotNull { it as? String }

  companion object {
    const val ON_REEL_COUNTED = "onReelCounted"
    const val ON_LIMIT_REACHED = "onLimitReached"
  }
}
