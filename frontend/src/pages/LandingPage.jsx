import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import heroBg from '../assets/hero.png'

// ── Reusable SVG Icons ────────────────────────────────────────────────────────
const LightbulbIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9" y1="18" x2="15" y2="18" /><line x1="10" y1="22" x2="14" y2="22" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </svg>
)
const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4M19 17v4M3 5h4M17 19h4" />
  </svg>
)
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)
const PublishIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
)
const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)
const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCountUp(target, duration = 1500, decimals = 0) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(parseFloat(start.toFixed(decimals)))
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration, decimals])
  return count
}

// ── Nav links ─────────────────────────────────────────────────────────────────
const NAV_LINKS = ['Product', 'Features', 'Studio', 'Analytics']

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: <LightbulbIcon />, title: 'Concept', desc: 'Mathematical ideation frameworks to define your brand\'s core narrative architecture.' },
  { icon: <SparklesIcon />, title: 'Generate', desc: 'Deterministic content generation based on strictly enforced brand visual guidelines.' },
  { icon: <CalendarIcon />, title: 'Schedule', desc: 'Optimized distribution algorithms that synchronize with global attention peaks.' },
  { icon: <PublishIcon />, title: 'Publish', desc: 'Instant deployment across 12+ channels with automated formatting adjustments.' },
]

