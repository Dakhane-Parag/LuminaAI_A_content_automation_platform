/**
 * BrandFlow AI — Scheduling & Queue Page
 * Route: /schedule
 *
 * APIs used:
 *   GET    /api/v1/schedule/my-schedules          → load all schedules (scheduleApi.getScheduled)
 *   POST   /api/v1/schedule/schedule-post/:id     → schedule a post (scheduleApi.schedulePost)
 *   DELETE /api/v1/schedule/cancel/:schedule_id   → cancel a schedule (scheduleApi.cancelSchedule)
 *   GET    /api/v1/posts?status=draft&status=ready → load posts available to schedule (postsApi.getAll)
 *
 * Schedule document shape from DB:
 *   { _id, user_id, post_id, scheduled_time, status, celery_task_id, created_at, executed_at, error_message }
 *
 * Status values: pending | executed | failed | cancelled
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import AppLayout from '../components/AppLayout'
import { scheduleApi, postsApi } from '../api/services'

// ─── Icon helper ──────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, color, strokeWidth = 1.5, fill = 'none' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill={fill} stroke={color || 'currentColor'} strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
  <div className={`rounded animate-pulse ${className}`}
    style={{ background: 'linear-gradient(90deg,#1c1b1b 25%,#2a2a2a 50%,#1c1b1b 75%)', backgroundSize: '200% 100%' }} />
)

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onClose }) {
  const colors = { success: '#10B981', error: '#EF4444', info: '#F59E0B' }
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-2xl"
      style={{ background: '#111827', border: `1px solid ${colors[type]}44`, color: colors[type] }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[type] }} />
      {message}
      <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 text-white">✕</button>
    </div>
  )
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  label: 'Pending',   dot: true  },
  executed:  { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  label: 'Executed',  dot: false },
  failed:    { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   label: 'Failed',    dot: false },
  cancelled: { color: '#6B7280', bg: 'rgba(107,114,128,0.1)',  label: 'Cancelled', dot: false },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtTimeAgo(iso) {
  if (!iso) return ''
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}
function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function firstDayOfMonth(year, month) { return new Date(year, month, 1).getDay() }
function toLocalDatetimeInput(date) {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.dot && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cfg.color }} />}
      {cfg.label}
    </span>
  )
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function Calendar({ schedules, selectedDate, onSelectDate, year, month, onMonthChange }) {
  const totalDays = daysInMonth(year, month)
  const firstDay  = firstDayOfMonth(year, month)

  // Build a set of days that have scheduled posts this month
  const scheduledDays = useMemo(() => {
    const s = new Set()
    schedules.forEach(sc => {
      const d = new Date(sc.scheduled_time)
      if (d.getFullYear() === year && d.getMonth() === month) {
        s.add(d.getDate())
      }
    })
    return s
  }, [schedules, year, month])

  const today = new Date()
  const cells = []

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  const selDate = selectedDate ? new Date(selectedDate) : null
  const isSelected = (d) => selDate && selDate.getFullYear() === year && selDate.getMonth() === month && selDate.getDate() === d
  const isToday = (d) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => onMonthChange(-1)}
            className="p-1.5 rounded hover:bg-white/5 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <Icon d="M15 18l-6-6 6-6" size={14} color="rgba(255,255,255,0.5)" />
          </button>
          <h3 className="text-sm font-bold text-white">{MONTHS[month]} {year}</h3>
          <button onClick={() => onMonthChange(1)}
            className="p-1.5 rounded hover:bg-white/5 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <Icon d="M9 18l6-6-6-6" size={14} color="rgba(255,255,255,0.5)" />
          </button>
        </div>
        <button onClick={() => { onMonthChange(0) }}
          className="text-[10px] font-semibold px-2 py-1 rounded"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
          Today
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-widest py-1"
            style={{ color: 'rgba(255,255,255,0.25)' }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {cells.map((day, i) => (
          <div key={i}
            onClick={() => day && onSelectDate(new Date(year, month, day))}
            className={`min-h-[80px] p-2 relative cursor-pointer transition-colors ${day ? 'hover:bg-white/[0.03]' : ''}`}
            style={{
              background: day
                ? isSelected(day)
                  ? 'rgba(239,68,68,0.08)'
                  : 'rgba(17,24,39,0.6)'
                : 'rgba(10,13,20,0.4)',
              border: isSelected(day) ? '1px solid rgba(239,68,68,0.4)' : '1px solid transparent',
            }}>
            {day && (
              <>
                <span className={`text-xs font-mono block mb-1 ${isToday(day) ? 'text-[#EF4444] font-bold' : isSelected(day) ? 'text-white font-bold' : 'text-white/40'}`}>
                  {day}
                </span>
                {isToday(day) && (
                  <span className="absolute top-2 right-2 w-1 h-1 rounded-full bg-[#EF4444]" />
                )}
                {scheduledDays.has(day) && (
                  <div className="mt-1">
                    <div className="h-1.5 rounded-sm"
                      style={{ background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(239,68,68,0.6)' }} />
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Schedule Item Row ────────────────────────────────────────────────────────
function ScheduleRow({ item, onCancel, cancelling }) {
  const isPending = item.status === 'pending'
  const postId = item.post_id?.slice(-8) || '—'
  const schedId = (item._id || item.schedule_id || '')?.slice(-8) || '—'

  return (
    <div className="flex items-start gap-4 p-4 rounded-xl group transition-all"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>

      {/* Timeline dot */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_CFG[item.status]?.color || '#EF4444' }} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-mono text-white/40">POST_{postId}</span>
          <StatusBadge status={item.status} />
          {item.error_message && (
            <span className="text-[10px] text-red-400 truncate max-w-[200px]" title={item.error_message}>
              ⚠ {item.error_message.slice(0, 40)}…
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" size={12} color="#EF4444" />
            <span className="text-xs text-white/60">{fmtDateTime(item.scheduled_time)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2" size={12} color="rgba(255,255,255,0.3)" />
            <span className="text-[10px] text-white/30 font-mono">Celery · {item.celery_task_id?.slice(-8) || 'N/A'}</span>
          </div>
          <span className="text-[10px] text-white/25">{fmtTimeAgo(item.created_at)}</span>
        </div>

        {item.status === 'executed' && item.executed_at && (
          <div className="mt-1 text-[10px] text-green-400">
            ✓ Published {fmtTimeAgo(item.executed_at)}
          </div>
        )}
      </div>

      {/* Cancel action */}
      {isPending && (
        <button
          onClick={() => onCancel(item._id || item.schedule_id)}
          disabled={cancelling === (item._id || item.schedule_id)}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
          {cancelling === (item._id || item.schedule_id) ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border border-red-400/40 border-t-red-400 rounded-full animate-spin" />
              Cancelling…
            </span>
          ) : 'Cancel'}
        </button>
      )}
    </div>
  )
}

