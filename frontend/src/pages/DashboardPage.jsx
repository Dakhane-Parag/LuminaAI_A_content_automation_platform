import { useState, useEffect, useCallback } from 'react'
import AppLayout from '../components/AppLayout'
import { analyticsApi, instagramApi } from '../api/services'

// ── SVG Icon helper ───────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, color, strokeWidth = 1.5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke={color || 'currentColor'} strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

// Icons
const TrendUpIcon    = () => <Icon d="M23 6l-9.5 9.5-5-5L1 18" color="#10B981" />
const TrendDownIcon  = () => <Icon d="M23 18l-9.5-9.5-5 5L1 6" color="#EF4444" />
const CheckIcon      = () => <Icon d="M20 6L9 17l-5-5" color="#10B981" />
const ErrorIcon      = () => <Icon d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" color="#EF4444" />
const BoltIcon       = () => <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" color="#F59E0B" />
const HistoryIcon    = () => <Icon d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" color="rgba(255,255,255,0.4)" />
const SyncIcon       = () => <Icon d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" color="rgba(255,255,255,0.4)" />
const SparkleIcon    = () => <Icon d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" color="#EF4444" />
const CalendarIcon   = () => <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" color="#c0c6db" />
const PublishIcon    = () => <Icon d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" color="#10B981" />
const WorkerIcon     = () => <Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2" color="#c0c6db" />
const InstagramIcon  = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"
    fill="none" stroke="#E1306C" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.5" cy="6.5" r="0.5" fill="#E1306C"/>
  </svg>
)

