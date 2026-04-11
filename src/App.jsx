import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import DebtorDashboard from './pages/DebtorDashboard'
import CreditorDashboard from './pages/CreditorDashboard'

function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userRole } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(userRole)) return <Navigate to="/login" replace />
  return children
}

function RootRedirect() {
  const { currentUser, userRole } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (userRole === 'admin') return <Navigate to="/admin" replace />
  if (userRole === 'debtor') return <Navigate to="/debtor" replace />
  if (userRole === 'creditor') return <Navigate to="/creditor" replace />
  return <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/debtor"
        element={
          <ProtectedRoute allowedRoles={['debtor']}>
            <DebtorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/creditor"
        element={
          <ProtectedRoute allowedRoles={['creditor']}>
            <CreditorDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
