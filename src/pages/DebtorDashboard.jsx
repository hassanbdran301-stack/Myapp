import React, { useState, useEffect, useRef } from 'react'
import { db } from '../firebase/config'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../utils/installmentUtils'
import PaymentModal from '../components/PaymentModal'

function AnimatedAmount({ value }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const frameRef = useRef(null)

  useEffect(() => {
    const start = prevRef.current
    const end = value
    if (start === end) return

    const duration = 800
    const startTime = performance.now()

    function step(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(start + (end - start) * eased)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        prevRef.current = end
      }
    }

    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value])

  return (
    <span>
      {new Intl.NumberFormat('ar-IL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(display)}
      {' ₪'}
    </span>
  )
}

const STATUS_LABEL = {
  pending: 'معلّق',
  awaiting_confirmation: 'بانتظار تأكيد الدائن',
  confirmed: 'مؤكّد',
}

const STATUS_COLOR = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  awaiting_confirmation: 'bg-blue-50 text-blue-700 border-blue-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
}

export default function DebtorDashboard() {
  const { currentUser, userData, logout } = useAuth()
  const [debt, setDebt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payingIndex, setPayingIndex] = useState(null)

  async function fetchDebt() {
    const q = query(
      collection(db, 'debts'),
      where('debtorId', '==', currentUser.uid),
      where('status', '==', 'active')
    )
    const snap = await getDocs(q)
    if (!snap.empty) {
      const d = snap.docs[0]
      setDebt({ id: d.id, ...d.data() })
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDebt()
  }, [currentUser.uid])

  async function handlePaymentSubmit(index, amount) {
    const newInstallments = debt.installments.map((inst, i) => {
      if (i === index) {
        return {
          ...inst,
          paidAmount: amount,
          status: 'awaiting_confirmation',
          paymentDate: new Date().toISOString(),
        }
      }
      return inst
    })

    await updateDoc(doc(db, 'debts', debt.id), {
      installments: newInstallments,
    })
    setDebt((prev) => ({ ...prev, installments: newInstallments }))
    setPayingIndex(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-gray-400 text-lg">جاري التحميل...</div>
      </div>
    )
  }

  const confirmed = debt?.installments?.filter((i) => i.status === 'confirmed') || []
  const pending = debt?.installments?.filter((i) => i.status !== 'confirmed') || []
  const totalPaid = confirmed.reduce((s, i) => s + i.paidAmount, 0)
  const progress = debt ? (totalPaid / debt.totalAmount) * 100 : 0

  // Next installment to pay
  const nextPayableIndex = debt?.installments?.findIndex(
    (i) => i.status === 'pending'
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-gradient-to-l from-slate-800 to-blue-900 text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💳</span>
          <div>
            <p className="font-black text-base leading-tight">متتبع الديون</p>
            <p className="text-blue-200 text-xs">لوحة المدين</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-blue-100 hidden sm:block">{userData?.name}</span>
          <button
            onClick={logout}
            className="bg-white/10 hover:bg-white/20 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            خروج
          </button>
        </div>
      </nav>

      {!debt ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-lg">لا يوجد دين مسجّل باسمك حالياً</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">

          {/* ── REMAINING DEBT HEADER ── */}
          <div className="bg-gradient-to-br from-red-600 to-rose-700 rounded-3xl p-6 text-white shadow-xl shadow-red-200 text-center">
            <p className="text-red-100 text-sm font-medium mb-1">المبلغ المتبقي من الدين</p>
            <div className="text-5xl font-black tracking-tight my-2">
              <AnimatedAmount value={debt.remainingAmount} />
            </div>
            <p className="text-red-200 text-xs mt-1">
              من أصل {formatCurrency(debt.totalAmount)}
            </p>

            {/* Progress bar */}
            <div className="mt-4 bg-red-800/40 rounded-full h-3 overflow-hidden">
              <div
                className="bg-white h-3 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-red-100 text-xs mt-2">
              تم سداد {Math.round(progress)}% من الدين
            </p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'مدفوع', value: formatCurrency(totalPaid), icon: '✅', color: 'green' },
              { label: 'القسط', value: formatCurrency(debt.installmentAmount), icon: '📅', color: 'blue' },
              { label: 'أقساط متبقية', value: pending.length, icon: '🔢', color: 'orange' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-3 shadow-sm text-center">
                <div className="text-xl mb-1">{s.icon}</div>
                <div className={`text-sm font-black text-${s.color}-600 leading-tight`}>{s.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Installments table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">جدول الأقساط</h2>
              {nextPayableIndex !== -1 && nextPayableIndex !== undefined && (
                <button
                  onClick={() => setPayingIndex(nextPayableIndex)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                >
                  تسديد القسط التالي
                </button>
              )}
            </div>

            <div className="divide-y divide-gray-50">
              {debt.installments.map((inst, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 px-5 py-3.5 ${
                    inst.status === 'confirmed' ? 'opacity-60' : ''
                  }`}
                >
                  {/* Number */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    inst.status === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : inst.status === 'awaiting_confirmation'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {inst.status === 'confirmed' ? '✓' : idx + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800 text-sm">
                        {formatCurrency(inst.dueAmount)}
                      </span>
                      {inst.isExtra && (
                        <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">
                          إضافي
                        </span>
                      )}
                    </div>
                    {inst.paymentDate && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {inst.status === 'confirmed' ? 'سُدِّد' : 'في انتظار التأكيد'}{' '}
                        {new Date(inst.paymentDate).toLocaleDateString('ar')}
                        {inst.status !== 'pending' && inst.paidAmount !== inst.dueAmount && (
                          <span className="mr-1 text-blue-500">
                            (مدفوع: {formatCurrency(inst.paidAmount)})
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Status + action */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLOR[inst.status]}`}>
                      {STATUS_LABEL[inst.status]}
                    </span>
                    {inst.status === 'pending' && (
                      <button
                        onClick={() => setPayingIndex(idx)}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold px-3 py-1 rounded-lg transition-colors"
                      >
                        سدّد
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {payingIndex !== null && (
        <PaymentModal
          installment={debt.installments[payingIndex]}
          index={payingIndex}
          installmentCap={debt.installmentAmount}
          onClose={() => setPayingIndex(null)}
          onSubmit={handlePaymentSubmit}
        />
      )}
    </div>
  )
}
