import React, { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
} from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { buildInitialInstallments, formatCurrency } from '../utils/installmentUtils'
import CreateUserModal from '../components/CreateUserModal'
import CreateDebtModal from '../components/CreateDebtModal'

const TABS = ['الديون', 'المستخدمون']

export default function AdminDashboard() {
  const { userData, logout } = useAuth()
  const [tab, setTab] = useState(0)
  const [users, setUsers] = useState([])
  const [debts, setDebts] = useState([])
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showCreateDebt, setShowCreateDebt] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  async function fetchData() {
    setLoadingData(true)
    const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))
    setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })))

    const debtsSnap = await getDocs(query(collection(db, 'debts'), orderBy('createdAt', 'desc')))
    setDebts(debtsSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setLoadingData(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function handleCreateDebt(debtData) {
    const installments = buildInitialInstallments(debtData.totalAmount, debtData.installmentAmount)
    await addDoc(collection(db, 'debts'), {
      ...debtData,
      remainingAmount: debtData.totalAmount,
      installments,
      status: 'active',
      createdAt: new Date().toISOString(),
    })
    await fetchData()
    setShowCreateDebt(false)
  }

  const debtors = users.filter((u) => u.role === 'debtor')
  const creditors = users.filter((u) => u.role === 'creditor')

  const roleLabel = { admin: 'أدمن', debtor: 'مدين', creditor: 'دائن' }
  const roleColor = {
    admin: 'bg-purple-100 text-purple-700',
    debtor: 'bg-red-100 text-red-700',
    creditor: 'bg-green-100 text-green-700',
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-gradient-to-l from-slate-800 to-blue-900 text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💳</span>
          <div>
            <p className="font-black text-base leading-tight">متتبع الديون</p>
            <p className="text-blue-200 text-xs">لوحة الأدمن</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-blue-100 hidden sm:block">{userData?.name}</span>
          <button
            onClick={logout}
            className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            خروج
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'إجمالي الديون', value: debts.length, icon: '📋', color: 'blue' },
            { label: 'المدينون', value: debtors.length, icon: '👤', color: 'red' },
            { label: 'الدائنون', value: creditors.length, icon: '👤', color: 'green' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`text-2xl font-black text-${s.color}-600`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {TABS.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                className={`flex-1 py-4 text-sm font-bold transition-colors ${
                  tab === i
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-6">
            {loadingData ? (
              <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
            ) : tab === 0 ? (
              /* Debts Tab */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-800">قائمة الديون</h2>
                  <button
                    onClick={() => setShowCreateDebt(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                  >
                    + إضافة دين
                  </button>
                </div>

                {debts.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <div className="text-5xl mb-3">📭</div>
                    <p>لا توجد ديون بعد</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {debts.map((debt) => {
                      const debtor = users.find((u) => u.id === debt.debtorId)
                      const creditor = users.find((u) => u.id === debt.creditorId)
                      const progress = ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100
                      return (
                        <div key={debt.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                            <div>
                              <p className="font-bold text-gray-800 text-sm">
                                {debtor?.name || 'غير محدد'}
                                <span className="text-gray-400 font-normal mx-2">←</span>
                                {creditor?.name || 'غير محدد'}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {new Date(debt.createdAt).toLocaleDateString('ar')}
                              </p>
                            </div>
                            <div className="text-left">
                              <p className="text-red-600 font-black text-base">{formatCurrency(debt.remainingAmount)}</p>
                              <p className="text-xs text-gray-400 text-left">من {formatCurrency(debt.totalAmount)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-green-500 h-2 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-10 text-left">{Math.round(progress)}%</span>
                          </div>
                          <div className="mt-2 flex gap-2 flex-wrap">
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                              قسط: {formatCurrency(debt.installmentAmount)}
                            </span>
                            <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">
                              {debt.installments?.filter((i) => i.status !== 'confirmed').length} قسط متبقي
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${debt.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                              {debt.status === 'completed' ? 'مكتمل' : 'نشط'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Users Tab */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-800">المستخدمون</h2>
                  <button
                    onClick={() => setShowCreateUser(true)}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                  >
                    + إضافة مستخدم
                  </button>
                </div>

                {users.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <div className="text-5xl mb-3">👥</div>
                    <p>لا يوجد مستخدمون بعد</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-3 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                            {u.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{u.name}</p>
                            <p className="text-xs text-gray-400" dir="ltr">{u.email}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${roleColor[u.role]}`}>
                          {roleLabel[u.role]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateUser && (
        <CreateUserModal
          onClose={() => setShowCreateUser(false)}
          onCreated={() => { fetchData(); setShowCreateUser(false) }}
        />
      )}
      {showCreateDebt && (
        <CreateDebtModal
          users={users}
          onClose={() => setShowCreateDebt(false)}
          onSubmit={handleCreateDebt}
        />
      )}
    </div>
  )
}
