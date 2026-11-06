package com.scrollwise.core

import com.scrollwise.core.detect.TargetApp
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Process-local fan-out from the accessibility service to the JS module.
 *
 * The service and the React Native context live in the same process, so this is just
 * a listener list — no broadcast, no serialisation, no IPC.
 *
 * It exists only to make the dashboard tick live while the app is open. Nothing
 * depends on it: the service writes to the database regardless of whether anybody is
 * listening, which is the normal case since the user is usually in Instagram with
 * this app closed.
 */
object CounterBus {

  fun interface Listener {
    fun onReelCounted(appId: String, total: Int, dwellMs: Int, isAd: Boolean)
  }

  fun interface LimitListener {
    fun onLimitReached(appId: String, total: Int, limit: Int)
  }

  private val listeners = CopyOnWriteArrayList<Listener>()
  private val limitListeners = CopyOnWriteArrayList<LimitListener>()

  fun addListener(listener: Listener) = listeners.add(listener)

  fun removeListener(listener: Listener) = listeners.remove(listener)

  fun addLimitListener(listener: LimitListener) = limitListeners.add(listener)

  fun removeLimitListener(listener: LimitListener) = limitListeners.remove(listener)

  /** True when something is actually listening, so the service can skip the work. */
  val hasListeners: Boolean get() = listeners.isNotEmpty()

  fun publishReel(app: TargetApp, total: Int, dwellMs: Int, isAd: Boolean) {
    for (listener in listeners) {
      // One bad listener must not take down the counting path.
      runCatching { listener.onReelCounted(app.id, total, dwellMs, isAd) }
    }
  }

  fun publishLimit(app: TargetApp, total: Int, limit: Int) {
    for (listener in limitListeners) {
      runCatching { listener.onLimitReached(app.id, total, limit) }
    }
  }
}