// ─── Schedule Post Modal ──────────────────────────────────────────────────────
function ScheduleModal({ posts, loading, onClose, onSchedule, scheduling }) {
  const [selectedPostId, setSelectedPostId] = useState('')
  const [scheduledTime, setScheduledTime]   = useState(() => {
    const d = new Date()
    d.setHours(d.getHours() + 1, 0, 0, 0)
    return toLocalDatetimeInput(d)
  })
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!selectedPostId) { setError('Please select a post to schedule.'); return }
    if (!scheduledTime) { setError('Please select a scheduled date & time.'); return }
    const utc = new Date(scheduledTime).toISOString()
    if (new Date(utc) <= new Date()) { setError('Scheduled time must be in the future.'); return }
    setError('')
    await onSchedule(selectedPostId, utc)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}>

        {/* Header */}
        <div className="px-6 py-5 border-b flex justify-between items-center"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div>
            <h3 className="text-base font-bold text-white">Schedule a Post</h3>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Pick a post and set its publish time
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <Icon d="M18 6 6 18M6 6l12 12" size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Post selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40 block">
              Select Post (Draft / Ready)
            </label>
            {loading ? (
              <Skeleton className="h-10 w-full" />
            ) : posts.length === 0 ? (
              <div className="text-xs text-white/40 p-3 rounded border" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                No draft or ready posts found. Create a post first in AI Studio.
              </div>
            ) : (
              <select
                value={selectedPostId}
                onChange={e => setSelectedPostId(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-colors appearance-none"
                style={{ background: '#050505', border: `1px solid ${selectedPostId ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}` }}>
                <option value="">— Choose a post —</option>
                {posts.map(p => (
                  <option key={p.id || p._id} value={p.id || p._id}>
                    [{p.status?.toUpperCase()}] {p.caption?.slice(0, 60)}…
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Datetime picker */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40 block">
              Scheduled Date & Time (Local)
            </label>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={e => setScheduledTime(e.target.value)}
              min={toLocalDatetimeInput(new Date())}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
              style={{ background: '#050505', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark' }}
              onFocus={e => e.target.style.borderColor = 'rgba(239,68,68,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
            <p className="text-[10px] text-white/25">Time will be converted to UTC for Celery scheduling</p>
          </div>

          {error && (
            <div className="text-xs text-red-400 px-3 py-2 rounded" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white/50 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={scheduling || !selectedPostId}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            style={{ background: '#EF4444', boxShadow: scheduling ? 'none' : '0 0 20px rgba(239,68,68,0.2)' }}>
            {scheduling ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scheduling…
              </>
            ) : (
              <>
                <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" size={14} />
                Schedule Post
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Queue Timeline Bar ───────────────────────────────────────────────────────
function QueueTimeline({ schedules }) {
  const pending = schedules.filter(s => s.status === 'pending')

  if (pending.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-white/25">No pending tasks in queue</p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 h-full px-2 overflow-x-auto">
      {pending.map((s, i) => (
        <div key={s._id || i}
          className="flex-shrink-0 h-10 flex items-center gap-2 px-3 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', minWidth: '140px' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-red-400 truncate uppercase">POST_{(s.post_id || '').slice(-6)}</p>
            <p className="text-[9px] text-white/40 font-mono">
              {new Date(s.scheduled_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SchedulingPage() {
  const [schedules,     setSchedules]     = useState([])
  const [availPosts,    setAvailPosts]    = useState([])
  const [loading,       setLoading]       = useState(true)
  const [loadingPosts,  setLoadingPosts]  = useState(false)
  const [cancelling,    setCancelling]    = useState(null)   // schedule_id being cancelled
  const [scheduling,    setScheduling]    = useState(false)
  const [showModal,     setShowModal]     = useState(false)
  const [toast,         setToast]         = useState(null)
  const [filterStatus,  setFilterStatus]  = useState('all')
  const [selectedDate,  setSelectedDate]  = useState(null)

  // Calendar state
  const now = new Date()
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  const showToast = (msg, type = 'success') => setToast({ message: msg, type })

  // ── Load schedules ──────────────────────────────────────────────────────────
  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await scheduleApi.getScheduled({ skip: 0, limit: 50 })
      const data = res.data?.data ?? res.data ?? []
      setSchedules(Array.isArray(data) ? data : [])
    } catch {
      showToast('Failed to load schedules.', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  // ── Load posts available for scheduling (open modal) ───────────────────────
  const openModal = async () => {
    setShowModal(true)
    setLoadingPosts(true)
    try {
      const [draftsRes, readyRes] = await Promise.all([
        postsApi.getAll({ status: 'draft', limit: 50 }),
        postsApi.getAll({ status: 'ready', limit: 50 }),
      ])
      const drafts = draftsRes.data?.data ?? draftsRes.data ?? []
      const ready  = readyRes.data?.data  ?? readyRes.data  ?? []
      setAvailPosts([...ready, ...drafts])
    } catch {
      setAvailPosts([])
    } finally {
      setLoadingPosts(false)
    }
  }

  // ── Schedule a post ─────────────────────────────────────────────────────────
  const handleSchedule = async (postId, scheduledTimeISO) => {
    setScheduling(true)
    try {
      await scheduleApi.schedulePost(postId, { scheduled_time: scheduledTimeISO })
      showToast('Post scheduled successfully!')
      setShowModal(false)
      await fetchSchedules()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to schedule post.'
      showToast(msg, 'error')
    } finally {
      setScheduling(false)
    }
  }

  // ── Cancel a schedule ───────────────────────────────────────────────────────
  const handleCancel = useCallback(async (scheduleId) => {
    setCancelling(scheduleId)
    try {
      await scheduleApi.cancelSchedule(scheduleId)
      showToast('Schedule cancelled.')
      setSchedules(prev => prev.map(s =>
        (s._id || s.schedule_id) === scheduleId ? { ...s, status: 'cancelled' } : s
      ))
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to cancel schedule.'
      showToast(msg, 'error')
    } finally {
      setCancelling(null)
    }
  }, [])

  // ── Month navigation ────────────────────────────────────────────────────────
  const handleMonthChange = (dir) => {
    if (dir === 0) {
      setCalYear(now.getFullYear())
      setCalMonth(now.getMonth())
      return
    }
    setCalMonth(prev => {
      let m = prev + dir
      if (m < 0) { setCalYear(y => y - 1); return 11 }
      if (m > 11) { setCalYear(y => y + 1); return 0 }
      return m
    })
  }

  // ── Filter + date filter ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let s = schedules
    if (filterStatus !== 'all') s = s.filter(x => x.status === filterStatus)
    if (selectedDate) {
      const sd = new Date(selectedDate)
      s = s.filter(x => {
        const d = new Date(x.scheduled_time)
        return d.getFullYear() === sd.getFullYear() && d.getMonth() === sd.getMonth() && d.getDate() === sd.getDate()
      })
    }
    return s
  }, [schedules, filterStatus, selectedDate])

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     schedules.length,
    pending:   schedules.filter(s => s.status === 'pending').length,
    executed:  schedules.filter(s => s.status === 'executed').length,
    failed:    schedules.filter(s => s.status === 'failed').length,
    cancelled: schedules.filter(s => s.status === 'cancelled').length,
  }), [schedules])

  const panel = {
    background: 'rgba(17,24,39,0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.07)',
  }

  return (
    <AppLayout title="Scheduling">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {showModal && (
        <ScheduleModal
          posts={availPosts}
          loading={loadingPosts}
          onClose={() => setShowModal(false)}
          onSchedule={handleSchedule}
          scheduling={scheduling}
        />
      )}

      <div className="space-y-6 max-w-[1600px] mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white">Automation Queue</h1>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Manage and monitor all scheduled Instagram posts
            </p>
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98]"
            style={{ background: '#EF4444', boxShadow: '0 0 20px rgba(239,68,68,0.2)' }}>
            <Icon d="M12 5v14M5 12h14" size={16} />
            Schedule Post
          </button>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total, color: '#fff' },
            { label: 'Pending', value: stats.pending, color: '#F59E0B' },
            { label: 'Executed', value: stats.executed, color: '#10B981' },
            { label: 'Failed', value: stats.failed, color: '#EF4444' },
            { label: 'Cancelled', value: stats.cancelled, color: '#6B7280' },
          ].map(s => (
            <div key={s.label} className="p-4 rounded-xl"
              style={{ ...panel, cursor: 'pointer' }}
              onClick={() => setFilterStatus(s.label.toLowerCase() === 'total' ? 'all' : s.label.toLowerCase())}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</p>
              {loading
                ? <Skeleton className="h-8 w-12" />
                : <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              }
            </div>
          ))}
        </div>

        {/* ── Main grid ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-5">

          {/* Calendar (left 4 cols) */}
          <div className="col-span-12 lg:col-span-4 rounded-xl p-5" style={panel}>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-4 pb-3 border-b text-white/40"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              Calendar View
            </h3>
            <Calendar
              schedules={schedules}
              selectedDate={selectedDate}
              onSelectDate={(d) => setSelectedDate(prev => {
                const same = prev && prev.toDateString() === d.toDateString()
                return same ? null : d
              })}
              year={calYear}
              month={calMonth}
              onMonthChange={handleMonthChange}
            />
            {selectedDate && (
              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/50">Showing: <span className="text-white font-semibold">{fmtDate(selectedDate)}</span></p>
                  <button onClick={() => setSelectedDate(null)} className="text-[10px] text-red-400 hover:underline">Clear</button>
                </div>
              </div>
            )}
          </div>

          {/* Schedule list (right 8 cols) */}
          <div className="col-span-12 lg:col-span-8 rounded-xl p-5" style={panel}>
            {/* List header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b flex-wrap gap-3"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                {selectedDate ? `Schedules — ${fmtDate(selectedDate)}` : 'All Schedules'}
              </h3>

              {/* Filter tabs */}
              <div className="flex rounded-lg overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {['all', 'pending', 'executed', 'failed', 'cancelled'].map(f => (
                  <button key={f} onClick={() => setFilterStatus(f)}
                    className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all"
                    style={{
                      background: filterStatus === f ? '#EF4444' : 'transparent',
                      color: filterStatus === f ? '#fff' : 'rgba(255,255,255,0.4)',
                    }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(239,68,68,0.2) transparent' }}>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
              ) : filtered.length > 0 ? (
                filtered.map(item => (
                  <ScheduleRow
                    key={item._id || item.schedule_id || Math.random()}
                    item={item}
                    onCancel={handleCancel}
                    cancelling={cancelling}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="text-4xl mb-3">📅</div>
                  <p className="text-sm font-medium text-white/40">
                    {filterStatus === 'all' && !selectedDate ? 'No schedules yet' : 'No matches'}
                  </p>
                  <p className="text-xs mt-1 text-white/25">
                    {filterStatus === 'all' && !selectedDate
                      ? 'Click "Schedule Post" to automate your first Instagram post'
                      : 'Try changing the filter or selecting a different date'}
                  </p>
                  {filterStatus === 'all' && !selectedDate && (
                    <button onClick={openModal}
                      className="mt-4 px-4 py-2 rounded-lg text-xs font-bold text-white"
                      style={{ background: '#EF4444' }}>
                      + Schedule a Post
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Queue Timeline ───────────────────────────────────────────────── */}
        <div className="rounded-xl p-4" style={{ ...panel, height: '100px' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon d="M3 6h18M3 12h18M3 18h18" size={14} color="#EF4444" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                Automation Queue · {stats.pending} Pending
              </span>
            </div>
            <div className="flex items-center gap-4 text-[9px] font-semibold uppercase tracking-widest text-white/25">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Publish
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Executed
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Pending
              </span>
            </div>
          </div>
          <QueueTimeline schedules={schedules} />
        </div>

      </div>
    </AppLayout>
  )
}
