import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'

// Pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import CreatePostPage from './pages/CreatePostPage'
import SchedulingPage from './pages/SchedulingPage'
import ContentManagerPage from './pages/ContentManagerPage'
import SettingsPage from './pages/SettingsPage'
import InstagramCallbackPage from './pages/InstagramCallbackPage'
import HelpPage from './pages/HelpPage'

// Placeholder for pages coming soon — uses real AppLayout so sidebar already works
function ComingSoon({ page }) {
  return (
    <AppLayout title={page}>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-10 rounded-xl max-w-sm"
          style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-4xl mb-4">🚧</div>
          <h2 className="text-xl font-semibold text-white mb-2">{page}</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>This page is coming soon.</p>
        </div>
      </div>
    </AppLayout>
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
          <Route path="/auth/instagram/callback" element={<InstagramCallbackPage />} />

          {/* Protected app routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/create"    element={<ProtectedRoute><CreatePostPage /></ProtectedRoute>} />
          <Route path="/posts"     element={<ProtectedRoute><ContentManagerPage /></ProtectedRoute>} />
          <Route path="/schedule"  element={<ProtectedRoute><SchedulingPage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><ComingSoon page="Analytics" /></ProtectedRoute>} />
          <Route path="/health"    element={<ProtectedRoute><ComingSoon page="System Logs" /></ProtectedRoute>} />
          <Route path="/settings"  element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/help"      element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
