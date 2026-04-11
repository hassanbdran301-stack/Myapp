import React, { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
} from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { recalculateAfterPayment, formatCurrency } from '../utils/installmentUtils'
import SignatureModal from '../components/SignatureModal'

export default function CreditorDashboard() {
  const { currentUser, userData, logout, demoMode } = useAuth()
  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(true)
  const [signingTarget, setSigningTarget] = useState(null)
  const [tab, setTab] = useState(0)

  const DEMO_DEBTS = [{
    id: 'demo-debt',
    debtorId: 'demo-debtor',
    creditorId: 'demo-creditor',
    totalAmount: 3000,
    installmentAmount: 1000,
    remainingAmount: 2800,
    status: 'active',
    debtorName: 'أحمد محمد',
    installments: [
      { id: 1, dueAmount: 1000, paidAmount: 200, status: 'awaiting_confirmation', paymentDate: new Date().toISOString(), isExtra: false, signature: null },
      { id: 2, dueAmount: 1000, paidAmount: 0,   status: 'pending',               paymentDate: null, isExtra: false, signature: null },
      { id: 3, dueAmount: 800,  paidAmount: 0,   status: 'pending',               paymentDate: null, isExtra: true,  signature: null },
    ],
  }]

  async function fetchDebts() {
    if (demoMode) {
      setDebts(DEMO_DEBTS)
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(collection(db, 'debts'), where('creditorId', '==', currentUser.uid))
    const snap = await getDocs(q)

    const results = await Promise.all( // eslint-disable-line
      snap.docs.map(async (d) => {
        const data = d.data()
        let debtorName = 'غير معروف'
        try {
          const userSnap = await getDoc(doc(db, 'users', data.debtorId))
          if (userSnap.exists()) debtorName = userSnap.data().name
        } catch {}
        return { id: d.id, ...data, debtorName }
      })
    )
    setDebts(results)
    setLoading(false)
  }

  useEffect(() => {
    fetchDebts()
  }, [currentUser.uid])

  async function handleConfirm(debtId, installmentIndex, paidAmount, signature) {
    if (demoMode) {
      setDebts((prev) => prev.map((d) => {
        if (d.id !== debtId) return d
        const newInst = d.installments.map((inst, i) =>
          i === installmentIndex ? { ...inst, status: 'confirmed', signature, confirmedAt: new Date().toISOString() } : inst
        )
        return { ...d, installments: newInst }
      }))
      setSigningTarget(null)
      return
    }
    const debtRef = doc(db, 'debts', debtId)
    const debtSnap = await getDoc(debtRef)
    const debt = debtSnap.data()

    // Recalculate installments after confirmed payment
    const newInstallments = recalculateAfterPayment(
      debt.installments,
      installmentIndex,
      paidAmount,
      debt.installmentAmount
    )

    // Add signature + confirmedBy to the paid installment
    newInstallments[installmentIndex] = {
      ...newInstallments[installmentIndex],
      signature,
      confirmedBy: currentUser.uid,
      confirmedAt: new Date().toISOString(),
    }

    // Recalculate remaining amount
    const newRemaining = newInstallments
      .filter((i) => i.status !== 'confirmed')
      .reduce((sum, i) => sum + i.dueAmount, 0)

    const isCompleted = newRemaining <= 0

    await updateDoc(debtRef, {
      installments: newInstallments,
      remainingAmount: Math.round(newRemaining * 100) / 100,
      status: isCompleted ? 'completed' : 'active',
    })

    setSigningTarget(null)
    await fetchDebts()
  }

  // Gather all installments awaiting confirmation across debts
  const pendingItems = []
  const confirmedItems = []

  debts.forEach((debt) => {
    debt.installments?.forEach((inst, idx) => {
      const item = { debt, inst, idx }
      if (inst.status === 'awaiting_confirmation') pendingItems.push(item)
      if (inst.status === 'confirmed') confirmedItems.push(item)
    })
  })

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-gradient-to-l from-slate-800 to-green-900 text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💳</span>
          <div>
            <p className="font-black text-base leading-tight">متتبع الديون</p>
            <p className="text-green-200 text-xs">لوحة الدائن</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-green-100 hidden sm:block">{userData?.name}</span>
          <button
            onClick={logout}
            className="bg-white/10 hover:bg-white/20 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            خروج
          </button>
        </div>
      </nav>

      {loading ? (
        <div className="flex items-center justify-center py-32 text-gray-400">جاري التحميل...</div>
      ) : (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <div className="text-3xl font-black text-orange-500">{pendingItems.length}</div>
              <div className="text-sm text-gray-500 mt-1">بانتظار توقيعك</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <div className="text-3xl font-black text-green-600">{confirmedItems.length}</div>
              <div className="text-sm text-gray-500 mt-1">تم التأكيد</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-100">
              {['بانتظار التأكيد', 'المؤكّدة'].map((t, i) => (
                <button
                  key={t}
                  onClick={() => setTab(i)}
                  className={`flex-1 py-4 text-sm font-bold transition-colors ${
                    tab === i
                      ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t}
                  {i === 0 && pendingItems.length > 0 && (
                    <span className="mr-2 bg-orange-500 text-white text-xs rounded-full px-2 py-0.5">
                      {pendingItems.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6">
              {tab === 0 ? (
                /* Pending confirmation */
                pendingItems.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <div className="text-5xl mb-3">✅</div>
                    <p>لا توجد دفعات بانتظار تأكيدك</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingItems.map(({ debt, inst, idx }) => (
                      <div key={`${debt.id}-${idx}`} className="border-2 border-orange-200 bg-orange-50 rounded-2xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{debt.debtorName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              القسط رقم {idx + 1}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {inst.paymentDate && new Date(inst.paymentDate).toLocaleDateString('ar')}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="text-orange-600 font-black text-lg">{formatCurrency(inst.paidAmount)}</p>
                            <p className="text-xs text-gray-400">المبلغ المسدَّد</p>
                          </div>
                        </div>
                        {inst.paidAmount < inst.dueAmount && (
                          <div className="bg-orange-100 rounded-xl px-3 py-2 text-xs text-orange-700 mb-3">
                            ⚠️ المبلغ المدفوع أقل من المطلوب ({formatCurrency(inst.dueAmount)}) — سيتم إضافة أقساط إضافية بعد التأكيد
                          </div>
                        )}
                        {inst.paidAmount > inst.dueAmount && (
                          <div className="bg-green-100 rounded-xl px-3 py-2 text-xs text-green-700 mb-3">
                            ✨ المبلغ المدفوع أعلى من المطلوب — سيتم خصم الفائض من الأقساط القادمة
                          </div>
                        )}
                        <button
                          onClick={() =>
                            setSigningTarget({
                              debtId: debt.id,
                              debtorName: debt.debtorName,
                              index: idx,
                              paidAmount: inst.paidAmount,
                              dueAmount: inst.dueAmount,
                            })
                          }
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
                        >
                          ✍️ توقيع وتأكيد الاستلام
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* Confirmed */
                confirmedItems.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <div className="text-5xl mb-3">📭</div>
                    <p>لا توجد دفعات مؤكّدة بعد</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {confirmedItems.map(({ debt, inst, idx }) => (
                      <div key={`${debt.id}-${idx}`} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs flex items-center justify-center font-bold">✓</span>
                            <p className="font-semibold text-gray-800 text-sm">{debt.debtorName}</p>
                          </div>
                          <p className="text-xs text-gray-400 mt-1 mr-8">
                            القسط {idx + 1} • {inst.confirmedAt && new Date(inst.confirmedAt).toLocaleDateString('ar')}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-green-600 text-sm">{formatCurrency(inst.paidAmount)}</p>
                          {inst.signature && (
                            <img
                              src={inst.signature}
                              alt="توقيع"
                              className="w-16 h-8 object-contain border border-gray-200 rounded mt-1"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {signingTarget && (
        <SignatureModal
          target={signingTarget}
          onClose={() => setSigningTarget(null)}
          onConfirm={(signature) =>
            handleConfirm(
              signingTarget.debtId,
              signingTarget.index,
              signingTarget.paidAmount,
              signature
            )
          }
        />
      )}
    </div>
  )
}
