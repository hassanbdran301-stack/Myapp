import React, { useState } from 'react'
import { formatCurrency } from '../utils/installmentUtils'

export default function CreateDebtModal({ users, onClose, onSubmit }) {
  const debtors = users.filter((u) => u.role === 'debtor')
  const creditors = users.filter((u) => u.role === 'creditor')

  const [form, setForm] = useState({
    debtorId: '',
    creditorId: '',
    totalAmount: '',
    installmentAmount: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const total = parseFloat(form.totalAmount) || 0
  const installment = parseFloat(form.installmentAmount) || 0
  const installmentCount = total > 0 && installment > 0
    ? Math.ceil(total / installment)
    : 0

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.debtorId) { setError('اختر المدين'); return }
    if (!form.creditorId) { setError('اختر الدائن'); return }
    if (total <= 0) { setError('أدخل مبلغ الدين'); return }
    if (installment <= 0) { setError('أدخل مبلغ القسط'); return }
    if (installment > total) { setError('مبلغ القسط لا يمكن أن يتجاوز إجمالي الدين'); return }

    setLoading(true)
    await onSubmit({
      debtorId: form.debtorId,
      creditorId: form.creditorId,
      totalAmount: total,
      installmentAmount: installment,
      notes: form.notes,
    })
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-gray-800">إضافة دين جديد</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Debtor */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">المدين 👤</label>
            <select
              value={form.debtorId}
              onChange={(e) => set('debtorId', e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors bg-white"
              required
            >
              <option value="">-- اختر المدين --</option>
              {debtors.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
            {debtors.length === 0 && (
              <p className="text-xs text-orange-500 mt-1">لا يوجد مدينون — أنشئ مستخدماً بدور "مدين" أولاً</p>
            )}
          </div>

          {/* Creditor */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">الدائن 💰</label>
            <select
              value={form.creditorId}
              onChange={(e) => set('creditorId', e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors bg-white"
              required
            >
              <option value="">-- اختر الدائن --</option>
              {creditors.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>

          {/* Total amount */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">مبلغ الدين الإجمالي (₪)</label>
            <input
              type="number"
              value={form.totalAmount}
              onChange={(e) => set('totalAmount', e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors text-lg font-bold"
              placeholder="0.00"
              min="1"
              step="0.01"
              dir="ltr"
              required
            />
          </div>

          {/* Installment amount */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">مبلغ القسط الشهري (₪)</label>
            <input
              type="number"
              value={form.installmentAmount}
              onChange={(e) => set('installmentAmount', e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors text-lg font-bold"
              placeholder="0.00"
              min="1"
              step="0.01"
              dir="ltr"
              required
            />
          </div>

          {/* Preview */}
          {installmentCount > 0 && (
            <div className="bg-blue-50 rounded-2xl p-4 text-center">
              <p className="text-sm text-blue-600 font-medium">عدد الأقساط المتوقع</p>
              <p className="text-3xl font-black text-blue-800 mt-1">{installmentCount}</p>
              <p className="text-xs text-blue-500 mt-1">
                {installmentCount - 1} قسط × {formatCurrency(installment)}
                {total % installment > 0 && ` + قسط أخير ${formatCurrency(total % installment)}`}
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">ملاحظات (اختياري)</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors resize-none"
              rows={2}
              placeholder="أي ملاحظات إضافية..."
            />
          </div>

          <div className="flex gap-3 pt-1">
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
              {loading ? 'جاري الحفظ...' : 'إنشاء الدين'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
