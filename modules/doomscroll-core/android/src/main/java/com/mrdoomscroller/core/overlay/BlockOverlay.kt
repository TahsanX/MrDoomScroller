package com.mrdoomscroller.core.overlay

import android.content.Context
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import com.mrdoomscroller.core.R

/**
 * The full-screen "you have hit your limit" panel.
 *
 * Worth being precise about what this can and cannot do. It covers the app and takes
 * touches away from it, which is enough to break the scroll reflex, and that is the
 * actual goal. It is not a lock: the back gesture, the notification shade and the
 * recents switcher all still work, and the system removes overlays over permission
 * dialogs. The enforcement that actually moves the user out of the app is
 * `GLOBAL_ACTION_HOME`, fired by `LimitEnforcer` alongside this.
 */
class BlockOverlay(context: Context) {

  private val appContext = context.applicationContext
  private val main = Handler(Looper.getMainLooper())
  private val windowManager =
    appContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager

  private var view: View? = null

  fun show(
    count: Int,
    limit: Int,
    appLabel: String,
    allowDismiss: Boolean,
    onSnooze: (() -> Unit)?,
    onLeave: () -> Unit
  ) = onMain {
    if (!Settings.canDrawOverlays(appContext)) {
      Log.i(TAG, "No overlay permission; limit is enforced by going home only.")
      return@onMain
    }
    if (view != null) return@onMain

    val inflated = LayoutInflater.from(appContext).inflate(R.layout.ds_block_overlay, null)
    inflated.findViewById<TextView>(R.id.ds_block_count).text = count.toString()
    inflated.findViewById<TextView>(R.id.ds_block_message).text =
      "That is $count short videos today, past the $limit you set. You are in $appLabel."

    inflated.findViewById<Button>(R.id.ds_block_leave).setOnClickListener {
      hide()
      onLeave()
    }

    val snooze = inflated.findViewById<Button>(R.id.ds_block_snooze)
    if (onSnooze != null) {
      snooze.visibility = View.VISIBLE
      snooze.setOnClickListener {
        hide()
        onSnooze()
      }
    } else {
      snooze.visibility = View.GONE
    }

    val dismiss = inflated.findViewById<Button>(R.id.ds_block_dismiss)
    if (allowDismiss) {
      dismiss.visibility = View.VISIBLE
      dismiss.setOnClickListener { hide() }
    } else {
      dismiss.visibility = View.GONE
    }

    val lp = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      // Focusable, unlike the small counter: this one is meant to take the touches
      // that would otherwise keep scrolling the feed underneath.
      0,
      PixelFormat.OPAQUE
    )

    val added = runCatching { windowManager.addView(inflated, lp) }
    if (added.isFailure) {
      Log.w(TAG, "Could not show block overlay", added.exceptionOrNull())
      return@onMain
    }
    view = inflated
  }

  fun hide() = onMain {
    val current = view ?: return@onMain
    runCatching { windowManager.removeView(current) }
      .onFailure { Log.w(TAG, "Could not remove block overlay", it) }
    view = null
  }

  private fun onMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
  }

  companion object {
    private const val TAG = "DoomScroll/Block"
  }
}
