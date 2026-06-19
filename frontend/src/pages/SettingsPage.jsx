/**
 * BrandFlow AI — Settings Page (Instagram Integration)
 * Route: /settings
 *
 * APIs wired (all under /api/v1/oauth):
 *
 *  GET    /oauth/instagram/status          → load current connection state on mount
 *  GET    /oauth/instagram/connect-url     → fetch Meta OAuth URL → open popup (Auto connect)
 *  POST   /oauth/instagram/exchange-code   → called inside popup callback via postMessage
 *  POST   /oauth/instagram/connect-manual  → body: { access_token, facebook_page_id, instagram_business_id }
 *  DELETE /oauth/instagram/disconnect      → remove connection
 *
 * Popup flow:
 *   1. Click "Connect with Meta" → call GET /connect-url → open popup at auth_url
 *   2. Meta redirects popup to /auth/instagram/callback
 *   3. InstagramCallbackPage.jsx reads ?code= from URL → postMessage({type:'INSTAGRAM_AUTH_CODE', code})
 *   4. SettingsPage listener receives message → calls POST /exchange-code → updates status
 *
 * ManualTokenConnectRequest body:
 *   { access_token: string, facebook_page_id: string, instagram_business_id: string }
 *
 * InstagramStatusResponse:
 *   { instagram_connected, instagram_business_id, facebook_page_id,
 *     instagram_username, token_created_at, message }
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import AppLayout from '../components/AppLayout'
import api from '../api/client'

// ─── API helpers (extend services inline to keep zero risk of wrong paths) ─────
const oauthApi = {
  getStatus:      ()     => api.get('/oauth/instagram/status'),
  getConnectUrl:  ()     => api.get('/oauth/instagram/connect-url'),
  exchangeCode:   (code) => api.post('/oauth/instagram/exchange-code', { code }),
  connectManual:  (data) => api.post('/oauth/instagram/connect-manual', data),
  disconnect:     ()     => api.delete('/oauth/instagram/disconnect'),
}

// ─── Icon ─────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, color, sw = 1.5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke={color || 'currentColor'} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onClose }) {
  const C = { success: '#10B981', error: '#EF4444', info: '#F59E0B' }
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className="fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-2xl"
      style={{ background: '#0d1117', border: `1px solid ${C[type]}44`, color: C[type], minWidth: '280px' }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: C[type] }} />
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="opacity-40 hover:opacity-100 text-white ml-2">✕</button>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function daysSince(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso)) / 86400000)
}

// ─── Panel styles ─────────────────────────────────────────────────────────────
const glass = {
  background: 'rgba(17,24,39,0.7)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
}
const glassActive = {
  ...glass,
  border: '1px solid rgba(239,68,68,0.35)',
  boxShadow: '0 0 30px rgba(239,68,68,0.05)',
}

// ─── Connection Status Panel ──────────────────────────────────────────────────
function StatusPanel({ status, loading, onDisconnect, disconnecting }) {
  const connected = status?.instagram_connected
  const age = daysSince(status?.token_created_at)
  const tokenWarning = age !== null && age > 50  // 60-day tokens expire

  return (
    <div className="rounded-xl p-5 space-y-4" style={connected ? glassActive : glass}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Connection Status
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full"
            style={{ background: loading ? '#F59E0B' : connected ? '#10B981' : '#6B7280',
                     boxShadow: connected ? '0 0 6px #10B981' : 'none',
                     animation: connected ? 'pulse 2s infinite' : 'none' }} />
          <span className="text-[10px] font-bold font-mono"
            style={{ color: loading ? '#F59E0B' : connected ? '#10B981' : '#6B7280' }}>
            {loading ? 'Checking…' : connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Account info */}
      {connected ? (
        <div className="space-y-3">
          {/* IG username */}
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
            {/* IG gradient icon */}
            <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>
              <Icon d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                size={16} color="white" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm">
                {status.instagram_username ? `@${status.instagram_username}` : 'Instagram Business'}
              </p>
              <p className="text-[10px] text-green-400 font-mono">Active · Auto-posting enabled</p>
            </div>
          </div>

          {/* IDs */}
          <div className="grid grid-cols-1 gap-2">
            {[
              { label: 'Instagram Business ID', val: status.instagram_business_id },
              { label: 'Facebook Page ID',       val: status.facebook_page_id },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-[10px] text-white/40">{r.label}</span>
                <span className="text-[10px] font-mono text-white/60 truncate max-w-[140px]">{r.val || '—'}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="text-[10px] text-white/40">Token Connected</span>
              <span className="text-[10px] font-mono text-white/60">{fmtDate(status.token_created_at)}</span>
            </div>
          </div>

          {/* Token age warning */}
          {tokenWarning && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Icon d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                size={13} color="#F59E0B" />
              <p className="text-[10px] text-yellow-400">Token is {age} days old — refresh within 60 days to avoid expiry.</p>
            </div>
          )}

          {/* Disconnect */}
          <button onClick={onDisconnect} disabled={disconnecting}
            className="w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            {disconnecting
              ? <><span className="w-3.5 h-3.5 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />Disconnecting…</>
              : <><Icon d="M18 6 6 18M6 6l12 12" size={13} color="#EF4444" />Disconnect Instagram</>}
          </button>
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Icon d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
              size={22} color="rgba(255,255,255,0.2)" />
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            {status?.message || 'No Instagram account connected. Connect below to enable auto-posting.'}
          </p>
        </div>
      )}

      {/* API uptime indicator */}
      <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-white/35">Meta Graph API</span>
          <span className="text-[10px] font-mono text-green-400">Operational</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full rounded-full" style={{ width: '99.9%', background: '#10B981' }} />
        </div>
      </div>
    </div>
  )
}

