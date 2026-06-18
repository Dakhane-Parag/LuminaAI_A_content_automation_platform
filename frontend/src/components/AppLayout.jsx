import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ── Icons (SVG, no external dep) ─────────────────────────────────────────────
const Icon = ({ d, size = 22 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const SparklesIcon   = () => <Icon d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
const DashboardIcon  = () => <Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />
const AIIcon         = () => <Icon d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zM2 20c0-4 4-7 10-7s10 3 10 7" />
const ContentIcon    = () => <Icon d="M4 6h16M4 12h16M4 18h12" />
const CalendarIcon   = () => <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
const AnalyticsIcon  = () => <Icon d="M3 3v18h18M7 16l4-4 4 4 4-8" />
const TerminalIcon   = () => <Icon d="M4 17l6-6-6-6M12 19h8" />
const SettingsIcon   = () => <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
const LogoutIcon     = () => <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
const PlusIcon       = () => <Icon d="M12 5v14M5 12h14" />
const HelpIcon       = () => <Icon d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
const BellIcon       = () => <Icon d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />

// ── Nav items config ──────────────────────────────────────────────────────────
export const NAV_ITEMS = [
  { label: 'Dashboard',  to: '/dashboard', icon: <DashboardIcon /> },
  { label: 'AI Studio',  to: '/create',    icon: <AIIcon /> },
  { label: 'Content',    to: '/posts',     icon: <ContentIcon /> },
  { label: 'Scheduling', to: '/schedule',  icon: <CalendarIcon /> },
  { label: 'Analytics',  to: '/analytics', icon: <AnalyticsIcon /> },
  { label: 'Logs',       to: '/health',    icon: <TerminalIcon /> },
]

const BOTTOM_ITEMS = [
  { label: 'Help',     to: '/help',     icon: <HelpIcon /> },
  { label: 'Settings', to: '/settings', icon: <SettingsIcon /> },
]

// ── AppSidebar ────────────────────────────────────────────────────────────────
export function AppSidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside
      className="fixed left-0 top-0 h-full z-50 flex flex-col overflow-hidden transition-all duration-300 group"
      style={{
        width: '72px',
        background: 'rgba(5,5,5,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
      onMouseEnter={e => { e.currentTarget.style.width = '220px' }}
      onMouseLeave={e => { e.currentTarget.style.width = '72px' }}
    >
      {/* ── Brand Logo ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', minHeight: '68px' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
          style={{ background: 'linear-gradient(135deg, #EF4444, #dc2626)' }}>
          <SparklesIcon />
        </div>
        <div className="overflow-hidden whitespace-nowrap transition-opacity duration-200 opacity-0 group-hover:opacity-100">
          <p className="text-white font-bold text-sm tracking-tight">BrandFlow</p>
          <p className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>v2.4.0</p>
        </div>
      </div>

      {/* ── Main Nav ────────────────────────────────────────────────────── */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group/item overflow-hidden whitespace-nowrap ${
                isActive
                  ? 'text-white'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`
            }
            style={({ isActive }) =>
              isActive
                ? { background: 'rgba(239,68,68,0.12)', borderLeft: '2px solid #EF4444' }
                : { borderLeft: '2px solid transparent' }
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex-shrink-0" style={{ color: isActive ? '#EF4444' : 'inherit' }}>
                  {item.icon}
                </span>
                <span
                  className="text-sm font-medium transition-opacity duration-200 overflow-hidden opacity-0 group-hover:opacity-100"
                  style={{ minWidth: 0 }}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── New Post Quick Button ────────────────────────────────────────── */}
      <div className="px-2 pb-2">
        <button
          onClick={() => navigate('/create')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white overflow-hidden whitespace-nowrap transition-all duration-150 hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #EF4444, #dc2626)' }}
        >
          <span className="flex-shrink-0"><PlusIcon /></span>
          <span className="text-sm font-semibold transition-opacity duration-200 opacity-0 group-hover:opacity-100">
            New Post
          </span>
        </button>
      </div>

      {/* ── Bottom Items ─────────────────────────────────────────────────── */}
      <div className="px-2 py-2 border-t space-y-1" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {BOTTOM_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all duration-150 overflow-hidden whitespace-nowrap"
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="text-sm font-medium transition-opacity duration-200 opacity-0 group-hover:opacity-100">
              {item.label}
            </span>
          </NavLink>
        ))}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/40 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all duration-150 overflow-hidden whitespace-nowrap"
        >
          <span className="flex-shrink-0"><LogoutIcon /></span>
          <span className="text-sm font-medium transition-opacity duration-200 opacity-0 group-hover:opacity-100">
            Logout
          </span>
        </button>
      </div>

      {/* ── User Avatar ─────────────────────────────────────────────────── */}
      <div className="px-2 py-3 border-t flex items-center gap-3 overflow-hidden whitespace-nowrap" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #6B5CF6)', border: '1.5px solid rgba(239,68,68,0.3)' }}>
          {user?.full_name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="overflow-hidden transition-opacity duration-200 opacity-0 group-hover:opacity-100">
          <p className="text-white text-xs font-semibold truncate">{user?.full_name || 'User'}</p>
          <p className="text-[10px] text-[#EF4444] tracking-tight flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse inline-block" />
            System Optimal
          </p>
        </div>
      </div>
    </aside>
  )
}

// ── AppTopBar ─────────────────────────────────────────────────────────────────
export function AppTopBar({ title = 'Dashboard', children }) {
  const { user } = useAuth()

  return (
    <header
      className="sticky top-0 z-40 flex justify-between items-center w-full px-6 py-4 border-b"
      style={{
        background: 'rgba(5,5,5,0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderColor: 'rgba(255,255,255,0.07)',
      }}
    >
      <div className="flex items-center gap-6">
        <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
        {/* Search */}
        <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-lg border text-sm"
          style={{ background: 'rgba(17,24,39,0.5)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"
            fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="bg-transparent border-none outline-none text-white/70 placeholder:text-white/30 w-56 text-sm"
            placeholder="Search Command Center..."
          />
        </div>
        {children}
      </div>

      <div className="flex items-center gap-4">
        {/* Bell */}
        <button className="relative p-2 rounded-full text-white/50 hover:text-white hover:bg-white/5 transition-colors">
          <BellIcon />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444]" />
        </button>
        {/* Settings */}
        <button className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/5 transition-colors">
          <SettingsIcon />
        </button>
        {/* Divider */}
        <div className="h-8 w-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-white text-sm font-medium">{user?.full_name || 'User'}</p>
            <p className="text-[10px] text-[#EF4444] tracking-tight">System Optimal</p>
          </div>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6B5CF6)', border: '1.5px solid rgba(239,68,68,0.3)' }}>
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  )
}

// ── AppLayout (wrapper used by every dashboard page) ──────────────────────────
export default function AppLayout({ children, title }) {
  return (
    <div className="min-h-screen bg-[#050505] flex">
      <AppSidebar />
      {/* Push content right by sidebar collapsed width */}
      <div className="flex-1 flex flex-col" style={{ marginLeft: '72px' }}>
        <AppTopBar title={title} />
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
