package com.scrollwise.core.overlay

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.AnticipateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.ProgressBar
import android.widget.TextView
import com.scrollwise.core.R
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.roundToInt

/**
 * The floating bubble drawn over the social app.
 *
 * ## Gestures
 *
 * - **Drag** moves it. On release it springs to the nearest side edge, so it never
 *   rests over the middle of a reel, and the spot is remembered.
 * - While dragging, a drop zone rises from the bottom with a ✕ target. Near the
 *   target the bubble is pulled onto it (with a tick of haptics); letting go there
 *   shrinks it away for the rest of this sitting. It comes back the next time the
 *   user enters a feed — turning it off for good is a setting, not a gesture.
 * - **Tap** opens a small card: today's number, the cap, "Pause 30 min" and "Hide".
 *   It closes on a tap outside, or by itself after a few seconds.
 *
 * The bubble's colour follows the cap: violet when calm, amber from 70%, coral at
 * the cap.
 *
 * Every WindowManager call has to happen on the main thread, but reel commits arrive
 * on background threads, so each public method marshals itself.
 */
class OverlayController(
  private val context: Context,
  private val onPositionChanged: (x: Int, y: Int) -> Unit = { _, _ -> },
  private val onPauseRequested: (minutes: Int) -> Unit = {}
) {

  private val main = Handler(Looper.getMainLooper())
  private val windowManager =
    context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val density = context.resources.displayMetrics.density
  private fun dp(v: Float): Int = (v * density).roundToInt()

  private var bubble: BubbleView? = null
  private var bubbleLp: WindowManager.LayoutParams? = null
  private var zone: DismissZoneView? = null
  private var card: View? = null
  private var snapAnimator: ValueAnimator? = null

  private var position: Pair<Int, Int> = DEFAULT_POSITION
  private var enabled: Boolean = true
  private var pausedUntil: Long = 0
  private var dailyLimit: Int = 0
  private var count: Int = 0

  /** Set by dropping on the ✕ or tapping Hide; cleared when the sitting ends. */
  private var dismissedForSitting: Boolean = false

  private val collapseRunnable = Runnable { hideCard() }

  /** Seeded from settings so the first show lands where the user last left it. */
  fun configure(enabled: Boolean, pausedUntil: Long, x: Int, y: Int, dailyLimit: Int) = onMain {
    this.enabled = enabled
    this.pausedUntil = pausedUntil
    this.dailyLimit = dailyLimit
    // Do not yank a bubble the user is looking at back to its saved spot; the saved
    // spot is wherever they last put it anyway.
    if (bubble == null) this.position = x to y
    if (!enabled || isPaused()) removeViews() else bubble?.let { render(count) }
  }

  fun show(count: Int) = onMain {
    this.count = count
    if (!enabled || isPaused() || dismissedForSitting) return@onMain
    if (!Settings.canDrawOverlays(context)) {
      // Permission revoked while running. Stay quiet; the settings screen is where
      // the user gets told about this, not a toast over someone else's app.
      Log.i(TAG, "Overlay permission not granted; not showing.")
      return@onMain
    }
    if (bubble == null) attach()
    render(count)
  }

  fun update(count: Int) = onMain {
    this.count = count
    if (bubble != null) render(count)
  }

  /** The user left the feed: hide, and let the next sitting show it again. */
  fun onSurfaceExited() = onMain {
    dismissedForSitting = false
    removeViews()
  }

  fun destroy() = onMain { removeViews() }

  private fun isPaused() = pausedUntil > System.currentTimeMillis()

  // ---- Bubble ----------------------------------------------------------------

  private fun attach() {
    val view = BubbleView(context)
    val lp = WindowManager.LayoutParams(
      view.sizePx,
      view.sizePx,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      // NOT_FOCUSABLE keeps the social app's keyboard and gestures working; the
      // window is only as big as the bubble, so it never eats touches around it.
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      val clamped = clampToScreen(position.first, position.second, view.sizePx)
      x = clamped.first
      y = clamped.second
    }

    view.setOnTouchListener(DragListener(lp))

    // Pop in rather than appear.
    view.scaleX = 0.3f
    view.scaleY = 0.3f
    view.alpha = 0f

    val added = runCatching { windowManager.addView(view, lp) }
    if (added.isFailure) {
      Log.w(TAG, "Could not add overlay", added.exceptionOrNull())
      return
    }
    view.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(320)
      .setInterpolator(OvershootInterpolator(2.4f)).start()

    bubble = view
    bubbleLp = lp
  }

  private fun removeViews() {
    snapAnimator?.cancel()
    snapAnimator = null
    hideZone()
    hideCard()
    val current = bubble ?: return
    current.animate().cancel()
    runCatching { windowManager.removeView(current) }
      .onFailure { Log.w(TAG, "Could not remove overlay", it) }
    bubble = null
    bubbleLp = null
  }

  private fun render(count: Int) {
    val view = bubble ?: return
    view.setCount(count)
    view.setLevel(BubbleView.levelFor(count, dailyLimit))
    view.setProgress(if (dailyLimit > 0) count.toFloat() / dailyLimit else -1f)
    card?.let { fillCard(it) }
  }

  /** Slides the bubble to the nearest side, with a little overshoot. */
  private fun snapToEdge(view: View, lp: WindowManager.LayoutParams, onEnd: () -> Unit) {
    val screenW = context.resources.displayMetrics.widthPixels
    val size = lp.width
    val toLeft = lp.x + size / 2 < screenW / 2
    val margin = dp(EDGE_MARGIN_DP)
    val targetX = if (toLeft) margin else screenW - size - margin
    val (_, targetY) = clampToScreen(targetX, lp.y, size)
    val startX = lp.x
    val startY = lp.y

    snapAnimator?.cancel()
    snapAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = 380
      interpolator = OvershootInterpolator(1.1f)
      addUpdateListener {
        val f = it.animatedValue as Float
        lp.x = (startX + (targetX - startX) * f).roundToInt()
        lp.y = (startY + (targetY - startY) * f.coerceAtMost(1f)).roundToInt()
        if (view.isAttachedToWindow) runCatching { windowManager.updateViewLayout(view, lp) }
      }
      addListener(object : AnimatorListenerAdapter() {
        override fun onAnimationEnd(animation: Animator) {
          if (snapAnimator === animation) snapAnimator = null
          onEnd()
        }
      })
      start()
    }
  }

  /** Keeps the bubble off the status bar and navigation bar. */
  private fun clampToScreen(x: Int, y: Int, size: Int): Pair<Int, Int> {
    val metrics = context.resources.displayMetrics
    val top = systemDimen("status_bar_height") + dp(8f)
    val bottom = metrics.heightPixels - systemDimen("navigation_bar_height") - size - dp(8f)
    val cx = x.coerceIn(0, (metrics.widthPixels - size).coerceAtLeast(0))
    val cy = if (bottom > top) y.coerceIn(top, bottom) else top
    return cx to cy
  }

  private fun systemDimen(name: String): Int {
    val id = context.resources.getIdentifier(name, "dimen", "android")
    return if (id > 0) context.resources.getDimensionPixelSize(id) else 0
  }

  // ---- Drop zone -------------------------------------------------------------

  private fun showZone() {
    if (zone != null) return
    val view = DismissZoneView(context)
    val lp = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      view.heightPx,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      // Purely a visual: it must never take the touch the bubble is in the middle of.
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.BOTTOM or Gravity.START
    }
    view.alpha = 0f
    view.translationY = dp(48f).toFloat()
    if (runCatching { windowManager.addView(view, lp) }.isSuccess) {
      zone = view
      view.animate().alpha(1f).translationY(0f).setDuration(200).start()
    }
  }

  private fun hideZone() {
    val current = zone ?: return
    zone = null
    current.animate().cancel()
    current.animate().alpha(0f).translationY(dp(48f).toFloat()).setDuration(160)
      .withEndAction { runCatching { windowManager.removeView(current) } }
      .start()
  }

  /** Target centre in screen coordinates, or null while the zone is not laid out. */
  private fun targetOnScreen(): Pair<Float, Float>? {
    val z = zone ?: return null
    if (z.width == 0) return null
    val location = IntArray(2)
    z.getLocationOnScreen(location)
    return (location[0] + z.targetCenterX()) to (location[1] + z.targetCenterY())
  }

  // ---- Card ------------------------------------------------------------------

  private fun toggleCard() {
    if (card != null) hideCard() else showCard()
  }

  private fun showCard() {
    val lpBubble = bubbleLp ?: return
    val view = LayoutInflater.from(context).inflate(R.layout.sw_overlay_card, null)
    fillCard(view)

    view.findViewById<View>(R.id.sw_card_pause).setOnClickListener {
      it.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
      hideCard()
      pausedUntil = System.currentTimeMillis() + PAUSE_MINUTES * 60_000L
      shrinkAway()
      onPauseRequested(PAUSE_MINUTES)
    }
    view.findViewById<View>(R.id.sw_card_hide).setOnClickListener {
      it.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
      hideCard()
      dismissedForSitting = true
      shrinkAway()
    }
    view.setOnTouchListener { _, event ->
      if (event.actionMasked == MotionEvent.ACTION_OUTSIDE) {
        hideCard()
        true
      } else false
    }

    view.measure(View.MeasureSpec.UNSPECIFIED, View.MeasureSpec.UNSPECIFIED)
    val screenW = context.resources.displayMetrics.widthPixels
    val bubbleOnLeft = lpBubble.x + lpBubble.width / 2 < screenW / 2
    val cardX = if (bubbleOnLeft) {
      lpBubble.x + lpBubble.width - dp(4f)
    } else {
      lpBubble.x - view.measuredWidth + dp(4f)
    }

    val lp = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = cardX.coerceIn(0, (screenW - view.measuredWidth).coerceAtLeast(0))
      y = lpBubble.y - dp(8f)
    }

    view.alpha = 0f
    view.scaleX = 0.9f
    view.scaleY = 0.9f
    view.pivotX = if (bubbleOnLeft) 0f else view.measuredWidth.toFloat()
    view.pivotY = dp(36f).toFloat()
    if (runCatching { windowManager.addView(view, lp) }.isSuccess) {
      card = view
      view.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(220)
        .setInterpolator(OvershootInterpolator(1.6f)).start()
      main.removeCallbacks(collapseRunnable)
      main.postDelayed(collapseRunnable, CARD_AUTO_CLOSE_MS)
    }
  }

  private fun fillCard(view: View) {
    view.findViewById<TextView>(R.id.sw_card_count).text =
      if (count == 1) "1 reel today" else "$count reels today"
    val sub = view.findViewById<TextView>(R.id.sw_card_sub)
    val bar = view.findViewById<ProgressBar>(R.id.sw_card_progress)
    if (dailyLimit > 0) {
      sub.text = if (count >= dailyLimit) {
        "Past your $dailyLimit — time for a break?"
      } else {
        "${dailyLimit - count} left of $dailyLimit"
      }
      bar.visibility = View.VISIBLE
      bar.progress = ((count.toFloat() / dailyLimit).coerceIn(0f, 1f) * 1000).roundToInt()
      bar.progressTintList =
        ColorStateList.valueOf(BubbleView.levelFor(count, dailyLimit).color)
    } else {
      sub.text = "No daily cap set"
      bar.visibility = View.GONE
    }
  }

  private fun hideCard() {
    main.removeCallbacks(collapseRunnable)
    val current = card ?: return
    card = null
    current.animate().cancel()
    current.animate().alpha(0f).scaleX(0.92f).scaleY(0.92f).setDuration(140)
      .withEndAction { runCatching { windowManager.removeView(current) } }
      .start()
  }

  /** Shrinks the bubble out, then removes everything. */
  private fun shrinkAway() {
    val view = bubble ?: return
    view.animate().cancel()
    view.animate().scaleX(0f).scaleY(0f).alpha(0f).setDuration(200)
      .setInterpolator(AnticipateInterpolator(1.5f))
      .withEndAction { removeViews() }
      .start()
  }

  private fun onMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
  }

  private fun confirmHaptic(view: View) {
    val constant = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      HapticFeedbackConstants.CONFIRM
    } else {
      HapticFeedbackConstants.LONG_PRESS
    }
    view.performHapticFeedback(constant)
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
    private var magnetised = false

    override fun onTouch(v: View, event: MotionEvent): Boolean {
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          snapAnimator?.cancel()
          startX = lp.x
          startY = lp.y
          touchX = event.rawX
          touchY = event.rawY
          dragging = false
          magnetised = false
          v.animate().scaleX(0.92f).scaleY(0.92f).setDuration(90).start()
          return true
        }

        MotionEvent.ACTION_MOVE -> {
          val dx = event.rawX - touchX
          val dy = event.rawY - touchY
          if (!dragging && abs(dx) < SLOP_PX && abs(dy) < SLOP_PX) return true
          if (!dragging) {
            dragging = true
            hideCard()
            showZone()
            v.animate().scaleX(1.06f).scaleY(1.06f).setDuration(120).start()
          }

          val target = targetOnScreen()
          val near = target != null &&
            hypot(event.rawX - target.first, event.rawY - target.second) <= dp(MAGNET_DP)

          if (near && target != null) {
            // Pull the bubble onto the target so it is obvious where it will go.
            lp.x = (target.first - lp.width / 2f).roundToInt()
            lp.y = (target.second - lp.height / 2f).roundToInt()
            if (!magnetised) {
              v.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
              v.animate().scaleX(0.82f).scaleY(0.82f).setDuration(140).start()
            }
          } else {
            lp.x = startX + dx.roundToInt()
            lp.y = startY + dy.roundToInt()
            if (magnetised) v.animate().scaleX(1.06f).scaleY(1.06f).setDuration(140).start()
          }
          magnetised = near
          zone?.setActive(near)
          runCatching { windowManager.updateViewLayout(v, lp) }
          return true
        }

        MotionEvent.ACTION_UP -> {
          if (!dragging) {
            v.animate().scaleX(1f).scaleY(1f).setDuration(160)
              .setInterpolator(OvershootInterpolator(3f)).start()
            v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
            toggleCard()
            return true
          }
          if (magnetised) {
            confirmHaptic(v)
            dismissedForSitting = true
            // Remember where it was, so next sitting it does not reappear on the ✕.
            position = startX to startY
            hideZone()
            shrinkAway()
          } else {
            hideZone()
            v.animate().scaleX(1f).scaleY(1f).setDuration(160).start()
            snapToEdge(v, lp) {
              position = lp.x to lp.y
              onPositionChanged(lp.x, lp.y)
            }
          }
          return true
        }

        MotionEvent.ACTION_CANCEL -> {
          hideZone()
          v.animate().scaleX(1f).scaleY(1f).setDuration(160).start()
          if (dragging) snapToEdge(v, lp) { position = lp.x to lp.y }
          return true
        }
      }
      return false
    }
  }

  companion object {
    private const val TAG = "ScrollWise/Overlay"
    private const val SLOP_PX = 12f
    private const val EDGE_MARGIN_DP = 6f

    /** How close the finger must be to the ✕ before the bubble is pulled onto it. */
    private const val MAGNET_DP = 84f
    private const val PAUSE_MINUTES = 30
    private const val CARD_AUTO_CLOSE_MS = 5000L
    private val DEFAULT_POSITION = 0 to 360
  }
}
