package com.hassan.teleprompter

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.Icon
import android.os.IBinder
import android.util.TypedValue
import android.view.Choreographer
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * Shows the script in a floating, draggable, semi-transparent window on top of
 * the camera app. It is a normal screen overlay, so the camera never records it.
 */
class OverlayService : Service() {

    private lateinit var wm: WindowManager
    private var root: LinearLayout? = null
    private lateinit var params: WindowManager.LayoutParams
    private lateinit var scroll: ScrollView
    private lateinit var text: TextView
    private lateinit var playBtn: TextView
    private lateinit var speedLabel: TextView
    private lateinit var fontLabel: TextView

    private var fontSp = Prefs.DEFAULT_FONT_SP
    private var speed = Prefs.DEFAULT_SPEED
    private var playing = false
    private var userTouching = false
    private var scrollPos = 0f
    private var lastFrameNs = 0L

    private val frame = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (!playing || root == null) {
                lastFrameNs = 0L
                return
            }
            // The user dragged the text by hand: continue from where they left it.
            if (Math.abs(scroll.scrollY - scrollPos.toInt()) > 2) scrollPos = scroll.scrollY.toFloat()

            if (lastFrameNs != 0L && !userTouching) {
                val dt = (frameTimeNanos - lastFrameNs) / 1_000_000_000f
                scrollPos += pixelsPerSecond() * dt
                val max = maxScroll()
                if (scrollPos >= max) {
                    scrollPos = max.toFloat()
                    scroll.scrollTo(0, max)
                    setPlaying(false)
                    return
                }
                scroll.scrollTo(0, scrollPos.toInt())
            }
            lastFrameNs = frameTimeNanos
            Choreographer.getInstance().postFrameCallback(this)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        val p = Prefs.of(this)
        fontSp = p.getInt(Prefs.FONT_SP, Prefs.DEFAULT_FONT_SP)
            .coerceIn(Prefs.MIN_FONT_SP, Prefs.MAX_FONT_SP)
        speed = p.getInt(Prefs.SPEED, Prefs.DEFAULT_SPEED)
            .coerceIn(Prefs.MIN_SPEED, Prefs.MAX_SPEED)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        startForeground(NOTIFICATION_ID, buildNotification())

