import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '../firebase/config'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

// ── بيانات وضع المعاينة ──────────────────────────────────────
const DEMO_USERS = {
  admin:    { uid: 'demo-admin',    email: 'admin@preview.com',    name: 'مدير النظام',  role: 'admin' },
  debtor:   { uid: 'demo-debtor',   email: 'debtor@preview.com',   name: 'أحمد محمد',    role: 'debtor' },
  creditor: { uid: 'demo-creditor', email: 'creditor@preview.com', name: 'خالد علي',     role: 'creditor' },
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userRole, setUserRole]       = useState(null)
  const [userData, setUserData]       = useState(null)
  const [loading, setLoading]         = useState(true)
  const [demoMode, setDemoMode]       = useState(false)

  // تسجيل دخول حقيقي
  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  // دخول وضع المعاينة (بدون Firebase)
  function demoLogin(role) {
    const user = DEMO_USERS[role]
    setCurrentUser({ uid: user.uid, email: user.email })
    setUserData(user)
    setUserRole(user.role)
    setDemoMode(true)
  }

  async function logout() {
    if (demoMode) {
      setCurrentUser(null)
      setUserData(null)
      setUserRole(null)
      setDemoMode(false)
      return
    }
    return signOut(auth)
  }

  async function createUser(email, password, name, role) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email,
      name,
      role,
      createdAt: new Date().toISOString(),
    })
    return userCredential
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          const data = userDoc.data()
          setUserData(data)
          setUserRole(data.role)
        }
      } else {
        if (!demoMode) {
          setUserData(null)
          setUserRole(null)
          setCurrentUser(null)
        }
      }
      if (!demoMode) setCurrentUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const value = {
    currentUser,
    userRole,
    userData,
    demoMode,
    login,
    demoLogin,
    logout,
    createUser,
    loading,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
