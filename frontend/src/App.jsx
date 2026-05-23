import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LandingPage from './pages/LandingPage'

// Placeholder for pages coming soon
function ComingSoon({ page }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="glass-card p-10 text-center max-w-sm">
        <div className="text-4xl mb-4">🚧</div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">{page}</h2>
        <p className="text-text-secondary text-sm">This page is coming soon.</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected app routes */}
          <Route path="/dashboard" element={<ProtectedRoute><ComingSoon page="Dashboard" /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><ComingSoon page="AI Studio" /></ProtectedRoute>} />
          <Route path="/posts" element={<ProtectedRoute><ComingSoon page="Content Manager" /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><ComingSoon page="Analytics" /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><ComingSoon page="Settings" /></ProtectedRoute>} />
          <Route path="/health" element={<ProtectedRoute><ComingSoon page="System Health" /></ProtectedRoute>} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
