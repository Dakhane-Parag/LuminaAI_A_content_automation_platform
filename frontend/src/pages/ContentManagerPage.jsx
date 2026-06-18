/**
 * BrandFlow AI — Content Manager Page (Horizontal Row Layout)
 * Route: /posts
 *
 * Layout: Each status is a horizontal row. Cards scroll sideways.
 * "View More" button appears when posts > CARDS_PER_ROW.
 *
 * APIs:
 *   GET  /api/v1/posts?status=draft|scheduled|published|failed  → fill rows
 *   PUT  /api/v1/posts/:id               → edit caption + hashtags
 *   DELETE /api/v1/posts/:id             → remove card
 *   POST /api/v1/images/generate-image/:id → generate AI image
 *   POST /api/v1/schedule/schedule-post/:id → quick-schedule from draft
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { postsApi, imageApi, scheduleApi } from '../api/services'

// ─── Shimmer keyframe injected once ──────────────────────────────────────────
const ShimmerCSS = () => (
  <style>{`
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .shimmer { background:linear-gradient(90deg,#1a1f2e 25%,#252c3d 50%,#1a1f2e 75%);
               background-size:200% 100%; animation:shimmer 1.4s infinite linear; }
    .row-scroll::-webkit-scrollbar { height:4px; }
    .row-scroll::-webkit-scrollbar-track { background:transparent; }
    .row-scroll::-webkit-scrollbar-thumb { background:rgba(239,68,68,0.2); border-radius:10px; }
    .row-scroll::-webkit-scrollbar-thumb:hover { background:#EF4444; }
  `}</style>
)

// ─── Icon helper ──────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, color, sw = 1.5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke={color || 'currentColor'} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onClose }) {
  const C = { success: '#10B981', error: '#EF4444', info: '#F59E0B' }
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className="fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-2xl"
      style={{ background: '#0d1117', border: `1px solid ${C[type]}33`, color: C[type] }}>
      <span className="w-2 h-2 rounded-full" style={{ background: C[type] }} />
      {message}
      <button onClick={onClose} className="ml-2 opacity-40 hover:opacity-100 text-white">✕</button>
    </div>
  )
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  draft:      { color: '#C0C6DB', bg: 'rgba(192,198,219,0.12)', label: 'Draft',      dot: '#C0C6DB' },
  scheduled:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  label: 'Scheduled',  dot: '#F59E0B' },
  published:  { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  label: 'Published',  dot: '#10B981' },
  ready:      { color: '#6366F1', bg: 'rgba(99,102,241,0.12)',  label: 'Ready',      dot: '#6366F1' },
  executed:   { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  label: 'Executed',   dot: '#10B981' },
  failed:     { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   label: 'Failed',     dot: '#EF4444' },
  cancelled:  { color: '#6B7280', bg: 'rgba(107,114,128,0.1)', label: 'Cancelled',  dot: '#6B7280' },
  publishing: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', label: 'Publishing', dot: '#8B5CF6' },
}

const ROWS = [
  { key: 'draft',     label: 'Drafts',    accent: '#C0C6DB', emoji: '✏️',  desc: 'AI-generated content ready to review' },
  { key: 'scheduled', label: 'Scheduled', accent: '#F59E0B', emoji: '🕐',  desc: 'Queued for automated publishing' },
  { key: 'published', label: 'Published', accent: '#10B981', emoji: '✅',  desc: 'Successfully posted to Instagram' },
  { key: 'failed',    label: 'Failed',    accent: '#EF4444', emoji: '⚠️',  desc: 'Requires attention' },
]

// How many cards to show before "View More"
const CARDS_PER_ROW = 4

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtRelative(iso) {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function fmtScheduled(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function highlightText(text, q) {
  if (!q || !text) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(253,224,71,0.2)', color: '#FDE047', borderRadius: '2px' }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

// ─── Quick-Schedule Modal ─────────────────────────────────────────────────────
function QuickScheduleModal({ post, onClose, onDone }) {
  const [dt, setDt]       = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0)
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const submit = async () => {
    const utc = new Date(dt).toISOString()
    if (new Date(utc) <= new Date()) { setErr('Must be in the future.'); return }
    setSaving(true)
    try { await scheduleApi.schedulePost(post.id, { scheduled_time: utc }); onDone() }
    catch (e) { setErr(e?.response?.data?.detail || 'Failed to schedule.') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div>
            <p className="text-sm font-bold text-white">Quick Schedule</p>
            <p className="text-[10px] text-white/40 mt-0.5 truncate max-w-[220px]">{post.caption?.slice(0, 55)}…</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5 text-white/40 hover:text-white">
            <Icon d="M18 6 6 18M6 6l12 12" size={15} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-white/30 block">Publish Date & Time</label>
          <input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={{ background: '#050505', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark' }} />
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-white/40 hover:text-white"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#EF4444' }}>
            {saving ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />…</> : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Caption Modal ───────────────────────────────────────────────────────
function EditModal({ post, onClose, onSave }) {
  const [caption,  setCaption]  = useState(post.caption || '')
  const [hashtags, setHashtags] = useState((post.hashtags || []).join(' '))
  const [saving,   setSaving]   = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const tags = hashtags.split(/[\s,]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean)
      await postsApi.update(post.id, { caption, hashtags: tags })
      onSave({ ...post, caption, hashtags: tags })
    } catch {} finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-sm font-bold text-white">Edit Post</p>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5 text-white/40 hover:text-white">
            <Icon d="M18 6 6 18M6 6l12 12" size={15} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-white/30 block">Caption</label>
            <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={5}
              className="w-full rounded-lg p-3 text-sm text-white outline-none resize-none leading-relaxed"
              style={{ background: '#050505', border: '1px solid rgba(255,255,255,0.08)' }}
              onFocus={e => e.target.style.borderColor = 'rgba(239,68,68,0.5)'}
              onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
            <p className="text-[10px] text-right text-white/25">{caption.length} / 2200</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-white/30 block">Hashtags</label>
            <input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#ai #brand"
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none font-mono"
              style={{ background: '#050505', border: '1px solid rgba(255,255,255,0.08)' }}
              onFocus={e => e.target.style.borderColor = 'rgba(239,68,68,0.5)'}
              onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-white/40 hover:text-white"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#EF4444' }}>
            {saving ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Post Card (compact, fixed width for horizontal row) ──────────────────────
function PostCard({ post, onDelete, onEdit, onSchedule, onGenerateImage, generatingImg, searchQ }) {
  const sc        = STATUS[post.status] || STATUS.draft
  const isDraft   = post.status === 'draft' || post.status === 'ready'
  const isFailed  = post.status === 'failed'
  const isSched   = post.status === 'scheduled' || post.status === 'publishing'

  return (
    <div className="flex-shrink-0 flex flex-col rounded-xl overflow-hidden transition-all duration-150 group"
      style={{
        width: '280px',
        background: isFailed ? 'rgba(239,68,68,0.05)' : 'rgba(17,24,39,0.8)',
        backdropFilter: 'blur(20px)',
        border: isFailed
          ? '1px solid rgba(239,68,68,0.2)'
          : isSched
            ? '1px solid rgba(245,158,11,0.2)'
            : '1px solid rgba(255,255,255,0.07)',
        borderTop: isSched ? '2px solid #F59E0B' : isFailed ? '2px solid #EF4444' : `2px solid ${sc.dot}33`,
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>

      {/* Image */}
      {post.image_url ? (
        <div className="h-36 w-full overflow-hidden flex-shrink-0">
          <img src={post.image_url} alt="" className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
      ) : (
        <div className="h-20 w-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px dashed rgba(255,255,255,0.06)' }}>
          <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" size={20} color="rgba(255,255,255,0.12)" />
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col gap-2.5 p-3 flex-1">
        {/* Status badge + time */}
        <div className="flex items-center justify-between gap-1">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
            style={{ background: sc.bg, color: sc.color }}>
            <span className="w-1 h-1 rounded-full" style={{ background: sc.dot }} />
            {sc.label}
          </span>
          <span className="text-[9px] font-mono text-white/25 truncate">
            {isSched && post.scheduled_time ? fmtScheduled(post.scheduled_time) : fmtRelative(post.created_at)}
          </span>
        </div>

        {/* Caption */}
        <p className="text-xs leading-relaxed text-white/75 line-clamp-3">
          {highlightText(post.caption?.slice(0, 120), searchQ)}
          {post.caption?.length > 120 && <span className="text-white/30">…</span>}
        </p>

        {/* Error */}
        {isFailed && post.error_message && (
          <div className="font-mono text-[9px] text-red-400 px-2 py-1 rounded truncate"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(239,68,68,0.15)' }}>
            {post.error_message.slice(0, 60)}
          </div>
        )}

        {/* Hashtags */}
        {post.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.hashtags.slice(0, 4).map((h, i) => (
              <span key={i} className="text-[8px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'rgba(239,68,68,0.07)', color: 'rgba(239,68,68,0.6)', border: '1px solid rgba(239,68,68,0.1)' }}>
                #{h}
              </span>
            ))}
            {post.hashtags.length > 4 && <span className="text-[8px] text-white/20">+{post.hashtags.length - 4}</span>}
          </div>
        )}

        {/* Tone/Style chips */}
        {(post.tone || post.design_style) && (
          <div className="flex gap-1.5">
            {post.tone && <span className="text-[8px] text-white/25 font-mono uppercase">{post.tone}</span>}
            {post.tone && post.design_style && <span className="text-[8px] text-white/15">·</span>}
            {post.design_style && <span className="text-[8px] text-white/25 font-mono uppercase">{post.design_style}</span>}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-1 px-3 py-2 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
        {/* Icon actions */}
        <div className="flex gap-0.5">
          <button onClick={() => onEdit(post)} title="Edit"
            className="p-1.5 rounded transition-colors text-white/25 hover:text-white hover:bg-white/5">
            <Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={13} />
          </button>
          <button onClick={() => navigator.clipboard.writeText(`${post.caption}\n\n${(post.hashtags||[]).map(h=>`#${h}`).join(' ')}`)}
            title="Copy" className="p-1.5 rounded transition-colors text-white/25 hover:text-white hover:bg-white/5">
            <Icon d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 0 2 2v2m-6 12h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" size={13} />
          </button>
          <button onClick={() => onDelete(post.id)} title="Delete"
            className="p-1.5 rounded transition-colors text-white/25 hover:text-red-400 hover:bg-red-400/5">
            <Icon d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" size={13} />
          </button>
        </div>

        {/* CTA buttons */}
        <div className="flex gap-1">
          {isDraft && !post.image_url && (
            <button onClick={() => onGenerateImage(post.id)} disabled={generatingImg === post.id}
              className="px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1 disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {generatingImg === post.id
                ? <span className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />
                : <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" size={10} />}
              Img
            </button>
          )}
          {isDraft && (
            <button onClick={() => onSchedule(post)}
              className="px-2 py-1 rounded text-[9px] font-bold text-white flex items-center gap-1"
              style={{ background: '#EF4444' }}>
              <Icon d="M8 2v4M16 2v4M3 10h18" size={10} />
              Schedule
            </button>
          )}
          {isFailed && (
            <button onClick={() => onEdit(post)}
              className="px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
              <Icon d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10" size={10} color="#EF4444" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: '280px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="shimmer h-20 w-full" />
      <div className="p-3 space-y-2.5">
        <div className="shimmer h-4 w-1/3 rounded" />
        <div className="shimmer h-3 rounded" />
        <div className="shimmer h-3 rounded" />
        <div className="shimmer h-3 w-2/3 rounded" />
        <div className="flex gap-1 mt-1">
          <div className="shimmer h-4 w-12 rounded-full" />
          <div className="shimmer h-4 w-10 rounded-full" />
        </div>
      </div>
      <div className="shimmer h-10 w-full" />
    </div>
  )
}

// ─── Horizontal Row Section ───────────────────────────────────────────────────
function StatusRow({ row, posts, loading, searchQ, onDelete, onEdit, onSchedule, onGenerateImage, generatingImg, navigate }) {
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef(null)

  const filtered = useMemo(() => {
    if (!searchQ) return posts
    const q = searchQ.toLowerCase()
    return posts.filter(p =>
      p.caption?.toLowerCase().includes(q) ||
      p.hashtags?.some(h => h.includes(q)) ||
      p.tone?.toLowerCase().includes(q) ||
      p.design_style?.toLowerCase().includes(q)
    )
  }, [posts, searchQ])

  const visible   = expanded ? filtered : filtered.slice(0, CARDS_PER_ROW)
  const hasMore   = filtered.length > CARDS_PER_ROW
  const hiddenCnt = filtered.length - CARDS_PER_ROW

  // Scroll arrow helpers
  const scroll = (dir) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' })
  }

  if (!loading && filtered.length === 0 && searchQ) return null // hide empty rows when searching

  return (
    <section className="space-y-3">
      {/* Row header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.accent }} />
          <h2 className="text-sm font-bold text-white tracking-tight">{row.label}</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold"
            style={{ background: `${row.accent}15`, color: row.accent, border: `1px solid ${row.accent}25` }}>
            {loading ? '…' : filtered.length}
          </span>
          <p className="text-[10px] text-white/25 hidden sm:block">{row.desc}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Scroll arrows (visible when row has content) */}
          {!loading && filtered.length > 0 && (
            <>
              <button onClick={() => scroll(-1)} className="p-1 rounded hover:bg-white/5 transition-colors text-white/30 hover:text-white">
                <Icon d="M15 18l-6-6 6-6" size={14} />
              </button>
              <button onClick={() => scroll(1)} className="p-1 rounded hover:bg-white/5 transition-colors text-white/30 hover:text-white">
                <Icon d="M9 18l6-6-6-6" size={14} />
              </button>
            </>
          )}
          {row.key === 'draft' && (
            <button onClick={() => navigate('/create')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white"
              style={{ background: '#EF4444' }}>
              <Icon d="M12 5v14M5 12h14" size={11} />
              New
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, ${row.accent}40 0%, rgba(255,255,255,0.04) 60%, transparent 100%)` }} />

      {/* Horizontal card strip */}
      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: CARDS_PER_ROW }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length > 0 ? (
        <>
          <div ref={scrollRef}
            className="row-scroll flex gap-4 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'thin', scrollbarColor: `${row.accent}33 transparent` }}>
            {visible.map(post => (
              <PostCard key={post.id} post={post} searchQ={searchQ}
                onDelete={onDelete} onEdit={onEdit} onSchedule={onSchedule}
                onGenerateImage={onGenerateImage} generatingImg={generatingImg} />
            ))}

            {/* "View More" card — shows count of hidden posts */}
            {hasMore && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  width: '160px',
                  background: `linear-gradient(135deg, ${row.accent}08, ${row.accent}04)`,
                  border: `1px dashed ${row.accent}35`,
                }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: `${row.accent}15`, border: `1px solid ${row.accent}25` }}>
                  <span className="text-lg font-bold" style={{ color: row.accent }}>+{hiddenCnt}</span>
                </div>
                <div className="text-center px-3">
                  <p className="text-[11px] font-bold" style={{ color: row.accent }}>View More</p>
                  <p className="text-[9px] text-white/30 mt-0.5">{hiddenCnt} more post{hiddenCnt !== 1 ? 's' : ''}</p>
                </div>
              </button>
            )}

            {/* "View Less" — when expanded */}
            {hasMore && expanded && (
              <button
                onClick={() => { setExpanded(false); scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' }) }}
                className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl gap-2 transition-all hover:scale-[1.02]"
                style={{ width: '120px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                <Icon d="M15 18l-6-6 6-6" size={18} color="rgba(255,255,255,0.3)" />
                <p className="text-[10px] font-semibold text-white/30">View Less</p>
              </button>
            )}
          </div>
        </>
      ) : (
        /* Empty state */
        <div className="h-28 rounded-xl flex flex-col items-center justify-center gap-2"
          style={{ background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.06)' }}>
          <span className="text-2xl" style={{ opacity: 0.25 }}>{row.emoji}</span>
          <p className="text-xs text-white/25">No {row.label.toLowerCase()} posts yet</p>
          {row.key === 'draft' && (
            <button onClick={() => navigate('/create')}
              className="text-[10px] font-semibold text-red-400 hover:underline mt-0.5">
              Generate with AI Studio →
            </button>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ContentManagerPage() {
  const navigate = useNavigate()

  const [columns, setColumns]        = useState({ draft: [], scheduled: [], published: [], failed: [] })
  const [loading, setLoading]        = useState(true)
  const [editPost,      setEditPost]      = useState(null)
  const [schedulePost,  setSchedulePost]  = useState(null)
  const [generatingImg, setGeneratingImg] = useState(null)
  const [searchQ, setSearchQ]        = useState('')
  const [toast,   setToast]          = useState(null)

  const showToast = (msg, type = 'success') => setToast({ message: msg, type })

  // ── Fetch all 4 rows in parallel ───────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [dR, sR, pR, fR] = await Promise.all([
        postsApi.getAll({ status: 'draft',     limit: 50 }),
        postsApi.getAll({ status: 'scheduled', limit: 50 }),
        postsApi.getAll({ status: 'published', limit: 50 }),
        postsApi.getAll({ status: 'failed',    limit: 50 }),
      ])
      const parse = r => { const d = r.data?.data ?? r.data ?? []; return Array.isArray(d) ? d.map(p => ({ ...p, id: p.id || p._id })) : [] }
      setColumns({ draft: parse(dR), scheduled: parse(sR), published: parse(pR), failed: parse(fR) })
    } catch { showToast('Failed to load posts.', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (postId) => {
    try {
      await postsApi.delete(postId)
      setColumns(prev => { const n = {...prev}; for (const k of Object.keys(n)) n[k] = n[k].filter(p => p.id !== postId); return n })
      showToast('Post deleted.')
    } catch { showToast('Delete failed.', 'error') }
  }, [])

  // ── Edit save ──────────────────────────────────────────────────────────────
  const handleEditSave = useCallback((updated) => {
    setColumns(prev => { const n = {...prev}; for (const k of Object.keys(n)) n[k] = n[k].map(p => p.id === updated.id ? {...p, ...updated} : p); return n })
    setEditPost(null)
    showToast('Post updated.')
  }, [])

  // ── Generate image ─────────────────────────────────────────────────────────
  const handleGenerateImage = useCallback(async (postId) => {
    setGeneratingImg(postId)
    try {
      const res = await imageApi.generateImage(postId)
      const url = res.data?.image_url
      setColumns(prev => { const n = {...prev}; for (const k of Object.keys(n)) n[k] = n[k].map(p => p.id === postId ? {...p, image_url: url} : p); return n })
      showToast('Image generated!')
    } catch { showToast('Image generation failed.', 'error') }
    finally { setGeneratingImg(null) }
  }, [])

  // ── Quick-schedule done ────────────────────────────────────────────────────
  const handleScheduleDone = useCallback(async () => {
    setSchedulePost(null)
    showToast('Post scheduled!')
    await fetchAll()
  }, [fetchAll])

  const total = Object.values(columns).reduce((s, c) => s + c.length, 0)

  return (
    <AppLayout title="Content Manager">
      <ShimmerCSS />
      {toast        && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {editPost     && <EditModal post={editPost} onClose={() => setEditPost(null)} onSave={handleEditSave} />}
      {schedulePost && <QuickScheduleModal post={schedulePost} onClose={() => setSchedulePost(null)} onDone={handleScheduleDone} />}

      {/* Ambient glow */}
      <div className="pointer-events-none fixed top-0 right-0 w-1/2 h-1/2 -z-10"
        style={{ background: 'radial-gradient(ellipse at top right, rgba(239,68,68,0.05) 0%, transparent 65%)' }} />

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Content Manager</h1>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {loading ? 'Loading…' : `${total} post${total !== 1 ? 's' : ''} across all stages`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Icon d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" size={13} color="rgba(255,255,255,0.3)" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Search posts…"
              className="bg-transparent text-sm text-white placeholder-white/20 outline-none w-40" />
            {searchQ && (
              <button onClick={() => setSearchQ('')} className="text-white/30 hover:text-white">
                <Icon d="M18 6 6 18M6 6l12 12" size={12} />
              </button>
            )}
          </div>

          {/* Refresh */}
          <button onClick={fetchAll} title="Refresh"
            className="p-2 rounded-lg text-white/35 hover:text-white hover:bg-white/5 transition-colors">
            <Icon d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" size={15} />
          </button>

          {/* New Post */}
          <button onClick={() => navigate('/create')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white active:scale-95 transition-all"
            style={{ background: '#EF4444', boxShadow: '0 0 20px rgba(239,68,68,0.2)' }}>
            <Icon d="M12 5v14M5 12h14" size={15} />
            New Post
          </button>
        </div>
      </div>

      {/* ── Row sections ──────────────────────────────────────────────────────── */}
      <div className="space-y-10">
        {ROWS.map(row => (
          <StatusRow key={row.key} row={row}
            posts={columns[row.key] || []}
            loading={loading}
            searchQ={searchQ}
            onDelete={handleDelete}
            onEdit={setEditPost}
            onSchedule={setSchedulePost}
            onGenerateImage={handleGenerateImage}
            generatingImg={generatingImg}
            navigate={navigate}
          />
        ))}
      </div>
    </AppLayout>
  )
}
