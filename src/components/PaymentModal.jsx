import React, { useState } from 'react'
import { formatCurrency } from '../utils/installmentUtils'

export default function PaymentModal({ installment, index, installmentCap, onClose, onSubmit }) {
  const [amount, setAmount] = useState(String(installment.dueAmount))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const numAmount = parseFloat(amount) || 0
  const diff = numAmount - installment.dueAmount

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (numAmount <= 0) {
      setError('الرجاء إدخال مبلغ صحيح')
      return
    }
    if (numAmount > installment.dueAmount * 3) {
      setError('المبلغ المدخل أعلى بكثير من المتوقع')
      return
    }

    setLoading(true)
    await onSubmit(index, numAmount)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-gray-800">تسجيل دفعة</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Info */}
        <div className="bg-blue-50 rounded-2xl p-4 mb-5">
          <div className="flex justify-between items-center">
            <span className="text-sm text-blue-600 font-medium">القسط رقم</span>
            <span className="font-bold text-blue-800">#{index + 1}</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-blue-600 font-medium">المبلغ المطلوب</span>
            <span className="font-black text-blue-800 text-lg">{formatCurrency(installment.dueAmount)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 font-semibold mb-2 text-sm">
              المبلغ المدفوع (₪)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              min="0.01"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl font-bold text-center focus:outline-none focus:border-blue-500 transition-colors"
              dir="ltr"
              autoFocus
            />
          </div>

          {/* Difference hint */}
          {numAmount > 0 && numAmount !== installment.dueAmount && (
            <div className={`rounded-xl p-3 text-sm text-center font-medium ${
              diff < 0
                ? 'bg-orange-50 text-orange-700'
                : 'bg-green-50 text-green-700'
            }`}>
              {diff < 0 ? (
                <>⚠️ ناقص {formatCurrency(Math.abs(diff))} — سيُضاف للأقساط القادمة</>
              ) : (
                <>✨ زيادة {formatCurrency(diff)} — ستُخصم من الأقساط القادمة</>
              )}
            </div>
          )}

          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : 'إرسال للتأكيد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
