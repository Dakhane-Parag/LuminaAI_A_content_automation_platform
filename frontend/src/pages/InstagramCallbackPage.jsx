/**
 * InstagramCallbackPage
 * ─────────────────────
 * Facebook redirects to this page after the user logs in and grants permissions.
 * URL will look like: /auth/instagram/callback?code=AQD...&state=...
 *
 * This page:
 *  1. Reads `code` (or `error`) from the URL query params
 *  2. Sends the code to the backend POST /oauth/instagram/exchange-code
 *     (which automatically fetches the token, Page ID, IG Business ID — everything)
 *  3. Posts a message to the parent (Settings) window
 *  4. Closes itself
 *
 * Note: This page has access to localStorage because it's on the same origin
 * as the main app, so the axios interceptor auto-attaches the JWT.
 */

import { useEffect, useState } from 'react'
import { instagramApi } from '../api/services'

// ── Spinner ────────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{
      width: 48, height: 48, borderRadius: '50%',
      border: '3px solid rgba(255,255,255,0.1)',
      borderTopColor: '#EF4444',
      animation: 'spin 0.8s linear infinite',
      margin: '0 auto',
    }} />
  )
}

// ── Instagram gradient logo mark ────────────────────────────────────────────────
function IGLogo() {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: 18,
      background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 24px',
      boxShadow: '0 0 40px rgba(239,68,68,0.4)',
    }}>
      <svg xmlns="http://www.w3.org/2000/svg" width={32} height={32} viewBox="0 0 24 24"
        fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      </svg>
    </div>
  )
}

// ── Status icons ─────────────────────────────────────────────────────────────
function SuccessIcon() {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%',
      background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 24px',
      animation: 'popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}>
      <svg xmlns="http://www.w3.org/2000/svg" width={32} height={32} viewBox="0 0 24 24"
        fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </div>
  )
}

function ErrorIcon() {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%',
      background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 24px',
      animation: 'popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}>
      <svg xmlns="http://www.w3.org/2000/svg" width={32} height={32} viewBox="0 0 24 24"
        fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function InstagramCallbackPage() {
  const [phase, setPhase] = useState('loading') // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('')
  const [username, setUsername] = useState('')
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    // Inject keyframe animations once
    const style = document.createElement('style')
    style.textContent = `
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes popIn {
        0%   { transform: scale(0.5); opacity: 0; }
        100% { transform: scale(1);   opacity: 1; }
      }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `
    document.head.appendChild(style)

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')
    const errorDesc = params.get('error_description')

    // ── User denied / Meta returned an error ────────────────────────────
    if (error) {
      const msg = errorDesc
        ? decodeURIComponent(errorDesc).replace(/\+/g, ' ')
        : error === 'access_denied'
          ? 'You cancelled the login. Please try again.'
          : `Facebook error: ${error}`
      setPhase('error')
      setMessage(msg)
      notifyParent({ type: 'INSTAGRAM_AUTH_ERROR', error: msg })
      return
    }

    // ── No code returned ────────────────────────────────────────────────
    if (!code) {
      const msg = 'No authorization code received from Facebook.'
      setPhase('error')
      setMessage(msg)
      notifyParent({ type: 'INSTAGRAM_AUTH_ERROR', error: msg })
      return
    }

    // ── Send code back to parent window ─────────────────────────────────
    // The parent window has the JWT token, so it must make the API call.
    notifyParent({ type: 'INSTAGRAM_AUTH_CODE', code })

  }, [])

  function notifyParent(payload) {
    try {
      if (window.opener && !window.opener.closed) {
        // Use '*' so it works across localhost ports in dev (e.g. 5173 to 5174)
        window.opener.postMessage(payload, '*')
      }
    } catch (_) {
      // opener may be from a different context — ignore
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const page = {
    minHeight: '100vh',
    background: '#050505',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    padding: 24,
  }

  const card = {
    background: 'rgba(17,24,39,0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 420,
    textAlign: 'center',
    boxShadow: '0 0 80px rgba(0,0,0,0.8)',
    backdropFilter: 'blur(20px)',
    animation: 'fadeUp 0.5s ease',
  }

  const brand = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    marginBottom: 32,
  }

  const title = {
    fontSize: 20,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 12,
  }

  const sub = {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.6,
    marginBottom: 0,
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={page}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={card}>
        <p style={brand}>BrandFlow AI</p>

        {phase === 'loading' && (
          <>
            <IGLogo />
            <Spinner />
            <h1 style={{ ...title, marginTop: 28 }}>Connecting your Instagram</h1>
            <p style={sub}>Exchanging credentials with Meta…<br />This only takes a moment.</p>

            {/* Progress dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 24 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#EF4444',
                  opacity: 0.4,
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
          </>
        )}



        {phase === 'error' && (
          <>
            <ErrorIcon />
            <h1 style={title}>Connection Failed</h1>
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, padding: '14px 18px',
              color: '#f87171', fontSize: 13, lineHeight: 1.6,
              marginBottom: 28, textAlign: 'left',
            }}>
              {message}
            </div>

            <p style={{ ...sub, marginBottom: 24 }}>
              Make sure your Instagram account is a <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Business or Creator</strong> account
              linked to a Facebook Page you manage.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => window.close()} style={{
                flex: 1, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                color: 'rgba(255,255,255,0.5)', fontSize: 13, padding: '12px',
                cursor: 'pointer',
              }}>
                Close
              </button>
              <button onClick={() => window.location.reload()} style={{
                flex: 1, background: '#EF4444',
                border: 'none', borderRadius: 10,
                color: '#fff', fontSize: 13, fontWeight: 600, padding: '12px',
                cursor: 'pointer',
              }}>
                Try Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