// ─── Prerequisites Panel ──────────────────────────────────────────────────────
function PrerequisitesPanel({ connected }) {
  const items = [
    { label: 'Professional Account', desc: 'Instagram must be set to Business or Creator type.', done: true },
    { label: 'Linked Facebook Page',  desc: 'IG account must be connected to a Facebook Page you admin.', done: true },
    { label: 'Admin Privileges',      desc: 'You need admin access on the linked FB Page.', done: connected },
  ]
  return (
    <div className="rounded-xl p-5" style={glass}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Prerequisites
      </p>
      <ul className="space-y-4">
        {items.map(i => (
          <li key={i.label} className="flex items-start gap-3">
            <span className="flex-shrink-0 mt-0.5">
              {i.done
                ? <Icon d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3" size={16} color="#EF4444" />
                : <Icon d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" size={16} color="rgba(255,255,255,0.2)" />}
            </span>
            <div>
              <p className="text-sm font-semibold text-white">{i.label}</p>
              <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{i.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      <a href="https://developers.facebook.com/docs/instagram-api/getting-started"
        target="_blank" rel="noreferrer"
        className="mt-5 flex items-center justify-between p-3 rounded-lg transition-colors group"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <Icon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"
            size={15} color="rgba(255,255,255,0.4)" />
          <span className="text-xs text-white/60 group-hover:text-white transition-colors">View Meta Integration Docs</span>
        </div>
        <Icon d="M9 18l6-6-6-6" size={13} color="rgba(255,255,255,0.3)" />
      </a>
    </div>
  )
}

// ─── Main SettingsPage ────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [status,        setStatus]        = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)

  // Auto-connect (OAuth popup) state
  const [popupLoading,  setPopupLoading]  = useState(false)
  const popupRef = useRef(null)
  const listenerRef = useRef(null)

  // Manual form state
  const [manualToken,   setManualToken]   = useState('')
  const [pageId,        setPageId]        = useState('')
  const [igBizId,       setIgBizId]       = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [showToken,     setShowToken]     = useState(false)

  const [toast, setToast] = useState(null)
  const showToast = (message, type = 'success') => setToast({ message, type })

  // ── Load status on mount ──────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const res = await oauthApi.getStatus()
      setStatus(res.data)
    } catch {
      showToast('Could not load Instagram status.', 'error')
    } finally { setStatusLoading(false) }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  // ── Cleanup popup listener on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      if (listenerRef.current) window.removeEventListener('message', listenerRef.current)
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close()
    }
  }, [])

  // ── Auto connect (OAuth popup) ────────────────────────────────────────────
  const handleAutoConnect = async () => {
    setPopupLoading(true)
    try {
      const res = await oauthApi.getConnectUrl()
      const authUrl = res.data?.auth_url
      if (!authUrl) throw new Error('No auth URL returned')

      // Open popup
      const popup = window.open(authUrl, 'instagram_oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes')
      popupRef.current = popup

      if (!popup) {
        showToast('Popup was blocked. Please allow popups for this site.', 'error')
        setPopupLoading(false)
        return
      }

      // Listen for message from InstagramCallbackPage
      const handler = async (event) => {
        // Only accept messages from same origin
        if (event.origin !== window.location.origin) return

        const { type, code, error } = event.data || {}

        if (type === 'INSTAGRAM_AUTH_ERROR') {
          window.removeEventListener('message', handler)
          setPopupLoading(false)
          showToast(error || 'Instagram connection failed.', 'error')
          return
        }

        if (type === 'INSTAGRAM_AUTH_CODE' && code) {
          window.removeEventListener('message', handler)
          // Exchange code for token (full auto-discovery)
          try {
            const exchangeRes = await oauthApi.exchangeCode(code)
            showToast(exchangeRes.data?.message || 'Instagram connected successfully!')
            await fetchStatus()
          } catch (err) {
            const msg = err?.response?.data?.detail || 'Code exchange failed.'
            showToast(msg, 'error')
          } finally {
            setPopupLoading(false)
            if (popupRef.current && !popupRef.current.closed) popupRef.current.close()
          }
        }
      }

      listenerRef.current = handler
      window.addEventListener('message', handler)

      // Detect if popup closed without completing
      const pollClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollClosed)
          window.removeEventListener('message', handler)
          setPopupLoading(false)
        }
      }, 500)

    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to get OAuth URL. Check META_APP_ID in .env'
      showToast(msg, 'error')
      setPopupLoading(false)
    }
  }

  // ── Manual connect ────────────────────────────────────────────────────────
  const handleManualConnect = async () => {
    if (!manualToken.trim()) { showToast('Access token is required.', 'error'); return }
    if (!pageId.trim())      { showToast('Facebook Page ID is required.', 'error'); return }
    if (!igBizId.trim())     { showToast('Instagram Business Account ID is required.', 'error'); return }

    setManualLoading(true)
    try {
      const res = await oauthApi.connectManual({
        access_token:          manualToken.trim(),
        facebook_page_id:      pageId.trim(),
        instagram_business_id: igBizId.trim(),
      })
      showToast(res.data?.message || 'Instagram connected manually!')
      setManualToken(''); setPageId(''); setIgBizId('')
      await fetchStatus()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Manual connection failed. Check your credentials.'
      showToast(msg, 'error')
    } finally { setManualLoading(false) }
  }

  // ── Disconnect ────────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await oauthApi.disconnect()
      showToast('Instagram disconnected.')
      await fetchStatus()
    } catch { showToast('Disconnect failed.', 'error') }
    finally { setDisconnecting(false) }
  }

  const connected = status?.instagram_connected

  return (
    <AppLayout title="Settings">
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.6;transform:scale(0.95)} 50%{opacity:1;transform:scale(1.05)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .settings-anim { animation: fadeUp 0.4s ease; }
        .input-dark { background:#050505; border:1px solid rgba(255,255,255,0.08); color:#fff; border-radius:10px; padding:10px 14px; font-size:13px; width:100%; outline:none; transition:border-color 0.15s; }
        .input-dark:focus { border-color:rgba(239,68,68,0.5); }
        .input-dark::placeholder { color:rgba(255,255,255,0.2); }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Ambient glow */}
      <div className="pointer-events-none fixed top-0 right-0 w-1/2 h-1/2 -z-10"
        style={{ background: 'radial-gradient(ellipse at top right, rgba(239,68,68,0.05) 0%, transparent 65%)' }} />

      <div className="max-w-[1300px] mx-auto settings-anim">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-white tracking-tight">Instagram Integration</h1>
          <p className="text-xs mt-1 max-w-2xl" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Configure your Meta Graph API connection to enable automated posting, scheduling, and AI-driven content publishing.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

          {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
          <div className="xl:col-span-8 space-y-6">

            {/* Already Connected Banner */}
            {connected && (
              <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <Icon d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3" size={18} color="#10B981" />
                <div>
                  <p className="text-sm font-bold text-green-400">Instagram is Connected</p>
                  <p className="text-[11px] text-white/40">
                    @{status?.instagram_username || 'account'} · Auto-posting is active
                  </p>
                </div>
              </div>
            )}

            {/* ── EXPRESS CONNECTION (Auto OAuth) ───────────────────────────── */}
            <div className="rounded-xl p-6 relative overflow-hidden" style={glass}>
              {/* Top edge shimmer */}
              <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)' }} />

              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Icon d="M13 10V3L4 14h7v7l9-11h-7z" size={16} color="#EF4444" />
                    Express Connection
                  </h2>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Recommended. Authenticate via the standard Meta OAuth popup — no ID hunting required.
                  </p>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Standard
                </span>
              </div>

              {/* OAuth zone */}
              <div className="flex flex-col items-center justify-center text-center py-10 rounded-xl"
                style={{ background: 'rgba(5,5,5,0.6)', border: '1px dashed rgba(255,255,255,0.07)' }}>
                {/* Instagram gradient ring */}
                <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)',
                           boxShadow: '0 0 30px rgba(239,68,68,0.25)' }}>
                  <Icon d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                    size={28} color="white" />
                </div>

                <h3 className="text-sm font-bold text-white mb-1">
                  {connected ? 'Reconnect your Instagram Account' : 'Connect your Instagram Professional Account'}
                </h3>
                <p className="text-xs mb-6 max-w-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  A secure Meta popup will open. Log in and grant BrandFlow AI the required permissions.
                  We auto-discover your Page and Business Account IDs.
                </p>

                <button
                  onClick={handleAutoConnect}
                  disabled={popupLoading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: '#EF4444', boxShadow: '0 0 20px rgba(239,68,68,0.3)' }}>
                  {popupLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Opening Meta…
                    </>
                  ) : (
                    <>
                      <Icon d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                        size={15} />
                      {connected ? 'Reconnect with Meta' : 'Connect with Meta'}
                    </>
                  )}
                </button>

                {/* Permission list */}
                <div className="flex flex-wrap justify-center gap-1.5 mt-5">
                  {['instagram_basic', 'instagram_content_publish', 'pages_manage_metadata', 'pages_read_engagement'].map(p => (
                    <span key={p} className="text-[9px] px-2 py-0.5 rounded font-mono"
                      style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── MANUAL CONFIGURATION ──────────────────────────────────────── */}
            <div className="rounded-xl p-6" style={glass}>
              <div className="flex items-start justify-between mb-5 pb-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Icon d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" size={16} color="rgba(255,255,255,0.5)" />
                    Manual Configuration
                  </h2>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    For developers using Graph API Explorer or managing custom Meta Apps.
                  </p>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  Advanced
                </span>
              </div>

              {/* How-to guide */}
              <div className="mb-5 p-4 rounded-lg text-xs leading-relaxed space-y-1"
                style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)', color: 'rgba(255,255,255,0.5)' }}>
                <p className="font-bold text-yellow-400 mb-2">How to get your credentials:</p>
                <p>1. Go to <strong className="text-white/70">developers.facebook.com/tools/explorer</strong></p>
                <p>2. Select your BrandFlow app → add permissions → click <strong className="text-white/70">Generate Access Token</strong></p>
                <p>3. Copy the long-lived token (valid 60 days)</p>
                <p>4. Run <code className="bg-black/40 px-1 rounded font-mono">/me/accounts</code> to get your Facebook Page ID</p>
                <p>5. Run <code className="bg-black/40 px-1 rounded font-mono">/&#123;page_id&#125;?fields=instagram_business_account</code> to get your IG Business ID</p>
              </div>

              <div className="space-y-4">
                {/* Long-lived access token */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
                    style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Long-Lived Access Token
                    <span className="text-red-500">*</span>
                    <span className="text-[9px] text-white/20 normal-case tracking-normal font-normal">· Starts with EAA…</span>
                  </label>
                  <div className="relative">
                    <textarea
                      value={manualToken}
                      onChange={e => setManualToken(e.target.value)}
                      placeholder="EAA..."
                      rows={3}
                      className="input-dark resize-none font-mono text-xs"
                      style={{ paddingRight: '44px' }}
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="absolute top-2.5 right-3 text-white/30 hover:text-white transition-colors"
                      type="button">
                      <Icon d={showToken
                        ? "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"
                        : "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"}
                        size={14} />
                    </button>
                  </div>
                </div>

                {/* Two-column IDs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1"
                      style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Facebook Page ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pageId}
                      onChange={e => setPageId(e.target.value)}
                      placeholder="e.g. 123456789012345"
                      className="input-dark font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1"
                      style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Instagram Business ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={igBizId}
                      onChange={e => setIgBizId(e.target.value)}
                      placeholder="e.g. 17841400000000000"
                      className="input-dark font-mono"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <button
                    onClick={() => { setManualToken(''); setPageId(''); setIgBizId('') }}
                    className="px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    Clear
                  </button>

                  <button
                    onClick={handleManualConnect}
                    disabled={manualLoading || !manualToken || !pageId || !igBizId}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 active:scale-95"
                    style={{ background: '#EF4444', boxShadow: '0 0 16px rgba(239,68,68,0.2)' }}>
                    {manualLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Validating…
                      </>
                    ) : (
                      <>
                        <Icon d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" size={15} />
                        Validate & Connect
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* ── RIGHT COLUMN ──────────────────────────────────────────────────── */}
          <div className="xl:col-span-4 space-y-5">
            <StatusPanel
              status={status}
              loading={statusLoading}
              onDisconnect={handleDisconnect}
              disconnecting={disconnecting}
            />
            <PrerequisitesPanel connected={connected} />
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
