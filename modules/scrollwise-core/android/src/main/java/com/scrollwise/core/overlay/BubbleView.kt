package com.scrollwise.core.overlay

import android.animation.ArgbEvaluator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.view.View
import android.view.animation.DecelerateInterpolator

/**
 * The floating counter: a round, glossy sticker with the count in the middle and a
 * ring that fills toward the daily cap.
 *
 * Drawn on a Canvas rather than inflated, so the colour can glide between levels and
 * the ring can animate without a layout pass. The view is slightly larger than the
 * disc itself to leave room for its soft shadow inside the overlay window.
 */
class BubbleView(context: Context) : View(context) {

  enum class Level(val color: Int) {
    /** No cap, or well under it. */
    CALM(Color.parseColor("#6C4CF5")),

    /** 70% of the cap or more. */
    WARM(Color.parseColor("#FF9F1C")),

    /** At or past the cap. */
    ALERT(Color.parseColor("#FF4D6D"))
  }

  private val density = resources.displayMetrics.density
  private fun dp(v: Float) = v * density

  /** Diameter of the disc. The view adds [shadowPad] on every side. */
  val discSize = dp(DISC_DP)
  private val shadowPad = dp(SHADOW_DP)
  val sizePx: Int = (discSize + shadowPad * 2).toInt()

  private var fillColor = Level.CALM.color
  private var colorAnimator: ValueAnimator? = null
  private var progress = -1f
  private var shownProgress = 0f
  private var progressAnimator: ValueAnimator? = null
  private var count = 0

  private val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.WHITE
  }
  private val rimPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
  private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val glossPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.WHITE
    alpha = 70
  }
  private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(3.5f)
    color = Color.WHITE
    alpha = 70
  }
  private val arcPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(3.5f)
    strokeCap = Paint.Cap.ROUND
    color = Color.WHITE
  }
  private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.WHITE
    textAlign = Paint.Align.CENTER
    typeface = Typeface.create("sans-serif", Typeface.BOLD)
  }
  private val arcRect = RectF()
  private val glossRect = RectF()

  init {
    // Paint.setShadowLayer on shapes needs a software layer.
    setLayerType(LAYER_TYPE_SOFTWARE, null)
    contentDescription = "Reel counter"
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(sizePx, sizePx)
  }

  fun setCount(value: Int) {
    if (value == count) return
    count = value
    contentDescription = "$value reels today"
    // A small pop each time a reel lands, so the number feels like it moved.
    animate().cancel()
    scaleX = 1.12f
    scaleY = 1.12f
    animate().scaleX(1f).scaleY(1f).setDuration(260)
      .setInterpolator(android.view.animation.OvershootInterpolator(3f)).start()
    invalidate()
  }

  /** [fraction] of the cap, or a negative number when there is no cap. */
  fun setProgress(fraction: Float) {
    progress = fraction
    val target = fraction.coerceIn(0f, 1f)
    progressAnimator?.cancel()
    progressAnimator = ValueAnimator.ofFloat(shownProgress, target).apply {
      duration = 420
      interpolator = DecelerateInterpolator()
      addUpdateListener {
        shownProgress = it.animatedValue as Float
        invalidate()
      }
      start()
    }
  }

  fun setLevel(level: Level) {
    if (level.color == fillColor && colorAnimator == null) return
    colorAnimator?.cancel()
    colorAnimator = ValueAnimator.ofObject(ArgbEvaluator(), fillColor, level.color).apply {
      duration = 360
      addUpdateListener {
        fillColor = it.animatedValue as Int
        invalidate()
      }
      start()
    }
  }

  override fun onDraw(canvas: Canvas) {
    val cx = width / 2f
    val cy = height / 2f
    val r = discSize / 2f

    // Shadow tinted with the fill, never flat grey, so it reads as a glow on dark
    // feeds and a soft drop on light ones.
    shadowPaint.setShadowLayer(dp(6f), 0f, dp(2.5f), withAlpha(fillColor, 110))
    canvas.drawCircle(cx, cy, r, shadowPaint)

    // White sticker rim, then the coloured disc.
    canvas.drawCircle(cx, cy, r, rimPaint)
    fillPaint.color = fillColor
    val inner = r - dp(3f)
    canvas.drawCircle(cx, cy, inner, fillPaint)

    // A cartoon gloss in the top-left.
    glossRect.set(cx - inner * 0.62f, cy - inner * 0.82f, cx + inner * 0.05f, cy - inner * 0.38f)
    canvas.save()
    canvas.rotate(-28f, glossRect.centerX(), glossRect.centerY())
    canvas.drawOval(glossRect, glossPaint)
    canvas.restore()

    // Progress ring toward the cap. With no cap only the faint track shows.
    val ringR = inner - dp(4.5f)
    arcRect.set(cx - ringR, cy - ringR, cx + ringR, cy + ringR)
    canvas.drawCircle(cx, cy, ringR, trackPaint)
    if (progress >= 0f && shownProgress > 0f) {
      canvas.drawArc(arcRect, -90f, 360f * shownProgress, false, arcPaint)
    }

    val label = if (count > 9999) "${count / 1000}k" else count.toString()
    textPaint.textSize = when {
      label.length <= 2 -> dp(19f)
      label.length == 3 -> dp(16f)
      else -> dp(13f)
    }
    val baseline = cy - (textPaint.descent() + textPaint.ascent()) / 2f
    canvas.drawText(label, cx, baseline, textPaint)
  }

  private fun withAlpha(color: Int, alpha: Int) =
    Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color))

  companion object {
    const val DISC_DP = 56f
    const val SHADOW_DP = 8f

    fun levelFor(count: Int, limit: Int): Level = when {
      limit <= 0 -> Level.CALM
      count >= limit -> Level.ALERT
      count >= limit * 0.7f -> Level.WARM
      else -> Level.CALM
    }
  }
}
