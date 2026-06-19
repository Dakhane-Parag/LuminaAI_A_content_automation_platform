/**
 * BrandFlow AI — Help & Support Page
 * Route: /help
 */

import AppLayout from '../components/AppLayout'

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20, color = "currentColor", sw = 1.5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const ICONS = {
  check: "M20 6L9 17l-5-5",
  info: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-14v2m0 4h.01",
  external: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"
}

// ─── Document Sections ────────────────────────────────────────────────────────
const SECTIONS = [
  {
    title: "1. Convert Instagram to Business Account",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-white/70">Your Instagram must be a <strong>Business</strong> or <strong>Creator</strong> account to use the publishing API.</p>
        <div className="bg-black/30 border border-white/5 rounded-lg p-4 font-mono text-xs text-white/60 space-y-2">
          <p>1. Go to your Instagram Profile (mobile app) → tap the ☰ menu (top right).</p>
          <p>2. Tap <strong>Settings and Privacy</strong> → <strong>Account type and tools</strong>.</p>
          <p>3. Tap <strong>Switch to Professional Account</strong> → <strong>Business</strong> → Select a category → Done.</p>
        </div>
      </div>
    )
  },
  {
    title: "2. Create a Facebook Page",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-white/70">Instagram Business accounts must be linked to a Facebook Page.</p>
        <div className="bg-black/30 border border-white/5 rounded-lg p-4 font-mono text-xs text-white/60 space-y-2">
          <p>1. Go to <a href="https://www.facebook.com/pages/create" target="_blank" className="text-[#3B82F6] hover:underline flex items-center gap-1 inline-flex">facebook.com/pages/create <Icon d={ICONS.external} size={10} /></a></p>
          <p>2. Choose <strong>"Business or brand"</strong>.</p>
          <p>3. Enter a Page name (e.g., Brandflow Page) and a category, then click Continue.</p>
        </div>
      </div>
    )
  },
  {
    title: "3. Link Instagram to your Facebook Page",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-white/70">You can link them directly from Facebook or from the Instagram mobile app.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-black/30 border border-white/5 rounded-lg p-4 font-mono text-xs text-white/60 space-y-2">
            <p className="text-white font-sans font-bold mb-1">Option A (On Facebook)</p>
            <p>1. Go to your Facebook Page → click <strong>Settings</strong>.</p>
            <p>2. Click <strong>Linked accounts</strong> → <strong>Instagram</strong>.</p>
            <p>3. Click <strong>Connect</strong>, log in to Instagram, and Confirm.</p>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-lg p-4 font-mono text-xs text-white/60 space-y-2">
            <p className="text-white font-sans font-bold mb-1">Option B (On Mobile)</p>
            <p>1. Go to your IG Profile → <strong>Edit Profile</strong>.</p>
            <p>2. Scroll down to <strong>Social media links</strong>.</p>
            <p>3. Select <strong>Facebook</strong> and connect your Page.</p>
          </div>
        </div>
      </div>
    )
  },
  {
    title: "4. Generate & Extend Access Token",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-white/70">Use the Graph API Explorer to generate a Long-Lived Token (valid for 60 days) to use in the Manual Configuration settings.</p>
        <div className="bg-black/30 border border-white/5 rounded-lg p-4 font-mono text-xs text-white/60 space-y-2">
          <p>1. Go to <a href="https://developers.facebook.com/tools/explorer/" target="_blank" className="text-[#3B82F6] hover:underline flex items-center gap-1 inline-flex">Graph API Explorer <Icon d={ICONS.external} size={10} /></a></p>
          <p>2. Select your Meta App from the dropdown.</p>
          <p>3. Under Permissions, add: <code>instagram_basic</code>, <code>instagram_content_publish</code>, <code>pages_manage_metadata</code>, <code>pages_read_engagement</code>, and <code>pages_show_list</code>.</p>
          <p>4. Click <strong>Generate Access Token</strong> and accept the popup.</p>
          <p>5. Click the "i" (info) icon next to the token → <strong>Open in Access Token Tool</strong> → <strong>Extend Access Token</strong>.</p>
          <p>6. Copy the resulting Long-Lived Token.</p>
        </div>
      </div>
    )
  },
  {
    title: "5. Find your Facebook Page ID & Instagram Business ID",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-white/70">You can fetch these automatically using the token you just generated.</p>
        <div className="bg-black/30 border border-white/5 rounded-lg p-4 font-mono text-xs text-white/60 space-y-2">
          <p>1. In the Graph API Explorer path field, enter exactly:</p>
          <div className="bg-[#050505] p-2 rounded text-[#EF4444] border border-[#EF4444]/20 my-2">
            /me/accounts?fields=id,name,instagram_business_account
          </div>
          <p>2. Click <strong>Submit</strong>.</p>
          <p>3. The response will show your pages. The <code>id</code> field is your Facebook Page ID.</p>
          <p>4. The <code>instagram_business_account.id</code> field is your Instagram Business ID.</p>
        </div>
      </div>
    )
  }
]

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HelpPage() {
  return (
    <AppLayout title="Help & Documentation">
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .help-anim { animation: fadeUp 0.5s ease backwards; }
      `}</style>

      {/* Ambient glow */}
      <div className="pointer-events-none fixed top-0 right-0 w-1/2 h-1/2 -z-10"
        style={{ background: 'radial-gradient(ellipse at top right, rgba(59,130,246,0.05) 0%, transparent 60%)' }} />

      <div className="max-w-[850px] mx-auto help-anim">
        
        {/* Header */}
        <div className="mb-10 border-b pb-8" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#6B5CF6] flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              <Icon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" color="white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Manual Meta Setup Guide</h1>
          </div>
          <p className="text-sm text-white/50 leading-relaxed">
            If the automated Express Connection isn't working due to Meta caching issues, follow this step-by-step guide to configure your Instagram Business account manually. Once you finish these steps, paste your Token and IDs into the <strong className="text-white/80">Manual Configuration</strong> panel on the Settings page.
          </p>
        </div>

        {/* Info Banner */}
        <div className="mb-10 flex items-start gap-3 bg-[#3B82F6]/10 border border-[#3B82F6]/20 p-4 rounded-xl text-[#3B82F6]">
          <div className="mt-0.5"><Icon d={ICONS.info} size={18} /></div>
          <p className="text-xs leading-relaxed">
            <strong>Prerequisite:</strong> You must have a Meta Developer account and a Meta App created. If you haven't done this, go to <a href="https://developers.facebook.com" target="_blank" className="underline font-bold">developers.facebook.com</a> first.
          </p>
        </div>

        {/* Steps Content */}
        <div className="space-y-8">
          {SECTIONS.map((section, idx) => (
            <div key={idx} className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 transition-all hover:bg-[#111827]/60">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/70 border border-white/10">
                  {idx + 1}
                </span>
                {section.title.split('. ')[1]}
              </h2>
              {section.content}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t text-center space-y-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="text-xs text-white/40">Once you have your Long-Lived Token, Facebook Page ID, and Instagram Business ID:</p>
          <a href="/settings" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 bg-white/10 hover:bg-white/15 border border-white/10">
            Go to Settings <Icon d={ICONS.check} size={16} />
          </a>
        </div>

      </div>
    </AppLayout>
  )
}
