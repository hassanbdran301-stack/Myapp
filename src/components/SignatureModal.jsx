import React, { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { formatCurrency } from '../utils/installmentUtils'

export default function SignatureModal({ target, onClose, onConfirm }) {
  const sigRef = useRef()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleClear() {
    sigRef.current.clear()
    setError('')
  }

  async function handleConfirm() {
    if (sigRef.current.isEmpty()) {
      setError('الرجاء وضع توقيعك قبل التأكيد')
      return
    }
    setLoading(true)
    const signatureDataUrl = sigRef.current.toDataURL('image/png')
    await onConfirm(signatureDataUrl)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-gray-800">تأكيد استلام الدفعة</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Payment info */}
        <div className="bg-green-50 rounded-2xl p-4 mb-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-green-600 font-medium">المدين</span>
            <span className="font-bold text-green-800">{target.debtorName}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-green-600 font-medium">القسط رقم</span>
            <span className="font-bold text-green-800">#{target.index + 1}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-green-600 font-medium">المبلغ المستلم</span>
            <span className="font-black text-green-800 text-xl">{formatCurrency(target.paidAmount)}</span>
          </div>
          {target.paidAmount !== target.dueAmount && (
            <div className={`mt-3 text-xs rounded-xl px-3 py-2 font-medium ${
              target.paidAmount < target.dueAmount
                ? 'bg-orange-100 text-orange-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {target.paidAmount < target.dueAmount
                ? `⚠️ ناقص ${formatCurrency(target.dueAmount - target.paidAmount)} من المطلوب`
                : `✨ زيادة ${formatCurrency(target.paidAmount - target.dueAmount)} عن المطلوب`}
            </div>
          )}
        </div>

        {/* Signature area */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-700">توقيعك هنا</label>
            <button
              onClick={handleClear}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              مسح التوقيع
            </button>
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-2xl overflow-hidden bg-gray-50">
            <SignatureCanvas
              ref={sigRef}
              penColor="#1e293b"
              canvasProps={{
                width: 400,
                height: 180,
                className: 'w-full',
                style: { touchAction: 'none' },
              }}
            />
          </div>
          <p className="text-xs text-gray-400 text-center mt-1">ارسم توقيعك بإصبعك أو الماوس</p>
        </div>

        {error && (
          <p className="text-red-600 text-sm text-center mb-3">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'جاري التأكيد...' : '✅ تأكيد الاستلام'}
          </button>
        </div>
      </div>
    </div>
  )
}
