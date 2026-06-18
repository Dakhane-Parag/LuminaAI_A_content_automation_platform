/**
 * BrandFlow AI — AI Studio Create Post Page
 * Route: /create
 *
 * APIs used:
 *   POST /api/v1/ai/generate-posts     → generate drafts (aiApi.generatePost)
 *   POST /api/v1/images/generate-image/:id → generate AI image (imageApi.generateImage)
 *   DELETE /api/v1/posts/:id           → delete a draft (postsApi.delete)
 *   GET  /api/v1/posts?status=draft    → load existing drafts (postsApi.getAll)
 *
 * Request schema for generate-posts:
 *   { prompt: string (5–2000 chars), variations: number (1–8) }
 *
 * Response shape (GeneratedPostVariant):
 *   { id, caption, hashtags[], tone, design_style, cta, status }
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import AppLayout from '../components/AppLayout'
import { aiApi, imageApi, postsApi } from '../api/services'

// ─── Icon helper ─────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, color, strokeWidth = 1.5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke={color || 'currentColor'} strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
  <div className={`rounded animate-pulse ${className}`}
    style={{ background: 'linear-gradient(90deg, #1c1b1b 25%, #2a2a2a 50%, #1c1b1b 75%)', backgroundSize: '200% 100%' }} />
)

// ─── Toast notification ───────────────────────────────────────────────────────
function Toast({ message, type = 'success', onClose }) {
  const colors = { success: '#10B981', error: '#EF4444', info: '#F59E0B' }
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-semibold text-white flex items-center gap-2 shadow-2xl"
      style={{ background: '#111827', border: `1px solid ${colors[type]}44`, color: colors[type] }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[type] }} />
      {message}
      <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 text-white">✕</button>
    </div>
  )
}

// ─── Tone badge colour map ────────────────────────────────────────────────────
const TONE_COLORS = {
  professional:  '#6366F1',
  viral:         '#EF4444',
  inspirational: '#F59E0B',
  humorous:      '#10B981',
  educational:   '#3B82F6',
  casual:        '#8B5CF6',
}
const toneColor = (tone) => TONE_COLORS[tone?.toLowerCase()] || '#EF4444'

// ─── Style icon map ───────────────────────────────────────────────────────────
const STYLE_ICONS = {
  luxury:      'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  startup:     'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  minimal:     'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  bold:        'M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z',
  elegant:     'M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 14c-7 0-7 4-7 4v2h14v-2s0-4-7-4z',
  modern:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  retro:       'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
}

// ─── Variation counter (1–8) ──────────────────────────────────────────────────
const VARIATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]

// ─── Draft Post Card ──────────────────────────────────────────────────────────
function DraftCard({ post, index, onGenerateImage, onDelete, onCopy, generatingImageFor }) {
  const isGenerating = generatingImageFor === post.id
  const [expanded, setExpanded] = useState(false)
  const tc = toneColor(post.tone)

  return (
    <div className="rounded-xl p-5 space-y-4 group transition-all duration-200"
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        border: `1px solid rgba(255,255,255,0.08)`,
        ':hover': { borderColor: `${tc}40` },
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = `${tc}35`}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
    >
      {/* Card header */}
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${tc}18`, border: `1px solid ${tc}30` }}>
            <Icon d={STYLE_ICONS[post.design_style?.toLowerCase()] || STYLE_ICONS.modern} color={tc} size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">
              Variant {String(index + 1).padStart(2, '0')}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                style={{ background: `${tc}15`, color: tc }}>
                {post.tone}
              </span>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">{post.design_style}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onCopy(post)}
            className="p-1.5 rounded-lg transition-colors text-white/40 hover:text-white hover:bg-white/5"
            title="Copy caption">
            <Icon d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-6 12h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" size={15} />
          </button>
          <button onClick={() => onDelete(post.id)}
            className="p-1.5 rounded-lg transition-colors text-white/40 hover:text-red-400 hover:bg-red-400/5"
            title="Delete draft">
            <Icon d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" size={15} />
          </button>
        </div>
      </div>

      {/* Caption */}
      <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <p className="text-sm leading-relaxed text-white/80">
          {expanded ? post.caption : post.caption?.slice(0, 180)}
          {post.caption?.length > 180 && (
            <button onClick={() => setExpanded(!expanded)}
              className="ml-1 text-[#EF4444] font-semibold hover:underline text-xs">
              {expanded ? ' less' : '… more'}
            </button>
          )}
        </p>
      </div>

      {/* CTA */}
      {post.cta && (
        <div className="flex items-start gap-2">
          <Icon d="M5 12h14M12 5l7 7-7 7" size={13} color="#EF4444" />
          <p className="text-xs text-white/50 italic leading-relaxed">{post.cta}</p>
        </div>
      )}

      {/* Hashtags */}
      {post.hashtags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.hashtags.slice(0, 7).map((tag, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-mono"
              style={{ background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.15)' }}>
              #{tag}
            </span>
          ))}
          {post.hashtags.length > 7 && (
            <span className="text-[10px] text-white/30">+{post.hashtags.length - 7}</span>
          )}
        </div>
      )}

      {/* Image preview */}
      {post.image_url && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <img src={post.image_url} alt="AI generated" className="w-full h-40 object-cover" />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onGenerateImage(post.id)}
          disabled={isGenerating || !!post.image_url}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: post.image_url ? 'rgba(16,185,129,0.1)' : '#EF4444',
            color: post.image_url ? '#10B981' : '#fff',
            border: post.image_url ? '1px solid rgba(16,185,129,0.3)' : 'none',
          }}>
          {isGenerating ? (
            <>
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              GENERATING IMAGE…
            </>
          ) : post.image_url ? (
            <>
              <Icon d="M20 6L9 17l-5-5" size={14} color="#10B981" />
              IMAGE READY
            </>
          ) : (
            <>
              <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" size={14} />
              GENERATE IMAGE
            </>
          )}
        </button>
      </div>

      <p className="text-[10px] text-center text-white/20 italic">
        Powered by Pollinations AI · Stored on S3
      </p>
    </div>
  )
}

// ─── Skeleton generation card ─────────────────────────────────────────────────
function SkeletonCard({ opacity = 1 }) {
  return (
    <div className="rounded-xl p-5 space-y-4" style={{ opacity, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex gap-3">
        <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CreatePostPage() {
  // Form state
  const [prompt, setPrompt]           = useState('')
  const [variations, setVariations]   = useState(4)

  // Data state
  const [posts, setPosts]             = useState([])          // current session drafts
  const [archivedPosts, setArchived]  = useState([])          // existing drafts from DB

  // UI state
  const [generating, setGenerating]   = useState(false)
  const [loadingArchive, setLoadingArchive] = useState(true)
  const [generatingImageFor, setGeneratingImageFor] = useState(null)
  const [toast, setToast]             = useState(null)
  const [error, setError]             = useState('')

  const textareaRef = useRef(null)

  // Load existing drafts on mount
  useEffect(() => {
    postsApi.getAll({ status: 'draft', limit: 12 })
      .then(res => {
        const data = res.data?.data ?? res.data ?? []
        setArchived(Array.isArray(data) ? data : [])
      })
      .catch(() => setArchived([]))
      .finally(() => setLoadingArchive(false))
  }, [])

  const showToast = (message, type = 'success') => setToast({ message, type })

  // ── Generate posts ──────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const trimmed = prompt.trim()
    if (trimmed.length < 5) {
      setError('Please enter at least 5 characters for your prompt.')
      return
    }
    setError('')
    setGenerating(true)
    setPosts([])  // clear previous session results

    try {
      const res = await aiApi.generatePost({ prompt: trimmed, variations })
      const generated = res.data?.posts ?? []
      setPosts(generated)
      showToast(`${generated.length} post variant${generated.length !== 1 ? 's' : ''} generated!`)
      // Refresh archive to pick up newly saved drafts
      postsApi.getAll({ status: 'draft', limit: 12 })
        .then(r => setArchived(Array.isArray(r.data?.data ?? r.data) ? (r.data?.data ?? r.data) : []))
        .catch(() => {})
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Generation failed. Please try again.'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setGenerating(false)
    }
  }

  // ── Generate image for a post ───────────────────────────────────────────────
  const handleGenerateImage = useCallback(async (postId) => {
    setGeneratingImageFor(postId)
    try {
      const res = await imageApi.generateImage(postId)
      const imageUrl = res.data?.image_url

      // Update the post in both lists
      const updatePost = (p) => p.id === postId ? { ...p, image_url: imageUrl } : p
      setPosts(prev => prev.map(updatePost))
      setArchived(prev => prev.map(updatePost))

      showToast('Image generated successfully!')
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Image generation failed.'
      showToast(msg, 'error')
    } finally {
      setGeneratingImageFor(null)
    }
  }, [])

  // ── Delete a draft ──────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (postId) => {
    try {
      await postsApi.delete(postId)
      setPosts(prev => prev.filter(p => p.id !== postId))
      setArchived(prev => prev.filter(p => p.id !== postId))
      showToast('Draft deleted.')
    } catch {
      showToast('Failed to delete draft.', 'error')
    }
  }, [])

  // ── Copy caption ────────────────────────────────────────────────────────────
  const handleCopy = useCallback((post) => {
    const text = `${post.caption}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`
    navigator.clipboard.writeText(text)
      .then(() => showToast('Caption copied to clipboard!', 'info'))
      .catch(() => showToast('Failed to copy.', 'error'))
  }, [])

  const charCount = prompt.length
  const isValid   = charCount >= 5 && charCount <= 2000

  // ── Panel styles ────────────────────────────────────────────────────────────
  const panelStyle = {
    background: 'rgba(17,24,39,0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.07)',
  }

  return (
    <AppLayout title="AI Studio">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex h-full gap-0 -mx-6 -mt-6" style={{ height: 'calc(100vh - 64px)' }}>

        {/* ── Left pane: Configuration ─────────────────────────────────────── */}
        <aside className="w-[400px] flex-shrink-0 flex flex-col border-r"
          style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(11,14,20,0.95)' }}>

          {/* Header */}
          <div className="px-6 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <h2 className="text-base font-bold text-white tracking-tight">Configuration</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Define your post parameters for AI generation
            </p>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(239,68,68,0.2) transparent' }}>

            {/* Prompt textarea */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40 block">
                Topic / Creative Prompt
              </label>
              <div className="relative"
                style={{ border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '8px', background: '#050505', transition: 'border-color 0.15s' }}
                onFocusCapture={e => { if (!error) e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)' }}
                onBlurCapture={e => { if (!error) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); if (error) setError('') }}
                  placeholder="Describe what you want to create... e.g. A luxury watch brand post targeting professionals aged 30–45"
                  className="w-full bg-transparent p-4 text-sm text-white placeholder-white/20 resize-none outline-none leading-relaxed"
                  style={{ minHeight: '160px' }}
                  maxLength={2000}
                />
                <div className="px-4 pb-3 flex justify-between items-center">
                  <span className="text-[10px]" style={{ color: charCount > 1900 ? '#EF4444' : 'rgba(255,255,255,0.2)' }}>
                    {charCount} / 2000
                  </span>
                  {charCount >= 5 && (
                    <span className="text-[10px] text-green-400">✓ Ready</span>
                  )}
                </div>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            {/* Number of variations */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                  Variations
                </label>
                <span className="text-lg font-bold text-white">{variations}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {VARIATION_OPTIONS.map(n => (
                  <button key={n} onClick={() => setVariations(n)}
                    className="w-10 h-10 rounded-lg text-sm font-bold transition-all"
                    style={{
                      background: variations === n ? '#EF4444' : 'rgba(255,255,255,0.04)',
                      color: variations === n ? '#fff' : 'rgba(255,255,255,0.4)',
                      border: `1px solid ${variations === n ? 'transparent' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/25">
                Backend supports 1–8 variations · Each saved as a separate draft
              </p>
            </div>

            {/* Info box */}
            <div className="rounded-lg p-4 space-y-2"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p className="text-xs font-semibold text-red-400">What gets generated</p>
              <ul className="text-[11px] text-white/50 space-y-1 list-none">
                <li>✦ Unique Instagram caption per variant</li>
                <li>✦ 5–10 relevant hashtags (no # prefix)</li>
                <li>✦ Compelling call-to-action (CTA)</li>
                <li>✦ Tone & design style assigned per variant</li>
                <li>✦ All variants saved as drafts automatically</li>
              </ul>
            </div>
          </div>

          {/* Generate button */}
          <div className="px-6 py-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <button
              onClick={handleGenerate}
              disabled={generating || !isValid}
              className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: generating || !isValid ? 'rgba(239,68,68,0.3)' : '#EF4444',
                color: '#fff',
                boxShadow: (!generating && isValid) ? '0 0 30px rgba(239,68,68,0.2)' : 'none',
              }}>
              {generating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  SYNTHESIZING VARIANTS…
                </>
              ) : (
                <>
                  <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" size={16} />
                  GENERATE {variations} VARIANT{variations !== 1 ? 'S' : ''}
                </>
              )}
            </button>
          </div>
        </aside>

        {/* ── Right pane: Results ───────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Results header */}
          <div className="px-6 py-5 border-b flex items-center justify-between"
            style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
            <div className="flex items-center gap-3">
              <Icon d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" color="#EF4444" size={18} />
              <h2 className="text-base font-bold text-white">Generations</h2>
            </div>
            <div className="flex items-center gap-3">
              {generating && (
                <span className="flex items-center gap-2 text-xs font-semibold text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                  SYNTHESIZING…
                </span>
              )}
              {posts.length > 0 && !generating && (
                <span className="text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {posts.length} NEW
                </span>
              )}
            </div>
          </div>

          {/* Scrollable results */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-10"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(239,68,68,0.2) transparent' }}>

            {/* ── Current session results ─────────────────────────────────── */}
            {(generating || posts.length > 0) && (
              <section>
                <div className="flex items-center gap-3 mb-5">
                  {generating && <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />}
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                    {generating ? 'Synthesizing draft variants…' : `Current Session — ${posts.length} variant${posts.length !== 1 ? 's' : ''}`}
                  </h3>
                </div>

                {generating ? (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {Array.from({ length: variations }).map((_, i) => (
                      <SkeletonCard key={i} opacity={1 - i * 0.12} />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {posts.map((post, i) => (
                      <DraftCard key={post.id} post={post} index={i}
                        onGenerateImage={handleGenerateImage}
                        onDelete={handleDelete}
                        onCopy={handleCopy}
                        generatingImageFor={generatingImageFor} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Archive: existing drafts from DB ────────────────────────── */}
            {(loadingArchive || archivedPosts.length > 0) && (
              <section>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                    Draft Archive — Saved in Database
                  </h3>
                  <span className="text-[10px] text-white/25">
                    {loadingArchive ? '…' : `${archivedPosts.length} draft${archivedPosts.length !== 1 ? 's' : ''}`}
                  </span>
                </div>

                {loadingArchive ? (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} opacity={0.6} />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {archivedPosts.map((post, i) => (
                      <DraftCard key={post.id || post._id} post={{ ...post, id: post.id || post._id }} index={i}
                        onGenerateImage={handleGenerateImage}
                        onDelete={handleDelete}
                        onCopy={handleCopy}
                        generatingImageFor={generatingImageFor} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Empty state ──────────────────────────────────────────────── */}
            {!generating && posts.length === 0 && archivedPosts.length === 0 && !loadingArchive && (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <Icon d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" color="#EF4444" size={32} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Ready to Create</h3>
                <p className="text-sm max-w-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Enter a creative prompt on the left and click Generate to create AI-powered Instagram post variants using Gemini.
                </p>
                <div className="mt-6 flex items-center gap-4 text-xs text-white/20">
                  <span>Powered by Gemini AI</span>
                  <span>·</span>
                  <span>Images by Pollinations</span>
                  <span>·</span>
                  <span>Stored on S3</span>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  )
}
