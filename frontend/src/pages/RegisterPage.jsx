import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import bgImage from '../assets/screen.png'

// ── Small icon components (using SVG so no extra dep needed) ──────────────────
const Icon = ({ path, size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
)
const PersonIcon  = () => <Icon path="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
const MailIcon    = () => <Icon path="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm16 2l-8 5-8-5" />
const LockIcon    = () => <Icon path="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4" />
const ShieldIcon  = () => <Icon path="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
const HubIcon     = () => <Icon path="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" size={18} />

// ── Input field with leading icon ─────────────────────────────────────────────
function InputField({ id, name, type = 'text', placeholder, value, onChange, icon, label, error }) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="group">
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold tracking-[0.05em] uppercase mb-2 transition-colors"
        style={{ color: focused ? '#EF4444' : 'rgba(255,255,255,0.4)' }}
      >
        {label}
      </label>
      <div
        className="relative"
        style={{ filter: focused ? 'drop-shadow(0 0 8px rgba(239,68,68,0.1))' : 'none' }}
      >
        <span
          className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: focused ? '#EF4444' : 'rgba(255,255,255,0.3)' }}
        >
          {icon}
        </span>
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full pl-12 pr-4 py-4 bg-[#111827] border rounded-lg text-white placeholder:text-white/20 outline-none transition-all text-sm"
          style={{
            borderColor: focused ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)',
            boxShadow: focused ? '0 0 0 2px rgba(239,68,68,0.2)' : 'none',
          }}
        />
      </div>
      {error && <p className="mt-1 text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    terms: false,
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
    setApiError('')
  }

  const validate = () => {
    const errs = {}
    if (!form.full_name.trim()) errs.full_name = 'Full name is required.'
    if (!form.email.trim()) errs.email = 'Email is required.'
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(form.password)) errs.password = 'Password must contain an uppercase letter.'
    if (!/[0-9]/.test(form.password)) errs.password = 'Password must contain a digit.'
    if (form.password !== form.confirm_password) errs.confirm_password = 'Passwords do not match.'
    if (!form.terms) errs.terms = 'You must accept the Terms of Service.'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    setApiError('')
    try {
      await register({
        name: form.full_name,
        email: form.email,
        password: form.password,
      })
      navigate('/login', { state: { registered: true } })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Registration failed. Please try again.'
      setApiError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col md:flex-row overflow-x-hidden bg-[#050505]">

      {/* ── Left Column — Cinematic Visual (60%) ─────────────────────────── */}
      <div className="relative hidden md:flex md:w-[60%] min-h-screen overflow-hidden flex-col justify-end p-12">

        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <img
            alt="BrandFlow AI Visual"
            className="w-full h-full object-cover"
            src={bgImage}
          />
          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#050505]/20" />
        </div>

        {/* Top logo */}
        <div className="absolute top-12 left-12 z-10">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
            <div className="w-8 h-8 bg-[#EF4444] rounded flex items-center justify-center text-white">
              <HubIcon />
            </div>
            BrandFlow AI
          </div>
        </div>

        {/* Bottom content card */}
        <div className="relative z-10 max-w-xl">
          <div
            className="p-10 rounded-xl border-l-4 border-l-[#EF4444] transition-transform duration-700 hover:scale-[1.02]"
            style={{
              background: 'rgba(17,24,39,0.6)',
              backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderLeftColor: '#EF4444',
              borderLeftWidth: '4px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}
          >
            <h1 className="text-5xl font-bold tracking-tight text-white mb-4">
              Engineered for <span className="text-[#EF4444]">Performance</span>
            </h1>
            <p className="text-base text-white/60 leading-relaxed">
              Join the elite network of brand operators. Leverage our precision-tuned AI engine to scale your operations with mathematical certainty.
            </p>

            {/* Status chips */}
            <div className="mt-8 flex gap-4 flex-wrap">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/5">
                <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                <span className="text-[11px] font-semibold tracking-[0.05em] uppercase text-white">System Optimal</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/5">
                <span className="text-[#EF4444] text-sm">⚡</span>
                <span className="text-[11px] font-semibold tracking-[0.05em] uppercase text-white">Sub-ms Latency</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Column — Registration Form (40%) ────────────────────────── */}
      <div className="w-full md:w-[40%] bg-[#050505] flex items-center justify-center p-6 md:p-12 min-h-screen">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="md:hidden mb-12 flex justify-center">
            <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
              <div className="w-8 h-8 bg-[#EF4444] rounded flex items-center justify-center text-white">
                <HubIcon />
              </div>
              BrandFlow AI
            </div>
          </div>

          {/* Header */}
          <div className="text-center md:text-left mb-10">
            <h2 className="text-3xl font-semibold tracking-tight text-white mb-2">Create your account</h2>
            <p className="text-sm text-white/50">Access the next generation of brand automation.</p>
          </div>

          {/* Global API error */}
          {apiError && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <InputField
              id="full_name" name="full_name" type="text"
              label="Full Name" placeholder="John Doe"
              value={form.full_name} onChange={handleChange}
              icon={<PersonIcon />} error={errors.full_name}
            />

            {/* Email */}
            <InputField
              id="email" name="email" type="email"
              label="Corporate Email" placeholder="name@company.com"
              value={form.email} onChange={handleChange}
              icon={<MailIcon />} error={errors.email}
            />

            {/* Password */}
            <InputField
              id="password" name="password" type="password"
              label="Password" placeholder="••••••••"
              value={form.password} onChange={handleChange}
              icon={<LockIcon />} error={errors.password}
            />

            {/* Confirm Password */}
            <InputField
              id="confirm_password" name="confirm_password" type="password"
              label="Confirm Password" placeholder="••••••••"
              value={form.confirm_password} onChange={handleChange}
              icon={<ShieldIcon />} error={errors.confirm_password}
            />

            {/* Terms */}
            <div>
              <div className="flex items-start gap-3 py-2">
                <input
                  id="terms" name="terms" type="checkbox"
                  checked={form.terms} onChange={handleChange}
                  className="mt-0.5 w-5 h-5 rounded border-white/10 bg-[#111827] accent-[#EF4444]"
                />
                <label htmlFor="terms" className="text-sm text-white/50 select-none leading-relaxed">
                  I agree to the{' '}
                  <a href="#" className="text-white hover:text-[#EF4444] underline transition-colors">Terms of Service</a>{' '}
                  and{' '}
                  <a href="#" className="text-white hover:text-[#EF4444] underline transition-colors">Privacy Policy</a>.
                </label>
              </div>
              {errors.terms && <p className="text-xs text-[#EF4444] mt-1 ml-8">{errors.terms}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group w-full relative overflow-hidden bg-[#EF4444] text-white py-4 rounded-lg font-semibold text-base transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              style={{ boxShadow: '0 0 20px rgba(239,68,68,0.15)' }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </span>
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </button>

            {/* Login link */}
            <div className="text-center pt-2">
              <p className="text-sm text-white/40">
                Already have an account?{' '}
                <Link to="/login" className="text-white font-semibold hover:text-[#EF4444] transition-colors ml-1">
                  Log in
                </Link>
              </p>
            </div>
          </form>

          {/* Technical footer */}
          <div className="mt-16 pt-8 border-t border-white/5 flex justify-between items-center opacity-40">
            <span className="text-[10px] font-semibold tracking-[0.05em] uppercase text-white">AUTH_V2.0.4</span>
            <span className="text-[10px] font-semibold tracking-[0.05em] uppercase text-white">ENCRYPTED_SSL</span>
            <span className="text-[10px] font-semibold tracking-[0.05em] uppercase text-white">BUILD_ID: #FF-0912</span>
          </div>
        </div>
      </div>
    </main>
  )
}