// ── LandingPage Component ─────────────────────────────────────────────────────
export default function LandingPage() {
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const sentiment = useCountUp(92.4, 2000, 1)
  const conversion = useCountUp(18.2, 2000, 1)
  const reach = useCountUp(4.2, 2000, 1)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <div className="min-h-screen bg-[#050505] text-[#e5e2e1] font-sans">

      {/* ── Sticky Navbar ─────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 left-0 w-full z-50 border-b transition-all duration-300"
        style={{
          borderColor: 'rgba(91,64,62,0.5)',
          background: scrolled ? 'rgba(5,5,5,0.95)' : '#050505',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
        }}
      >
        <nav className="flex justify-between items-center h-16 px-6 md:px-16 max-w-[1280px] mx-auto w-full">
          {/* Logo */}
          <Link to="/" className="text-xl font-bold tracking-tighter text-white hover:opacity-80 transition-opacity">BrandFlow AI</Link>

          {/* Desktop nav */}


          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <Link
                to="/dashboard"
                className="text-xs uppercase font-semibold tracking-widest bg-[#EF4444] text-white px-6 py-2 transition-all active:scale-95 hover:bg-[#ff5d5a]"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-xs uppercase font-semibold tracking-wider text-white hover:underline transition-all">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-xs uppercase font-semibold tracking-widest bg-[#EF4444] text-white px-6 py-2 transition-all active:scale-95 hover:bg-[#ff5d5a]"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </nav>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t bg-[#050505] px-6 py-6 flex flex-col gap-5" style={{ borderColor: 'rgba(91,64,62,0.5)' }}>
            {NAV_LINKS.map(link => (
              <a key={link} href="#" className="text-sm uppercase tracking-wider font-medium text-[#e5e2e1] hover:text-[#EF4444] transition-colors">
                {link}
              </a>
            ))}
            <div className="flex flex-col gap-3 pt-4 border-t" style={{ borderColor: 'rgba(91,64,62,0.5)' }}>
              {user ? (
                <Link to="/dashboard" className="text-xs uppercase font-semibold tracking-widest bg-[#EF4444] text-white text-center py-3">Dashboard</Link>
              ) : (
                <>
                  <Link to="/login" className="text-xs uppercase font-semibold tracking-wider text-white text-center border border-white/10 py-2">Login</Link>
                  <Link to="/register" className="text-xs uppercase font-semibold tracking-widest bg-[#EF4444] text-white text-center py-3">Get Started</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ── Hero Section ──────────────────────────────────────────────────── */}
        <section className="relative pt-20 pb-16 px-6 md:px-16 border-b overflow-hidden" style={{ borderColor: 'rgba(91,64,62,0.5)' }}>
          {/* Background grid image */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <img
              alt="BrandFlow Hero Background"
              className="w-full h-full object-cover opacity-20 mix-blend-screen"
              src={heroBg}
            />
            {/* Overlay gradient to ensure text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/60 via-transparent to-[#050505]" />
          </div>

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-12 max-w-4xl">
              <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.1] tracking-[-0.04em] mb-8">
                BrandFlow AI. <br />
                <span className="text-[#e5e2e1]/50">Content Mastery through</span>{' '}
                <span className="text-[#EF4444]">Precision.</span>
              </h1>
              <p className="text-lg md:text-xl text-[#e5e2e1]/60 max-w-2xl mb-10 leading-relaxed">
                Engineered for high-performance SaaS environments. Eliminate creative guesswork with a technical interface designed for total brand control.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to={user ? "/dashboard" : "/register"}
                  className="inline-block bg-[#EF4444] text-white px-8 py-4 text-xs uppercase font-semibold tracking-widest text-center hover:bg-[#ff5d5a] transition-colors active:scale-95"
                >
                  {user ? "Go to Dashboard" : "Start Engineering"}
                </Link>
                <a
                  href="#features"
                  className="inline-block border border-[#e5e2e1] text-[#e5e2e1] px-8 py-4 text-xs uppercase font-semibold tracking-widest text-center hover:bg-[#e5e2e1] hover:text-[#050505] transition-all active:scale-95"
                >
                  View Protocol
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4-Column Feature Grid ──────────────────────────────────────────── */}
        <section id="features" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 border-b" style={{ borderColor: 'rgba(91,64,62,0.5)' }}>
          {FEATURES.map((feat, i) => (
            <div
              key={feat.title}
              className="p-10 flex flex-col space-y-5 transition-colors duration-200 cursor-default"
              style={{
                borderRight: i < FEATURES.length - 1 ? '1px solid rgba(91,64,62,0.5)' : 'none',
                borderBottom: 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#0e0e0e'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {feat.icon}
              <h3 className="text-xl font-semibold uppercase tracking-wide text-white">{feat.title}</h3>
              <p className="text-sm text-[#e5e2e1]/60 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </section>

        {/* ── Growth Forecasting ─────────────────────────────────────────────── */}
        <section
          className="py-20 px-6 md:px-16 border-b relative"
          style={{ borderColor: 'rgba(91,64,62,0.5)', backgroundImage: 'linear-gradient(#1f2937 1px, transparent 1px), linear-gradient(90deg, #1f2937 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        >
          <div className="absolute inset-0 bg-[#050505]/60" />
          <div className="relative max-w-7xl mx-auto flex flex-col md:flex-row gap-16 items-center">
            {/* Text */}
            <div className="md:w-1/2">
              <div className="text-xs uppercase font-bold tracking-[0.05em] text-[#EF4444] mb-4">See your success before you post.</div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">Growth Forecasting</h2>
              <p className="text-lg text-[#e5e2e1]/60 mb-8 leading-relaxed">
                Our AI predicts how your content will perform across all platforms. Get real-time insights to ensure every post reaches its maximum potential.
              </p>
              <ul className="space-y-4">
                {[['bg-[#EF4444]', 'Audience Reach Mapping'], ['border border-[#e5e2e1]', 'Engagement Peak Analysis']].map(([style, label]) => (
                  <li key={label} className="flex items-center gap-4 text-xs uppercase font-bold tracking-widest text-white">
                    <span className={`w-4 h-4 flex-shrink-0 ${style}`} />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            {/* SVG Chart */}
            <div className="md:w-1/2 w-full h-[360px] border border-[rgba(91,64,62,0.5)] bg-[#050505] p-6 md:p-8">
              <div className="w-full h-full border-l border-b border-[rgba(91,64,62,0.5)] relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="redGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#EF4444', stopOpacity: 0.2 }} />
                      <stop offset="100%" style={{ stopColor: '#EF4444', stopOpacity: 0 }} />
                    </linearGradient>
                    <linearGradient id="whiteGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#e5e2e1', stopOpacity: 0.1 }} />
                      <stop offset="100%" style={{ stopColor: '#e5e2e1', stopOpacity: 0 }} />
                    </linearGradient>
                  </defs>
                  {/* Grid */}
                  {[250, 175, 100].map(y => <line key={y} stroke="#353534" strokeWidth="1" x1="0" x2="500" y1={y} y2={y} />)}
                  {/* Secondary area */}
                  <path d="M0,280 L50,265 L100,260 L150,210 L200,225 L250,180 L300,195 L350,140 L400,155 L450,110 L500,120 L500,300 L0,300 Z" fill="url(#whiteGrad)" />
                  <polyline fill="none" points="0,280 50,265 100,260 150,210 200,225 250,180 300,195 350,140 400,155 450,110 500,120" stroke="#e5e2e1" strokeOpacity="0.3" strokeWidth="1" />
                  {/* Primary area */}
                  <path d="M0,290 L50,270 L100,280 L150,190 L200,210 L250,130 L300,150 L350,70 L400,100 L450,30 L500,50 L500,300 L0,300 Z" fill="url(#redGrad)" />
                  <polyline fill="none" points="0,290 50,270 100,280 150,190 200,210 250,130 300,150 350,70 400,100 450,30 500,50" stroke="#EF4444" strokeWidth="2.5" />
                  {/* Peak indicator */}
                  <circle cx="450" cy="30" fill="#EF4444" r="5" />
                  <circle cx="450" cy="30" fill="none" r="10" stroke="#EF4444" strokeWidth="1" opacity="0.5">
                    <animate attributeName="r" from="8" to="16" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  <text fill="#EF4444" fontSize="11" fontWeight="bold" textAnchor="middle" x="430" y="18">PEAK GROWTH</text>
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* ── Engineered for Engagement ──────────────────────────────────────── */}
        <section className="flex flex-col md:flex-row border-b" style={{ borderColor: 'rgba(91,64,62,0.5)' }}>
          <div className="md:w-1/2 border-b md:border-b-0 md:border-r bg-[#0e0e0e]" style={{ borderColor: 'rgba(91,64,62,0.5)' }}>
            <img
              alt="Technical Workspace"
              className="w-full h-[400px] md:h-[500px] object-cover grayscale contrast-125"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCoGOGBKh6HlZ6qx7V_kXlhpFcxsgtHY5q5aHyRZtisKiBlX6Avs-pztVdnHR9LGBiRTBpz_Aa5NqtrTQQs74brK0R7UCWSfLfak7xASDRglgoyjNbK8c0catC4aTvvLlQWq9SYngCE8C4vXpJo4pl1kYMnFVase192GvVB55AsB309ijV3Q6mV9N4jDkd05G2l1GHGS6LWO25OncDFIDfKllxsoIzDIXvwy6cmDBHifmHrgiayDWN12yFGsumV_p1SRY08nh2H9VI"
            />
          </div>
          <div className="md:w-1/2 p-10 md:p-16 flex flex-col justify-center space-y-8">
            <h2 className="text-4xl font-bold tracking-tight text-white">Engineered for Engagement</h2>
            <p className="text-lg text-[#e5e2e1]/60 leading-relaxed">
              Stop guessing and start growing. Our AI analyzes millions of data points to ensure every post is mathematically optimized to capture attention and drive real interaction.
            </p>
            <div className="space-y-6">
              {[
                { n: '01', title: 'Viral Velocity', desc: 'Automatically identify and ride trending topics before they peak, keeping your brand at the center of the conversation.' },
                { n: '02', title: 'Precision Targeting', desc: 'Deliver the right content to the right audience at the perfect moment, maximizing your reach and conversion potential.' },
              ].map(item => (
                <div key={item.n} className="flex items-start gap-4">
                  <span className="text-xl font-semibold text-[#EF4444] flex-shrink-0">{item.n}</span>
                  <div>
                    <div className="text-xs uppercase font-bold tracking-widest text-white mb-1">{item.title}</div>
                    <div className="text-sm text-[#e5e2e1]/60 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Metrics ───────────────────────────────────────────────────────── */}
        <section className="py-20 px-6 md:px-16 border-b" style={{ borderColor: 'rgba(91,64,62,0.5)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="mb-14">
              <h2 className="text-4xl font-bold tracking-tight text-white mb-2">Sophisticated Data, Simplified.</h2>
              <p className="text-base text-[#e5e2e1]/60">High-fidelity metrics for professional operators.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Sentiment */}
              <div className="p-8 border border-[rgba(91,64,62,0.5)] hover:border-[#e5e2e1] transition-colors">
                <div className="text-xs uppercase font-bold tracking-widest text-[#e5e2e1]/50 mb-4">Sentiment Ratio</div>
                <div className="text-6xl font-extrabold text-white mb-4">
                  {sentiment}<span className="text-2xl text-[#EF4444]">%</span>
                </div>
                <div className="w-full h-1.5 bg-[#353534] mb-4">
                  <div className="h-full bg-[#EF4444] transition-all duration-1000" style={{ width: `${sentiment}%` }} />
                </div>
                <p className="text-sm text-[#e5e2e1]/60">Positive brand resonance tracked across global clusters.</p>
              </div>
              {/* Conversion */}
              <div className="p-8 border border-[rgba(91,64,62,0.5)] hover:border-[#e5e2e1] transition-colors">
                <div className="text-xs uppercase font-bold tracking-widest text-[#e5e2e1]/50 mb-4">Conversion Delta</div>
                <div className="text-6xl font-extrabold text-white mb-4">
                  +{conversion}<span className="text-2xl text-[#EF4444]">%</span>
                </div>
                <div className="flex items-end h-14 gap-1 mb-4">
                  {[25, 50, 33, 100].map((h, i) => (
                    <div key={i} className="w-full transition-all duration-700" style={{ height: `${h}%`, background: i === 3 ? '#EF4444' : 'rgba(91,64,62,0.5)' }} />
                  ))}
                </div>
                <p className="text-sm text-[#e5e2e1]/60">Direct revenue impact calculated via attribution modeling.</p>
              </div>
              {/* Reach */}
              <div className="p-8 border border-[rgba(91,64,62,0.5)] hover:border-[#e5e2e1] transition-colors">
                <div className="text-xs uppercase font-bold tracking-widest text-[#e5e2e1]/50 mb-4">Global Reach</div>
                <div className="text-6xl font-extrabold text-white mb-4">
                  {reach}<span className="text-2xl text-[#EF4444]">M</span>
                </div>
                <div className="flex justify-between items-center py-3 border-y border-[rgba(91,64,62,0.5)] mb-4">
                  {['EU', 'US', 'APAC', 'LATAM'].map(r => (
                    <span key={r} className="text-[10px] uppercase font-bold tracking-widest text-[#e5e2e1]/60">{r}</span>
                  ))}
                </div>
                <p className="text-sm text-[#e5e2e1]/60">Verified unique impressions across major node networks.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Testimonial ───────────────────────────────────────────────────── */}
        <section>
          <div className="w-full py-20 md:py-24 px-6 md:px-16 bg-[#e5e2e1] text-[#050505] flex flex-col items-center justify-center relative overflow-hidden text-center">
            <div className="absolute top-0 right-0 p-4 border-l border-b border-[#050505]/20 text-[10px] uppercase font-bold tracking-widest">Auto-Pilot Active</div>
            <div className="max-w-4xl mx-auto">
              <blockquote className="text-xl md:text-2xl font-medium italic mb-8 leading-relaxed">
                "The transition to BrandFlow AI reduced our operational overhead by 64% while tripling our output velocity. It is no longer just a tool; it is our brand's operating system."
              </blockquote>
              <a href="https://paragfolio.in" className="flex flex-col items-center gap-3 group cursor-pointer hover:-translate-y-1 transition-all duration-300">
                <div className="w-12 h-12 bg-[#050505] rounded-full group-hover:shadow-[0_0_20px_rgba(5,5,5,0.2)] transition-shadow flex items-center justify-center text-white overflow-hidden">
                  <span className="text-xs font-bold text-white/50">PD</span>
                </div>
                <div>
                  <div className="text-xs uppercase font-bold tracking-widest group-hover:text-[#EF4444] transition-colors">Mr. Parag Dakhane</div>
                  <div className="text-xs uppercase tracking-widest opacity-60">Nobody</div>
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6 md:px-16 text-center border-t bg-[#0e0e0e]" style={{ borderColor: 'rgba(91,64,62,0.5)' }}>
          <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-12">Ready to Scale?</h2>
          <div className="flex flex-col sm:flex-row justify-center gap-5">
            <Link
              to="/register"
              className="bg-[#EF4444] text-white px-10 py-5 text-xs uppercase font-bold tracking-widest hover:bg-[#ff5d5a] transition-all active:scale-95"
            >
              Request Access
            </Link>
          </div>
          <p className="mt-8 text-xs uppercase font-bold tracking-widest text-[#e5e2e1]/40">
            Limited enterprise nodes available for Q4.
          </p>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="w-full border-t bg-[#050505]" style={{ borderColor: 'rgba(91,64,62,0.5)' }}>
        <div className="flex flex-col md:flex-row justify-between items-center py-8 px-6 md:px-16 max-w-[1280px] mx-auto gap-4">
          <div className="text-xl font-bold tracking-tighter text-white">BrandFlow AI</div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8">
            {['Privacy Policy', 'Terms of Service', 'API Status', 'Support'].map(link => (
              <a
                key={link}
                href="#"
                className="text-[10px] uppercase font-bold tracking-widest text-[#e5e2e1]/50 hover:text-[#EF4444] hover:underline transition-colors"
              >
                {link}
              </a>
            ))}
          </div>
          <div className="text-[10px] uppercase font-bold tracking-widest text-[#e5e2e1]/40">
            © 2024 BrandFlow AI. Engineered for Performance.
          </div>
        </div>
      </footer>
    </div>
  )
}
