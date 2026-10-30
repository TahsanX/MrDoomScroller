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
import kotlin.math.hypot
import kotlin.math.roundToInt

/**
 * The small draggable counter drawn over the social app.
 *
 * ## Dismissing it
 *
 * Dragging the pill shows a ✕ target at the bottom of the screen, the same gesture
 * chat heads use. Dropping it there hides the counter for the rest of this sitting;
 * it comes back the next time the user enters a feed. Turning it off for good is a
 * setting, not a gesture, so an accidental drop never silently loses it forever.
 *
 * Every WindowManager call has to happen on the main thread, but reel commits arrive
 * on background threads, so each public method marshals itself.
 */
class OverlayController(
  private val context: Context,
  private val onPositionChanged: (x: Int, y: Int) -> Unit = { _, _ -> }
) {

  private val main = Handler(Looper.getMainLooper())
  private val windowManager =
    context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val density = context.resources.displayMetrics.density

  private var view: View? = null
  private var label: TextView? = null
  private var target: View? = null
  private var position: Pair<Int, Int> = DEFAULT_POSITION
  private var enabled: Boolean = true

  /** Set by dropping on the ✕; cleared when the sitting ends. */
  private var dismissedForSitting: Boolean = false

  /** Seeded from settings so the first show lands where the user last left it. */
  fun configure(enabled: Boolean, x: Int, y: Int) = onMain {
    this.enabled = enabled
    this.position = x to y
    if (!enabled) removeViews()
  }

  fun show(count: Int) = onMain {
    if (!enabled || dismissedForSitting) return@onMain
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

  /** The user left the feed: hide, and let the next sitting show it again. */
  fun onSurfaceExited() = onMain {
    dismissedForSitting = false
    removeViews()
  }

  fun destroy() = onMain { removeViews() }

  private fun attach() {
    val inflated = LayoutInflater.from(context).inflate(R.layout.ds_overlay_counter, null)
    val lp = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      // NOT_FOCUSABLE keeps the social app's keyboard and gestures working. Without
      // it the overlay takes focus and the app underneath becomes unusable.
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

  private fun removeViews() {
    hideTarget()
    val current = view ?: return
    runCatching { windowManager.removeView(current) }
      .onFailure { Log.w(TAG, "Could not remove overlay", it) }
    view = null
    label = null
  }

  private fun render(count: Int) {
    label?.text = count.toString()
  }

  // ---- Dismiss target --------------------------------------------------------

  private fun showTarget() {
    if (target != null) return
    val inflated = LayoutInflater.from(context).inflate(R.layout.ds_overlay_dismiss_target, null)
    val lp = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      // Purely a visual: it must never take the touch the pill is in the middle of.
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      y = (TARGET_BOTTOM_MARGIN_DP * density).roundToInt()
    }
    if (runCatching { windowManager.addView(inflated, lp) }.isSuccess) target = inflated
  }

  private fun hideTarget() {
    val current = target ?: return
    runCatching { windowManager.removeView(current) }
    target = null
  }

  /** Whether the finger is over the ✕, with some slack so it is easy to hit. */
  private fun isOverTarget(rawX: Float, rawY: Float): Boolean {
    val t = target ?: return false
    if (t.width == 0) return false
    val location = IntArray(2)
    t.getLocationOnScreen(location)
    val cx = location[0] + t.width / 2f
    val cy = location[1] + t.height / 2f
    return hypot(rawX - cx, rawY - cy) <= t.width * TARGET_HIT_SCALE
  }

  private fun setTargetActive(active: Boolean) {
    val t = target ?: return
    val scale = if (active) 1.25f else 1f
    if (t.scaleX != scale) t.animate().scaleX(scale).scaleY(scale).setDuration(120).start()
  }

  private fun onMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
  }

  /**
   * Drag handling. The slop check keeps a tap from registering as a one-pixel drag
   * and rewriting the saved position on every touch.
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
      when (event.actionMasked) {
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
          if (!dragging) {
            dragging = true
            showTarget()
          }
          lp.x = startX + dx.roundToInt()
          lp.y = startY + dy.roundToInt()
          runCatching { windowManager.updateViewLayout(v, lp) }
          setTargetActive(isOverTarget(event.rawX, event.rawY))
          return true
        }

        MotionEvent.ACTION_UP -> {
          if (!dragging) return true
          if (isOverTarget(event.rawX, event.rawY)) {
            dismissedForSitting = true
            // Put it back where it was, so next sitting it does not reappear on the ✕.
            lp.x = startX
            lp.y = startY
            removeViews()
          } else {
            hideTarget()
            position = lp.x to lp.y
            onPositionChanged(lp.x, lp.y)
          }
          return true
        }

        MotionEvent.ACTION_CANCEL -> {
          hideTarget()
          return true
        }
      }
      return false
    }
  }

  companion object {
    private const val TAG = "DoomScroll/Overlay"
    private const val SLOP_PX = 12f
    private const val TARGET_BOTTOM_MARGIN_DP = 72f
    /** Hit radius as a multiple of the target's width. */
    private const val TARGET_HIT_SCALE = 0.9f
    private val DEFAULT_POSITION = 24 to 240
  }
}
