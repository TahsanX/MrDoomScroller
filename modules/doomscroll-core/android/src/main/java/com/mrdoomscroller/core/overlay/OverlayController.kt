package com.mrdoomscroller.core.overlay

import android.content.Context
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import com.mrdoomscroller.core.R
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * The small draggable counter drawn over the social app.
 *
 * Every WindowManager call has to happen on the main thread, but reel commits arrive
 * on a background dispatcher, so each public method marshals itself and callers do
 * not have to care which thread they are on.
 *
 * Persisting the dragged position is handed back to [onPositionChanged] rather than
 * written here, so this class owns no thread and no database handle.
 */
class OverlayController(
  private val context: Context,
  private val onPositionChanged: (x: Int, y: Int) -> Unit = { _, _ -> }
) {

  private val main = Handler(Looper.getMainLooper())
  private val windowManager =
    context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

  private var view: View? = null
  private var label: TextView? = null
  private var position: Pair<Int, Int> = DEFAULT_POSITION
  private var enabled: Boolean = true

  /** Seeded from settings so the first show lands where the user last left it. */
  fun configure(enabled: Boolean, x: Int, y: Int) = onMain {
    this.enabled = enabled
    this.position = x to y
    if (!enabled) removeView()
  }

  fun show(count: Int) = onMain {
    if (!enabled) return@onMain
    if (!Settings.canDrawOverlays(context)) {
      // Permission revoked while running. Stay quiet; the settings screen is where
      // the user gets told about this, not a toast over someone else's app.
      Log.i(TAG, "Overlay permission not granted; not showing.")
      return@onMain
    }
    if (view == null) attach()
    render(count)
  }

  fun update(count: Int) = onMain {
    if (view != null) render(count)
  }

  fun hide() = onMain { removeView() }

  fun destroy() = hide()

  private fun attach() {
    val inflated = LayoutInflater.from(context).inflate(R.layout.ds_overlay_counter, null)
    val lp = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      // NOT_FOCUSABLE keeps the social app's keyboard and gestures working. Without
      // it the overlay takes focus and the app underneath becomes unusable, which is
      // both a terrible experience and the fastest way to get uninstalled.
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = position.first
      y = position.second
    }

    inflated.setOnTouchListener(DragListener(lp))

    val added = runCatching { windowManager.addView(inflated, lp) }
    if (added.isFailure) {
      Log.w(TAG, "Could not add overlay", added.exceptionOrNull())
      return
    }

    view = inflated
    label = inflated.findViewById(R.id.ds_overlay_count)
  }

  private fun removeView() {
    val current = view ?: return
    runCatching { windowManager.removeView(current) }
      .onFailure { Log.w(TAG, "Could not remove overlay", it) }
    view = null
    label = null
  }

  private fun render(count: Int) {
    label?.text = count.toString()
  }

  private fun onMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
  }

  /**
   * Drag handling. The slop check is what keeps a tap from registering as a
   * one-pixel drag and rewriting the saved position on every touch.
   */
  private inner class DragListener(
    private val lp: WindowManager.LayoutParams
  ) : View.OnTouchListener {

    private var startX = 0
    private var startY = 0
    private var touchX = 0f
    private var touchY = 0f
    private var dragging = false

    override fun onTouch(v: View, event: MotionEvent): Boolean {
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          startX = lp.x
          startY = lp.y
          touchX = event.rawX
          touchY = event.rawY
          dragging = false
          return true
        }

        MotionEvent.ACTION_MOVE -> {
          val dx = event.rawX - touchX
          val dy = event.rawY - touchY
          if (!dragging && abs(dx) < SLOP_PX && abs(dy) < SLOP_PX) return true
          dragging = true
          lp.x = startX + dx.roundToInt()
          lp.y = startY + dy.roundToInt()
          runCatching { windowManager.updateViewLayout(v, lp) }
          return true
        }

        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          if (dragging) {
            position = lp.x to lp.y
            onPositionChanged(lp.x, lp.y)
          }
          return true
        }
      }
      return false
    }
  }

  companion object {
    private const val TAG = "DoomScroll/Overlay"
    private const val SLOP_PX = 12f
    private val DEFAULT_POSITION = 24 to 240
  }
}
