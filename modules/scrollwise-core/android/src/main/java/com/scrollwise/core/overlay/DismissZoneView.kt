package com.scrollwise.core.overlay

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import android.view.View
import android.view.animation.OvershootInterpolator

/**
 * The drop zone shown at the bottom of the screen while the bubble is dragged.
 *
 * A soft gradient rises from the bottom edge so the zone reads as a place, not a
 * floating button, and a round ✕ target sits in it. When the bubble comes close the
 * target swells, turns coral and the hint changes to say what letting go will do.
 * Touch-transparent: the overlay window it lives in is FLAG_NOT_TOUCHABLE.
 */
class DismissZoneView(context: Context) : View(context) {

  private val density = resources.displayMetrics.density
  private fun dp(v: Float) = v * density

  val heightPx: Int = dp(ZONE_DP).toInt()
  private val targetRadius = dp(30f)
  private val targetBottomGap = dp(56f)

  private var active = false
  private var activeAmount = 0f
  private var animator: ValueAnimator? = null

  private val scrimPaint = Paint()
  private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(2f)
    color = Color.WHITE
  }
  private val discPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val crossPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(3f)
    strokeCap = Paint.Cap.ROUND
  }
  private val hintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.WHITE
    textAlign = Paint.Align.CENTER
    textSize = dp(13f)
    typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
  }

  init {
    setLayerType(LAYER_TYPE_SOFTWARE, null)
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), heightPx)
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    scrimPaint.shader = LinearGradient(
      0f, 0f, 0f, h.toFloat(),
      intArrayOf(Color.TRANSPARENT, Color.parseColor("#55221A3A"), Color.parseColor("#B3221A3A")),
      floatArrayOf(0f, 0.45f, 1f),
      Shader.TileMode.CLAMP
    )
  }

  /** Target centre, relative to this view's top-left. */
  fun targetCenterX(): Float = width / 2f

  fun targetCenterY(): Float = height - targetBottomGap - targetRadius

  fun setActive(next: Boolean) {
    if (next == active) return
    active = next
    animator?.cancel()
    animator = ValueAnimator.ofFloat(activeAmount, if (next) 1f else 0f).apply {
      duration = 220
      interpolator = OvershootInterpolator(2.2f)
      addUpdateListener {
        activeAmount = it.animatedValue as Float
        invalidate()
      }
      start()
    }
  }

  override fun onDraw(canvas: Canvas) {
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), scrimPaint)

    val cx = targetCenterX()
    val cy = targetCenterY()
    val t = activeAmount
    val r = targetRadius * (1f + 0.28f * t)

    // White → coral as the bubble arrives.
    discPaint.color = blend(Color.argb(235, 255, 255, 255), CORAL, t.coerceIn(0f, 1f))
    discPaint.setShadowLayer(dp(10f) * (0.4f + t), 0f, dp(3f), Color.argb((90 + 80 * t).toInt().coerceIn(0, 255), 255, 77, 109))
    canvas.drawCircle(cx, cy, r, discPaint)
    ringPaint.alpha = (110 * (1f - t)).toInt().coerceIn(0, 255)
    canvas.drawCircle(cx, cy, r + dp(6f), ringPaint)

    crossPaint.color = blend(Color.parseColor("#221A3A"), Color.WHITE, t.coerceIn(0f, 1f))
    val arm = r * 0.32f
    canvas.drawLine(cx - arm, cy - arm, cx + arm, cy + arm, crossPaint)
    canvas.drawLine(cx + arm, cy - arm, cx - arm, cy + arm, crossPaint)

    val hint = if (active) "Let go to hide" else "Drag here to hide"
    canvas.drawText(hint, cx, cy - targetRadius * 1.28f - dp(14f), hintPaint)
  }

  private fun blend(from: Int, to: Int, t: Float): Int {
    val inv = 1f - t
    return Color.argb(
      (Color.alpha(from) * inv + Color.alpha(to) * t).toInt(),
      (Color.red(from) * inv + Color.red(to) * t).toInt(),
      (Color.green(from) * inv + Color.green(to) * t).toInt(),
      (Color.blue(from) * inv + Color.blue(to) * t).toInt()
    )
  }

  companion object {
    const val ZONE_DP = 220f
    private val CORAL = Color.parseColor("#FF4D6D")
  }
}
