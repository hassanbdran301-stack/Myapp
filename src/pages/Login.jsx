import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const DEMO_ROLES = [
  { role: 'admin',    label: 'أدمن',  icon: '⚙️', color: 'bg-purple-600 hover:bg-purple-700', desc: 'إدارة المستخدمين والديون' },
  { role: 'debtor',   label: 'مدين',  icon: '👤', color: 'bg-red-500 hover:bg-red-600',      desc: 'عرض الأقساط وتسديدها' },
  { role: 'creditor', label: 'دائن',  icon: '💰', color: 'bg-green-600 hover:bg-green-700',  desc: 'تأكيد الدفعات والتوقيع' },
]

export default function Login() {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const { login, demoLogin, currentUser, userRole } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (currentUser && userRole) {
      if (userRole === 'admin')    navigate('/admin')
      else if (userRole === 'debtor')   navigate('/debtor')
      else if (userRole === 'creditor') navigate('/creditor')
    }
  }, [currentUser, userRole, navigate])

  function handleDemoLogin(role) {
    demoLogin(role)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 backdrop-blur mb-4">
            <span className="text-4xl">💳</span>
          </div>
          <h1 className="text-3xl font-black text-white">متتبع الديون</h1>
          <p className="text-blue-200 mt-1 text-sm">إدارة وتتبع الأقساط بكل سهولة</p>
        </div>

        {/* Demo preview card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">👁️</span>
            <h2 className="text-base font-black text-gray-800">معاينة سريعة</h2>
            <span className="mr-auto text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">بدون تسجيل</span>
          </div>
          <p className="text-xs text-gray-400 mb-4">اضغط على أي دور لترى لوحته مباشرة</p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ROLES.map(({ role, label, icon, color, desc }) => (
              <button
                key={role}
                onClick={() => handleDemoLogin(role)}
                className={`${color} text-white rounded-xl py-3 px-2 text-center transition-all active:scale-95 shadow-md`}
              >
                <div className="text-2xl mb-1">{icon}</div>
                <div className="font-black text-sm">{label}</div>
                <div className="text-xs opacity-80 mt-0.5 leading-tight hidden sm:block">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Real login */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <button
            onClick={() => setShowLogin(!showLogin)}
            className="w-full py-4 px-6 flex items-center justify-between text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span className="font-bold text-sm">تسجيل الدخول الحقيقي</span>
            <span className="text-gray-400 text-sm">{showLogin ? '▲' : '▼'}</span>
          </button>

          {showLogin && (
            <div className="px-6 pb-6 border-t border-gray-100 pt-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm text-center">
                  ⚠️ {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1.5 text-sm">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="example@email.com"
                    required
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1.5 text-sm">كلمة المرور</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="••••••••"
                    required
                    dir="ltr"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  {loading ? 'جاري الدخول...' : 'دخول'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