        val script = intent?.getStringExtra(EXTRA_TEXT)
            ?: Prefs.of(this).getString(Prefs.SCRIPT, "") ?: ""
        if (root == null) createOverlay()
        text.text = script
        setPlaying(false)
        scrollPos = 0f
        scroll.post { scroll.scrollTo(0, 0) }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        playing = false
        Choreographer.getInstance().removeFrameCallback(frame)
        root?.let { runCatching { wm.removeView(it) } }
        root = null
        super.onDestroy()
    }

    // ---------------------------------------------------------------- UI

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    private fun pixelsPerSecond(): Float = speed * 6f * resources.displayMetrics.density

    private fun maxScroll(): Int = Math.max(0, text.height - scroll.height)

    @SuppressLint("ClickableViewAccessibility")
    private fun createOverlay() {
        val metrics = resources.displayMetrics
        val prefs = Prefs.of(this)

        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            background = GradientDrawable().apply {
                setColor(0xA6000000.toInt())          // ~65% black: readable over any scene
                cornerRadius = dp(18).toFloat()
            }
            clipToOutline = true
        }

        // ---- control bar (also the drag handle) ----
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(6), dp(4), dp(6), dp(2))
        }
        val handle = label("✥", 20f).apply { setPadding(dp(6), 0, dp(8), 0) }
        bar.addView(handle)

        bar.addView(button("A+") { changeFont(+2) })
        fontLabel = label("", 13f)
        bar.addView(fontLabel)
        bar.addView(button("A−") { changeFont(-2) })

        bar.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))

        bar.addView(button("⏫") { changeSpeed(+1) })
        speedLabel = label("", 13f)
        bar.addView(speedLabel)
        bar.addView(button("⏬") { changeSpeed(-1) })

        bar.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))

        playBtn = button("▶") { setPlaying(!playing) }
        bar.addView(playBtn)
        bar.addView(button("✕") { stopSelf() })
        panel.addView(bar)

        // ---- script ----
        text = TextView(this).apply {
            setTextColor(Color.WHITE)
            setShadowLayer(dp(2).toFloat(), 0f, dp(1).toFloat(), Color.BLACK)
            setTypeface(typeface, Typeface.BOLD)
            textDirection = View.TEXT_DIRECTION_ANY_RTL
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            gravity = Gravity.CENTER_HORIZONTAL
            setLineSpacing(0f, 1.3f)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, fontSp.toFloat())
        }
        scroll = ScrollView(this).apply {
            isVerticalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
            addView(text, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            setOnTouchListener { _, e ->
                when (e.actionMasked) {
                    MotionEvent.ACTION_DOWN -> userTouching = true
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        userTouching = false
                        lastFrameNs = 0L
                    }
                }
                false
            }
            // Leave room after the last line so it can scroll up to the top.
            addOnLayoutChangeListener { v, _, top, _, bottom, _, oldTop, _, oldBottom ->
                if (bottom - top != oldBottom - oldTop) {
                    text.setPadding(dp(14), dp(6), dp(14), (bottom - top) - dp(40))
                }
            }
        }
        panel.addView(scroll, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

        // ---- resize grip ----
        val grip = label("═══", 12f).apply {
            gravity = Gravity.CENTER
            setTextColor(0x99FFFFFF.toInt())
            setPadding(0, 0, 0, dp(2))
        }
        panel.addView(grip, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(20)))

        // ---- window ----
        val margin = dp(8)
        params = WindowManager.LayoutParams(
            metrics.widthPixels - 2 * margin,
            prefs.getInt(Prefs.WIN_H, (metrics.heightPixels * 0.32f).toInt()),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.LEFT
            x = prefs.getInt(Prefs.WIN_X, margin)
            y = prefs.getInt(Prefs.WIN_Y, dp(36))     // just under the front lens
        }
        clampWindow()

        val dragListener = DragListener { dx, dy ->
            params.x += dx
            params.y += dy
            clampWindow()
            wm.updateViewLayout(panel, params)
        }
        bar.setOnTouchListener(dragListener)
        handle.setOnTouchListener(dragListener)
        grip.setOnTouchListener(DragListener { _, dy ->
            params.height = (params.height + dy)
                .coerceIn(dp(120), resources.displayMetrics.heightPixels - params.y)
            wm.updateViewLayout(panel, params)
        })

        wm.addView(panel, params)
        root = panel
        refreshLabels()
    }

    private fun clampWindow() {
        val m = resources.displayMetrics
        params.x = params.x.coerceIn(-params.width / 2, m.widthPixels - params.width / 2)
        params.y = params.y.coerceIn(0, Math.max(0, m.heightPixels - dp(80)))
    }

    private fun savePosition() {
        Prefs.of(this).edit()
            .putInt(Prefs.WIN_X, params.x)
            .putInt(Prefs.WIN_Y, params.y)
            .putInt(Prefs.WIN_H, params.height)
            .apply()
    }

    /** Reports finger movement in raw pixels; saves the window when the finger lifts. */
    private inner class DragListener(val onMove: (Int, Int) -> Unit) : View.OnTouchListener {
        private var lastX = 0f
        private var lastY = 0f
        override fun onTouch(v: View, e: MotionEvent): Boolean {
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> { lastX = e.rawX; lastY = e.rawY }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (e.rawX - lastX).toInt()
                    val dy = (e.rawY - lastY).toInt()
                    if (dx != 0 || dy != 0) {
                        onMove(dx, dy)
                        lastX += dx
                        lastY += dy
                    }
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> savePosition()
            }
            return true
        }
    }

    private fun label(s: String, sizeSp: Float) = TextView(this).apply {
        text = s
        textSize = sizeSp
        setTextColor(Color.WHITE)
        gravity = Gravity.CENTER
        setPadding(dp(2), 0, dp(2), 0)
    }

    private fun button(s: String, onClick: () -> Unit) = TextView(this).apply {
        text = s
        textSize = 17f
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(Color.WHITE)
        gravity = Gravity.CENTER
        minWidth = dp(40)
        minHeight = dp(40)
        background = GradientDrawable().apply {
            setColor(0x33FFFFFF)
            cornerRadius = dp(12).toFloat()
        }
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, dp(40)).apply { setMargins(dp(2), 0, dp(2), 0) }
        isClickable = true
        setOnClickListener { onClick() }
    }

    // ---------------------------------------------------------------- actions

    private fun changeFont(delta: Int) {
        fontSp = (fontSp + delta).coerceIn(Prefs.MIN_FONT_SP, Prefs.MAX_FONT_SP)
        text.setTextSize(TypedValue.COMPLEX_UNIT_SP, fontSp.toFloat())
        Prefs.of(this).edit().putInt(Prefs.FONT_SP, fontSp).apply()
        refreshLabels()
    }

    private fun changeSpeed(delta: Int) {
        speed = (speed + delta).coerceIn(Prefs.MIN_SPEED, Prefs.MAX_SPEED)
        Prefs.of(this).edit().putInt(Prefs.SPEED, speed).apply()
        refreshLabels()
    }

    private fun setPlaying(on: Boolean) {
        if (on && scroll.scrollY >= maxScroll() && maxScroll() > 0) {
            scrollPos = 0f                       // finished: start again from the top
            scroll.scrollTo(0, 0)
        }
        playing = on
        playBtn.text = if (on) "⏸" else "▶"
        lastFrameNs = 0L
        Choreographer.getInstance().removeFrameCallback(frame)
        if (on) Choreographer.getInstance().postFrameCallback(frame)
    }

    private fun refreshLabels() {
        fontLabel.text = "$fontSp"
        speedLabel.text = "$speed"
    }

    // ---------------------------------------------------------------- notification

    private fun buildNotification(): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "نافذة النص العائمة", NotificationManager.IMPORTANCE_LOW))

        val stop = PendingIntent.getService(
            this, 1, Intent(this, OverlayService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE)
        val open = PendingIntent.getActivity(
            this, 2, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE)

        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_edit)
            .setContentTitle("تيليبرومبر يعمل")
            .setContentText("النص ظاهر فوق الكاميرا")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null as Icon?, "إغلاق", stop).build())
            .build()
    }

    companion object {
        const val EXTRA_TEXT = "text"
        const val ACTION_STOP = "com.hassan.teleprompter.STOP"
        private const val CHANNEL = "overlay"
        private const val NOTIFICATION_ID = 1
    }
}
