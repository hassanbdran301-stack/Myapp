package com.hassan.teleprompter

import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.provider.Settings
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {

    private lateinit var editor: EditText
    private lateinit var counter: TextView
    private val handler = Handler(Looper.getMainLooper())
    private val saveRunnable = Runnable { saveScript() }
    private var waitingForPermission = false

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    private fun rounded(color: Int, radiusDp: Int): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = dp(radiusDp).toFloat()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = BG
        window.navigationBarColor = BG

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setBackgroundColor(BG)
            setPadding(dp(16), dp(20), dp(16), dp(16))
            fitsSystemWindows = true
        }

        val title = TextView(this).apply {
            text = "تيليبرومبر"
            textSize = 28f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.WHITE)
            gravity = Gravity.START
        }
        root.addView(title)

        val hint = TextView(this).apply {
            text = "الصق السكربت هنا. يُحفظ تلقائياً."
            textSize = 15f
            setTextColor(0xFF9AA7B4.toInt())
            setPadding(0, dp(4), 0, dp(12))
        }
        root.addView(hint)

        editor = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT or
                InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            isSingleLine = false
            setHorizontallyScrolling(false)
            gravity = Gravity.TOP or Gravity.START
            textDirection = View.TEXT_DIRECTION_ANY_RTL
            textAlignment = View.TEXT_ALIGNMENT_VIEW_START
            textSize = 19f
            setLineSpacing(0f, 1.25f)
            setTextColor(Color.WHITE)
            setHintTextColor(0xFF5C6773.toInt())
            setHint("اكتب أو الصق النص الذي ستقرؤه أمام الكاميرا…")
            background = rounded(0xFF1B232C.toInt(), 14)
            setPadding(dp(14), dp(14), dp(14), dp(14))
            setText(Prefs.of(this@MainActivity).getString(Prefs.SCRIPT, ""))
        }
        root.addView(editor, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

        counter = TextView(this).apply {
            textSize = 13f
            setTextColor(0xFF9AA7B4.toInt())
            setPadding(dp(4), dp(8), dp(4), dp(8))
        }
        root.addView(counter)
        updateCounter()

        val start = Button(this).apply {
            text = "ابدأ"
            textSize = 22f
            isAllCaps = false
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.WHITE)
            background = rounded(0xFF22A45D.toInt(), 16)
            setOnClickListener { onStartClicked() }
        }
        root.addView(start, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(62)))

        setContentView(root)

        editor.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun afterTextChanged(s: Editable?) {
                handler.removeCallbacks(saveRunnable)
                handler.postDelayed(saveRunnable, 400)
                updateCounter()
            }
        })
    }

    private fun updateCounter() {
        val words = editor.text.toString().split(Regex("\\s+")).count { it.isNotBlank() }
        counter.text = "عدد الكلمات: $words"
    }

    private fun saveScript() {
        Prefs.of(this).edit().putString(Prefs.SCRIPT, editor.text.toString()).apply()
    }

    override fun onPause() {
        super.onPause()
        handler.removeCallbacks(saveRunnable)
        saveScript()
    }

    override fun onResume() {
        super.onResume()
        if (waitingForPermission) {
            waitingForPermission = false
            if (Settings.canDrawOverlays(this)) {
                launchPrompter()
            } else {
                toast("لم يتم تفعيل الصلاحية، لا يمكن عرض النص فوق الكاميرا.")
            }
        }
    }

    private fun onStartClicked() {
        saveScript()
        if (editor.text.isBlank()) {
            toast("الصق السكربت أولاً")
            return
        }
        if (Settings.canDrawOverlays(this)) launchPrompter() else explainPermission()
    }

    private fun explainPermission() {
        AlertDialog.Builder(this)
            .setTitle("صلاحية مطلوبة")
            .setMessage(
                "حتى يظهر النص فوق الكاميرا، يحتاج التطبيق صلاحية " +
                    "«الظهور فوق التطبيقات الأخرى».\n\n" +
                    "في الشاشة التالية فعّل الخيار لتطبيق «تيليبرومبر»، " +
                    "ثم ارجع إلى التطبيق وسيبدأ تلقائياً.\n\n" +
                    "النص يظهر على الشاشة فقط ولا يُسجَّل في الفيديو."
            )
            .setPositiveButton("فتح الإعدادات") { _, _ ->
                waitingForPermission = true
                try {
                    startActivity(Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")))
                } catch (e: ActivityNotFoundException) {
                    startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION))
                }
            }
            .setNegativeButton("إلغاء", null)
            .show()
    }

    private fun launchPrompter() {
        val service = Intent(this, OverlayService::class.java)
            .putExtra(OverlayService.EXTRA_TEXT, editor.text.toString())
        startForegroundService(service)
        openCamera()
    }

    /** Opens Samsung's own camera in video mode, falling back to any camera app. */
    private fun openCamera() {
        val candidates = listOf(
            Intent(MediaStore.INTENT_ACTION_VIDEO_CAMERA).setPackage(SAMSUNG_CAMERA),
            packageManager.getLaunchIntentForPackage(SAMSUNG_CAMERA),
            Intent(MediaStore.INTENT_ACTION_VIDEO_CAMERA),
            Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)
        )
        for (intent in candidates) {
            if (intent == null) continue
            try {
                startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                return
            } catch (e: ActivityNotFoundException) {
            } catch (e: SecurityException) {
            }
        }
        toast("تعذّر فتح الكاميرا، افتحها يدوياً وسيبقى النص ظاهراً.")
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    companion object {
        private const val SAMSUNG_CAMERA = "com.sec.android.app.camera"
        private const val BG = 0xFF101418.toInt()
    }
}