// ── Skeleton loader ───────────────────────────────────────────────────────────
const Skeleton = ({ className }) => (
  <div className={`animate-pulse rounded bg-white/5 ${className}`} />
)

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, subColor = 'rgba(255,255,255,0.4)', icon, loading, accentColor = '#EF4444' }) {
  return (
    <div
      className="p-5 rounded-xl relative overflow-hidden transition-all duration-200 hover:scale-[1.01] cursor-default"
      style={{
        background: 'rgba(17,24,39,0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
      }}
      onMouseEnter={e => { e.currentTarget.style.border = `1px solid ${accentColor}44` }}
      onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Accent glow top */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }} />

      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {label}
          </p>
          {loading
            ? <Skeleton className="h-8 w-20" />
            : <h3 className="text-3xl font-bold text-white tracking-tight">{value ?? '—'}</h3>
          }
          {!loading && sub && (
            <p className="text-[11px] mt-1.5 font-medium flex items-center gap-1" style={{ color: subColor }}>
              {sub}
            </p>
          )}
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${accentColor}15` }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

// ── Real SVG Line Chart from daily_trend data ─────────────────────────────────
function TrendChart({ data, loading }) {
  if (loading) {
    return (
      <div className="relative h-[280px] w-full">
        <Skeleton className="w-full h-full" />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="relative h-[280px] w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-sm font-medium text-white/40">No posts created yet</p>
          <p className="text-xs text-white/20 mt-1">Create your first post to see the trend</p>
        </div>
      </div>
    )
  }

  // Build SVG path from real data
  const W = 1000
  const H = 300
  const PAD = { top: 20, right: 20, bottom: 40, left: 40 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const maxCount = Math.max(...data.map(d => d.count), 1)
  const n = data.length

  const points = data.map((d, i) => ({
    x: PAD.left + (i / Math.max(n - 1, 1)) * chartW,
    y: PAD.top + chartH - (d.count / maxCount) * chartH,
    ...d,
  }))

  // Smooth bezier path
  const linePath = points.reduce((acc, pt, i) => {
    if (i === 0) return `M${pt.x},${pt.y}`
    const prev = points[i - 1]
    const cpX = (prev.x + pt.x) / 2
    return `${acc} C${cpX},${prev.y} ${cpX},${pt.y} ${pt.x},${pt.y}`
  }, '')

  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + chartH} L${points[0].x},${PAD.top + chartH} Z`

  // X-axis labels: show first, middle, last
  const labelIndices = n <= 6
    ? data.map((_, i) => i)
    : [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1]

  // Y-axis grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PAD.top + chartH - f * chartH,
    val: Math.round(f * maxCount),
  }))

  return (
    <div className="relative h-[280px] w-full">
      <svg className="w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#EF4444', stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: '#EF4444', stopOpacity: 0 }} />
          </linearGradient>
        </defs>

        {/* Y-grid lines */}
        {gridLines.map((gl, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={gl.y} x2={W - PAD.right} y2={gl.y}
              stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <text x={PAD.left - 6} y={gl.y + 4} textAnchor="end"
              fontSize="14" fill="rgba(255,255,255,0.25)" fontFamily="monospace">
              {gl.val}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Main line */}
        <path d={linePath} fill="none" stroke="#EF4444" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.5))' }} />

        {/* Data points */}
        {points.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r="4"
            fill="#EF4444" stroke="#050505" strokeWidth="2" />
        ))}

        {/* X-axis labels */}
        {labelIndices.map(i => (
          <text key={i} x={points[i].x} y={H - 8}
            textAnchor="middle" fontSize="12"
            fill="rgba(255,255,255,0.3)" fontFamily="monospace">
            {points[i].date?.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  )
}

// ── Activity Icon map ─────────────────────────────────────────────────────────
function ActivityIcon({ type }) {
  if (type === 'post_published')  return <PublishIcon />
  if (type === 'post_failed')     return <ErrorIcon />
  if (type === 'post_generated')  return <SparkleIcon />
  if (type === 'post_scheduled')  return <CalendarIcon />
  if (type === 'image_generated') return <BoltIcon />
  return <SyncIcon />
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    success:   { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Success' },
    failed:    { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  label: 'Failed' },
    published: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Published' },
    scheduled: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Scheduled' },
    draft:     { color: '#c0c6db', bg: 'rgba(192,198,219,0.1)', label: 'Draft' },
    cancelled: { color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.05)', label: 'Cancelled' },
  }
  const s = map[status] || { color: '#c0c6db', bg: 'rgba(192,198,219,0.1)', label: status }
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  )
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtMs(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [overview,    setOverview]    = useState(null)
  const [postStats,   setPostStats]   = useState(null)
  const [publishing,  setPublishing]  = useState(null)
  const [generations, setGenerations] = useState(null)
  const [workers,     setWorkers]     = useState(null)
  const [activity,    setActivity]    = useState([])
  const [igStatus,    setIgStatus]    = useState(null)

  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [activeRange, setActiveRange] = useState('30d')

  const periodDays = activeRange === '7d' ? 7 : activeRange === '90d' ? 90 : 30

  const fetchAll = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([
      analyticsApi.getOverview({ period_days: periodDays }),
      analyticsApi.getPostStats({ period_days: periodDays }),
      analyticsApi.getPublishing({ period_days: periodDays, limit: 8 }),
      analyticsApi.getGenerations({ period_days: periodDays, limit: 5 }),
      analyticsApi.getWorkers({ limit: 5 }),
      analyticsApi.getActivity({ limit: 8 }),
      instagramApi.getStatus().catch(() => ({ data: null })),
    ])
      .then(([ov, ps, pub, gen, wrk, act, ig]) => {
        setOverview(ov.data?.data ?? ov.data)
        setPostStats(ps.data?.data ?? ps.data)
        setPublishing(pub.data?.data ?? pub.data)
        setGenerations(gen.data?.data ?? gen.data)
        setWorkers(wrk.data?.data ?? wrk.data)
        setActivity(act.data?.data ?? act.data ?? [])
        setIgStatus(ig.data)
      })
      .catch(err => {
        console.error('Dashboard fetch error:', err)
        setError('Failed to load dashboard data. Please refresh.')
      })
      .finally(() => setLoading(false))
  }, [periodDays])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Derived values ──────────────────────────────────────────────────────────
  const ov = overview || {}
  const totalPosts       = ov.total_posts ?? '—'
  const publishedPosts   = ov.published_posts ?? '—'
  const scheduledPosts   = ov.scheduled_posts ?? '—'
  const failedPosts      = ov.failed_posts ?? '—'
  const aiGenerations    = ov.total_ai_generations ?? '—'
  const successRate      = ov.publishing_success_rate != null ? `${ov.publishing_success_rate}%` : '—'
  const igConnected      = ov.instagram_connected ?? igStatus?.connected ?? false

  const dailyTrend       = postStats?.daily_trend ?? []

  const pubHistory       = publishing?.recent_history ?? []
  const pubSuccessRate   = publishing?.success_rate != null ? `${publishing.success_rate}%` : '—'
  const pubAvgTime       = publishing?.avg_execution_time_ms

  const genSuccessRate   = generations?.success_rate != null ? `${generations.success_rate}%` : '—'
  const genAvgTime       = generations?.avg_duration_ms
  const genModel         = generations?.most_used_model ?? '—'
  const totalGen         = generations?.total_generations ?? '—'

  const wrkTotal         = workers?.total_tasks_executed ?? '—'
  const wrkSuccessRate   = workers?.success_rate != null ? `${workers.success_rate}%` : '—'
  const wrkAvgTime       = workers?.avg_execution_time_ms

  // Panel style helper
  const panel = {
    background: 'rgba(17,24,39,0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.07)',
  }

  return (
    <AppLayout title="System Overview">
      <div className="space-y-6 max-w-[1600px] mx-auto">

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        {error && (
          <div className="px-4 py-3 rounded-lg text-sm flex items-center gap-2"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>
            <ErrorIcon />
            {error}
            <button onClick={fetchAll} className="ml-auto text-xs underline hover:no-underline">Retry</button>
          </div>
        )}

        {/* ── Period selector ──────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <div className="flex rounded-lg overflow-hidden" style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {['7d', '30d', '90d'].map(r => (
              <button key={r} onClick={() => setActiveRange(r)}
                className="px-4 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: activeRange === r ? '#EF4444' : 'transparent',
                  color: activeRange === r ? '#fff' : 'rgba(255,255,255,0.4)',
                }}>
                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Metric Cards Row ─────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            label="Total Posts"
            value={loading ? '…' : String(totalPosts)}
            sub={<><SparkleIcon /> All time</>}
            icon={<Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" color="#EF4444" size={18} />}
            loading={loading}
            accentColor="#EF4444"
          />
          <StatCard
            label="Published"
            value={loading ? '…' : String(publishedPosts)}
            sub={<><CheckIcon /> Live on IG</>}
            subColor="#10B981"
            icon={<PublishIcon />}
            loading={loading}
            accentColor="#10B981"
          />
          <StatCard
            label="Scheduled"
            value={loading ? '…' : String(scheduledPosts)}
            sub={<><CalendarIcon /> Upcoming</>}
            subColor="#F59E0B"
            icon={<CalendarIcon />}
            loading={loading}
            accentColor="#F59E0B"
          />
          <StatCard
            label="Failed"
            value={loading ? '…' : String(failedPosts)}
            sub={failedPosts > 0 ? <><TrendDownIcon /> Needs review</> : 'All good'}
            subColor={failedPosts > 0 ? '#EF4444' : '#10B981'}
            icon={<ErrorIcon />}
            loading={loading}
            accentColor={failedPosts > 0 ? '#EF4444' : '#10B981'}
          />
          <StatCard
            label="AI Generations"
            value={loading ? '…' : String(aiGenerations)}
            sub={<><BoltIcon /> Gemini powered</>}
            subColor="#F59E0B"
            icon={<SparkleIcon />}
            loading={loading}
            accentColor="#EF4444"
          />
          <StatCard
            label="Publish Rate"
            value={loading ? '…' : successRate}
            sub={successRate !== '—' && parseFloat(successRate) >= 80 ? <><TrendUpIcon /> Peak perf.</> : 'No publishes yet'}
            subColor={parseFloat(successRate) >= 80 ? '#10B981' : 'rgba(255,255,255,0.4)'}
            icon={<WorkerIcon />}
            loading={loading}
            accentColor="#10B981"
          />
        </section>

        {/* ── Main Bento Grid ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-5">

          {/* ── 30-Day Trend Chart (left 8 cols) ─────────────────────────── */}
          <div className="col-span-12 lg:col-span-8 rounded-xl p-6"
            style={panel}>
            <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
              <div>
                <h4 className="text-base font-semibold text-white">Post Creation Trend</h4>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Daily posts created over the last {periodDays} days
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded bg-[#EF4444] inline-block" /> Posts created
                </span>
              </div>
            </div>
            <TrendChart data={dailyTrend} loading={loading} />
          </div>

          {/* ── Right column (4 cols) ─────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-4 space-y-5">

            {/* Instagram + Worker Status */}
            <div className="rounded-xl p-5" style={panel}>
              <h4 className="text-[11px] font-semibold uppercase tracking-widest mb-4 pb-3 border-b"
                style={{ color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.06)' }}>
                System Status
              </h4>
              <div className="space-y-3">
                {/* Instagram */}
                <div className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(225,48,108,0.1)' }}>
                      <InstagramIcon />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Instagram</p>
                      <p className="text-[11px] flex items-center gap-1.5"
                        style={{ color: igConnected ? '#10B981' : '#EF4444' }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
                          style={{ background: igConnected ? '#10B981' : '#EF4444' }} />
                        {loading ? 'Checking…' : igConnected ? 'Connected' : 'Not Connected'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={fetchAll}
                    className="p-1.5 rounded-full transition-colors text-white/40 hover:text-white hover:bg-white/5"
                    title="Refresh status">
                    <SyncIcon />
                  </button>
                </div>

                {/* Celery Worker */}
                <div className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(239,68,68,0.08)' }}>
                      <WorkerIcon />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Automation Worker</p>
                      <p className="text-[11px] flex items-center gap-1.5"
                        style={{ color: '#10B981' }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block bg-[#10B981]" />
                        {loading ? '…' : `${wrkTotal} tasks · ${wrkSuccessRate} success`}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {loading ? '…' : fmtMs(wrkAvgTime)} avg
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="rounded-xl p-5 flex flex-col" style={{ ...panel, minHeight: '320px' }}>
              <h4 className="text-[11px] font-semibold uppercase tracking-widest mb-4 pb-3 border-b flex-shrink-0"
                style={{ color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.06)' }}>
                Recent Activity
              </h4>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <Skeleton className="w-4 h-4 mt-0.5 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2.5 w-full" />
                      </div>
                    </div>
                  ))
                ) : activity.length > 0 ? (
                  activity.map((item, i) => (
                    <div key={item.id || i} className="flex gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        <ActivityIcon type={item.event_type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-sm font-medium text-white truncate">
                            {item.title || item.event_type}
                          </p>
                          <span className="text-[10px] flex-shrink-0 font-mono"
                            style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {timeAgo(item.created_at)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-[11px] mt-0.5 leading-relaxed"
                            style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <HistoryIcon />
                    <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>No activity yet</p>
                    <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      Actions will appear here as you use the platform
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-5">

          {/* Publishing History Table (7 cols) */}
          <div className="col-span-12 lg:col-span-7 rounded-xl p-6" style={panel}>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h4 className="text-base font-semibold text-white">Publishing History</h4>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Recent Instagram publish attempts · Success rate: {loading ? '…' : pubSuccessRate}
                </p>
              </div>
            </div>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : pubHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Post ID', 'Platform', 'Status', 'Published At', 'Duration'].map(h => (
                        <th key={h} className="text-left pb-3 pr-4 text-[10px] font-semibold uppercase tracking-widest"
                          style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pubHistory.map((row, i) => (
                      <tr key={row.id || i}
                        className="transition-colors"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td className="py-3 pr-4 font-mono text-[11px]"
                          style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {row.post_id?.slice(-8) || '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="flex items-center gap-1.5">
                            <InstagramIcon />
                            <span className="text-xs text-white/60 capitalize">{row.platform || 'instagram'}</span>
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="py-3 pr-4 text-[11px] font-mono"
                          style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {fmtDate(row.published_at || row.created_at)}
                        </td>
                        <td className="py-3 text-[11px] font-mono"
                          style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {fmtMs(row.execution_time_ms)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-4xl mb-3">📤</div>
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>No publishes yet</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Connect Instagram and schedule a post to see history here
                </p>
              </div>
            )}
          </div>

          {/* AI Generation Stats (5 cols) */}
          <div className="col-span-12 lg:col-span-5 rounded-xl p-6" style={panel}>
            <h4 className="text-base font-semibold text-white mb-1">AI Generation Stats</h4>
            <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Gemini AI content generation metrics
            </p>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Total Generations */}
                <div className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-2">
                    <SparkleIcon />
                    <span className="text-sm text-white/70">Total Generations</span>
                  </div>
                  <span className="text-lg font-bold text-white">{totalGen}</span>
                </div>

                {/* Success Rate */}
                <div className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-2">
                    <CheckIcon />
                    <span className="text-sm text-white/70">Success Rate</span>
                  </div>
                  <span className="text-lg font-bold"
                    style={{ color: parseFloat(genSuccessRate) >= 80 ? '#10B981' : '#EF4444' }}>
                    {genSuccessRate}
                  </span>
                </div>

                {/* Avg Duration */}
                <div className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-2">
                    <WorkerIcon />
                    <span className="text-sm text-white/70">Avg. Duration</span>
                  </div>
                  <span className="text-lg font-bold text-white">{fmtMs(genAvgTime)}</span>
                </div>

                {/* Active Model */}
                <div className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <div className="flex items-center gap-2">
                    <BoltIcon />
                    <span className="text-sm text-white/70">Active Model</span>
                  </div>
                  <span className="text-sm font-semibold text-[#EF4444] font-mono">
                    {genModel !== '—' ? genModel : 'gemini-2.5-flash'}
                  </span>
                </div>

                {/* Worker stats */}
                <div className="mt-2 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Celery Worker
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded text-center"
                      style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-base font-bold text-white">{wrkTotal}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Total Tasks</p>
                    </div>
                    <div className="p-2 rounded text-center"
                      style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-base font-bold"
                        style={{ color: parseFloat(wrkSuccessRate) >= 80 ? '#10B981' : '#EF4444' }}>
                        {wrkSuccessRate}
                      </p>
                      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Success Rate</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-center pt-2 pb-1 opacity-30">
          <span className="text-[10px] font-semibold tracking-[0.05em] uppercase text-white">
            DASHBOARD_v2.1.0
          </span>
          <span className="text-[10px] font-semibold tracking-[0.05em] uppercase text-white">
            PERIOD: LAST {periodDays} DAYS
          </span>
          <span className="text-[10px] font-semibold tracking-[0.05em] uppercase text-white">
            BUILD_ID: #BF-0618
          </span>
        </div>

      </div>
    </AppLayout>
  )
}
