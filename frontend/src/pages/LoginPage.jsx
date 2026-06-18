import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import bgImage from '../assets/screen.png'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', password: '', remember: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Invalid email or password. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Parallax mouse movement on cinematic image
  const handleMouseMove = (e) => {
    const img = document.getElementById('cinematic-img')
    if (!img) return
    const x = (e.clientX / window.innerWidth) * 10
    const y = (e.clientY / window.innerHeight) * 10
    img.style.transform = `scale(1.05) translate(${x}px, ${y}px)`
  }

  return (
    <main
      className="flex h-screen w-full overflow-hidden bg-[#050505]"
      onMouseMove={handleMouseMove}
    >
      {/* ── Left Column — Cinematic Visual (60%) ─────────────────────────── */}
      <section className="hidden lg:flex lg:w-[60%] relative h-full items-center justify-center overflow-hidden border-r border-white/5">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <img
            id="cinematic-img"
            alt="Cinematic AI Visualization"
            className="w-full h-full object-cover opacity-60 transition-transform duration-100 ease-out"
            style={{ transform: 'scale(1.05)' }}
            src={bgImage}
          />
          {/* Overlay gradients */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#050505] via-transparent to-[#3B82F6]/5" />
          <div className="absolute inset-0 bg-black/40" />
        </div>

        {/* Content overlay */}
        <div className="relative z-10 max-w-2xl px-12 space-y-6">
          {/* Status pill */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10"
            style={{
              background: 'rgba(17,24,39,0.4)',
              backdropFilter: 'blur(40px)',
              boxShadow: '0 0 25px rgba(239,68,68,0.15)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#EF4444]">
              System Operational
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold leading-tight tracking-tight text-white">
              Content Mastery <br />
              <span className="text-[#EF4444] italic">through</span> Precision
            </h1>
            <p className="text-lg text-white/60 max-w-lg">
              Access your brand's technical operating system. High-performance AI at the speed of thought.
            </p>
          </div>

          {/* Floating glass stat */}
          <div
            className="inline-flex flex-col gap-1 p-6 rounded-xl border border-white/10 mt-12"
            style={{
              background: 'rgba(17,24,39,0.4)',
              backdropFilter: 'blur(40px)',
              backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)',
            }}
          >
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-white/40">
              Active Model
            </span>
            <span className="text-lg font-semibold text-white">Gemini 2.5 Flash</span>
          </div>
        </div>

        {/* Subtle dot grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </section>

      {/* ── Right Column — Auth Form (40%) ────────────────────────────────── */}
      <section className="w-full lg:w-[40%] flex items-center justify-center p-6 md:p-12 bg-[#050505] relative">
        <div className="w-full max-w-md space-y-8">

          {/* Brand identity */}
          <div className="text-center lg:text-left">
            <div className="inline-block mb-8">
              <span className="text-xl font-extrabold tracking-tight text-white">
                BrandFlow <span className="text-[#EF4444]">AI</span>
              </span>
            </div>
            <h2 className="text-3xl font-semibold text-white tracking-tight">Welcome back</h2>
            <p className="text-sm text-white/50 mt-2">
              Please enter your credentials to access the console.
            </p>
          </div>

          {/* Form card */}
          <div
            className="p-8 rounded-xl space-y-6 border border-white/10"
            style={{
              background: 'rgba(17,24,39,0.4)',
              backdropFilter: 'blur(40px)',
              boxShadow: '0 0 25px rgba(239,68,68,0.08)',
              backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
            }}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error message */}
              {error && (
                <div className="px-4 py-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm">
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-[11px] font-semibold tracking-[0.05em] uppercase text-white/50">
                  Work Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={form.email}
                  onChange={handleChange}
                  onFocus={(e) => e.target.closest('.space-y-2').querySelector('label').classList.add('!text-[#EF4444]')}
                  onBlur={(e) => e.target.closest('.space-y-2').querySelector('label').classList.remove('!text-[#EF4444]')}
                  className="w-full bg-[#111827] border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/20 outline-none transition-all duration-300 text-sm"
                  style={{ '--focus-ring': '0 0 0 1px #EF4444, 0 0 8px rgba(239,68,68,0.3)' }}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="block text-[11px] font-semibold tracking-[0.05em] uppercase text-white/50">
                    Password
                  </label>
                  <a href="#" className="text-[11px] font-semibold tracking-[0.05em] text-[#EF4444] hover:opacity-80 transition-opacity">
                    Forgot?
                  </a>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  onFocus={(e) => e.target.closest('.space-y-2').querySelector('label').classList.add('!text-[#EF4444]')}
                  onBlur={(e) => e.target.closest('.space-y-2').querySelector('label').classList.remove('!text-[#EF4444]')}
                  className="w-full bg-[#111827] border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/20 outline-none transition-all duration-300 text-sm"
                />
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-3">
                <input
                  id="remember-me"
                  name="remember"
                  type="checkbox"
                  checked={form.remember}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-white/10 bg-[#111827] accent-[#EF4444]"
                />
                <label htmlFor="remember-me" className="text-sm text-white/50 select-none">
                  Remember this device
                </label>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full bg-[#EF4444] text-white font-semibold py-4 rounded-lg overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                style={{ boxShadow: '0 0 25px rgba(239,68,68,0.15)' }}
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In to Dashboard'
                  )}
                </span>
              </button>
            </form>

            {/* Footer links */}
            <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-white/40 text-center">
                New here?{' '}
                <Link to="/register" className="text-[#EF4444] font-bold hover:underline">
                  Create account
                </Link>
              </p>
            </div>
          </div>

          {/* Technical footer */}
          <div className="text-center text-[10px] font-semibold tracking-[0.1em] uppercase text-white/20 flex items-center justify-center gap-4">
            <span>v4.2.0-STABLE</span>
            <span className="w-1 h-1 bg-white/20 rounded-full" />
            <span>ENCRYPTED NODE</span>
          </div>
        </div>

        {/* Atmospheric glow blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'rgba(239,68,68,0.05)', filter: 'blur(120px)' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'rgba(239,68,68,0.04)', filter: 'blur(150px)' }} />
      </section>
    </main>
  )
}
