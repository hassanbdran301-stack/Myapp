package com.hassan.teleprompter

import android.content.Context
import android.content.SharedPreferences

/** Everything the app remembers between launches. */
object Prefs {
    private const val NAME = "teleprompter"

    const val SCRIPT = "script"
    const val FONT_SP = "font_sp"
    const val SPEED = "speed"
    const val WIN_X = "win_x"
    const val WIN_Y = "win_y"
    const val WIN_H = "win_h"

    const val DEFAULT_FONT_SP = 28
    const val MIN_FONT_SP = 14
    const val MAX_FONT_SP = 72

    const val DEFAULT_SPEED = 5
    const val MIN_SPEED = 1
    const val MAX_SPEED = 40

    fun of(c: Context): SharedPreferences = c.getSharedPreferences(NAME, Context.MODE_PRIVATE)
}
