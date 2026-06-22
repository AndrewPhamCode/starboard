import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/* ─── Logo ─────────────────────────────────────────────────────────────────── */
function StarboardLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* N-S axis */}
      <line x1="14" y1="3" x2="14" y2="25" stroke="#f0f0f0" strokeWidth="1.2" strokeOpacity="0.35" strokeLinecap="round" />
      {/* W spoke */}
      <line x1="3" y1="14" x2="13" y2="14" stroke="#f0f0f0" strokeWidth="1.2" strokeOpacity="0.35" strokeLinecap="round" />
      {/* E/starboard spoke — violet, brighter */}
      <line x1="15" y1="14" x2="22" y2="14" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
      {/* Arrowhead at starboard */}
      <path d="M20 11.5L24.5 14L20 16.5" fill="#7c3aed" />
      {/* Center */}
      <circle cx="14" cy="14" r="2.5" fill="white" />
    </svg>
  )
}

/* ─── Mode data ─────────────────────────────────────────────────────────────── */
const MODES = [
  {
    title: 'Behavioral',
    desc: 'Master leadership, conflict, and impact stories with the STAR method.',
    count: '20 questions',
    href: '/practice/behavioral',
    accent: '#7c3aed',
    accentBg: 'rgba(124,58,237,0.08)',
    accentBorder: 'rgba(124,58,237,0.4)',
    accentGlow: 'rgba(124,58,237,0.15)',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Technical',
    desc: 'System design, debugging, and architecture questions with AI scoring.',
    count: '8 questions',
    href: '/practice/technical',
    accent: '#06b6d4',
    accentBg: 'rgba(6,182,212,0.08)',
    accentBorder: 'rgba(6,182,212,0.4)',
    accentGlow: 'rgba(6,182,212,0.15)',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    title: 'Resume',
    desc: 'Walk through your projects and experience with confidence.',
    count: '4 questions',
    href: '/practice/resume',
    accent: '#f59e0b',
    accentBg: 'rgba(245,158,11,0.08)',
    accentBorder: 'rgba(245,158,11,0.4)',
    accentGlow: 'rgba(245,158,11,0.15)',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    title: 'LeetCode',
    desc: 'Talk through algorithms out loud with a live AI interviewer listening.',
    count: '32+ problems',
    href: '/practice/leetcode',
    accent: '#10b981',
    accentBg: 'rgba(16,185,129,0.08)',
    accentBorder: 'rgba(16,185,129,0.4)',
    accentGlow: 'rgba(16,185,129,0.15)',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
  },
]


const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
    title: 'Voice AI',
    desc: 'Speak your answer naturally. The AI listens for silence and responds in seconds.',
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: 'Instant Scoring',
    desc: 'Every answer scored on STAR dimensions with a coaching note and model rewrite.',
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
    title: 'LeetCode Coach',
    desc: 'Live interviewer probes your complexity analysis and follow-up thinking.',
  },
]

/* ─── Demo carousel data ────────────────────────────────────────────────────── */
interface DemoSlide {
  mode: string
  question: string
  overall: number
  bars: { label: string; score: number; color: string }[]
  note: string
  accent: string
  soon?: boolean
}

const DEMO_SLIDES: DemoSlide[] = [
  {
    mode: 'Behavioral',
    question: 'Tell me about a time you led a team through a difficult project.',
    overall: 4,
    bars: [
      { label: 'Situation', score: 4, color: '#7c3aed' },
      { label: 'Task',      score: 3, color: '#06b6d4' },
      { label: 'Action',    score: 5, color: '#10b981' },
      { label: 'Result',    score: 4, color: '#f59e0b' },
    ],
    note: 'Strong action section. Quantify your result more specifically — mention the actual metric or timeline to make it land.',
    accent: '#7c3aed',
  },
  {
    mode: 'Technical',
    question: 'How would you design a URL shortener that handles 100M requests per day?',
    overall: 3,
    bars: [
      { label: 'Situation', score: 2, color: '#7c3aed' },
      { label: 'Task',      score: 3, color: '#06b6d4' },
      { label: 'Action',    score: 4, color: '#10b981' },
      { label: 'Result',    score: 3, color: '#f59e0b' },
    ],
    note: "Good coverage of hashing and load balancing. Add cache eviction strategy and hotspot handling to push this to a 4.",
    accent: '#06b6d4',
  },
  {
    mode: 'Resume',
    question: 'Walk me through your most impactful project from your resume.',
    overall: 4,
    bars: [
      { label: 'Situation', score: 5, color: '#7c3aed' },
      { label: 'Task',      score: 4, color: '#06b6d4' },
      { label: 'Action',    score: 4, color: '#10b981' },
      { label: 'Result',    score: 3, color: '#f59e0b' },
    ],
    note: "Great context-setting. Your result needs harder numbers — replace 'improved performance' with the actual percentage or user impact.",
    accent: '#f59e0b',
  },
  {
    mode: 'LeetCode',
    question: 'Two Sum — explain your approach out loud as you code.',
    overall: 0,
    bars: [],
    note: '',
    accent: '#10b981',
    soon: true,
  },
]

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [hoveredMode, setHoveredMode] = useState<number | null>(null)
  const [demoIdx, setDemoIdx] = useState(0)
  const touchStartX = useRef<number | null>(null)

  function prevDemo() { setDemoIdx(i => (i - 1 + DEMO_SLIDES.length) % DEMO_SLIDES.length) }
  function nextDemo() { setDemoIdx(i => (i + 1) % DEMO_SLIDES.length) }
  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) { dx < 0 ? nextDemo() : prevDemo() }
    touchStartX.current = null
  }

  const slide = DEMO_SLIDES[demoIdx]

  function scrollToModes() {
    document.getElementById('modes')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0c0c0e',
        color: '#f0f0f0',
        fontFamily: "'Inter', system-ui, sans-serif",
        overflowX: 'hidden',
      }}
    >
      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottom: '1px solid #2a2a2e',
          background: 'rgba(12,12,14,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StarboardLogo size={26} />
            <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: '1.05rem', color: '#f0f0f0', letterSpacing: '-0.02em' }}>
              starboard
            </span>
          </div>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="hidden md:flex">
            {['Features', 'Modes', 'Pricing'].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase()}`}
                style={{ color: '#6b6b7a', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#f0f0f0')}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#6b6b7a')}
              >
                {label}
              </a>
            ))}
          </div>

          {/* Auth CTA */}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #2a2a2e', background: 'transparent', color: '#a1a1aa', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#f0f0f0'; e.currentTarget.style.borderColor = '#52525b' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.borderColor = '#2a2a2e' }}
              >
                Dashboard
              </button>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa', fontWeight: 700, fontSize: '0.68rem', fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer' }}
                onClick={() => navigate('/dashboard')}
                title={user.email}
              >
                {(user.email ?? 'U').slice(0, 2).toUpperCase()}
              </div>
              <button
                onClick={() => signOut().then(() => navigate('/'))}
                style={{ background: 'none', border: 'none', color: '#52525b', fontSize: '0.8rem', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", padding: '4px 2px', transition: 'color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#a1a1aa' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#52525b' }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #7c3aed', background: 'transparent', color: '#a78bfa', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Inter', system-ui, sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.12)'; e.currentTarget.style.color = '#c4b5fd' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a78bfa' }}
            >
              Sign in
            </button>
          )}
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: 'calc(100vh - 60px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '80px 24px 60px',
          position: 'relative',
          background: 'radial-gradient(ellipse at 50% -10%, rgba(124,58,237,0.18) 0%, transparent 55%), radial-gradient(ellipse at 85% 60%, rgba(6,182,212,0.07) 0%, transparent 45%), #0c0c0e',
        }}
      >
        {/* Subtle grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 680 }}>
          {/* Eyebrow */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 14px',
              border: '1px solid rgba(6,182,212,0.3)',
              borderRadius: 100,
              background: 'rgba(6,182,212,0.06)',
              marginBottom: 32,
            }}
          >
            <span style={{ color: '#06b6d4', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', fontFamily: "'JetBrains Mono', monospace" }}>
              ◈ AI-POWERED INTERVIEW COACHING
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 'clamp(2.8rem, 8vw, 5rem)',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              color: '#f0f0f0',
              margin: '0 0 20px',
            }}
          >
            Ace every<br />
            <span style={{ color: '#7c3aed' }}>interview.</span>
          </h1>

          {/* Subline */}
          <p
            style={{
              color: '#6b6b7a',
              fontSize: '1.05rem',
              lineHeight: 1.65,
              maxWidth: 480,
              margin: '0 auto 40px',
            }}
          >
            Practice with an AI interviewer that listens, challenges, and scores your answers in real time.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56 }}>
            <button
              onClick={scrollToModes}
              style={{
                padding: '13px 28px',
                borderRadius: 10,
                border: 'none',
                background: '#7c3aed',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'background 0.15s, transform 0.15s',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#6d28d9'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#7c3aed'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              Start practicing →
            </button>
            <button
              onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                padding: '13px 28px',
                borderRadius: 10,
                border: '1px solid #2a2a2e',
                background: 'transparent',
                color: '#a1a1aa',
                fontSize: '0.95rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'border-color 0.15s, color 0.15s, transform 0.15s',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#52525b'; e.currentTarget.style.color = '#f0f0f0'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2e'; e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              See how it works
            </button>
          </div>

          {/* Stat badges */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { value: '32+', label: 'questions' },
              { value: '4', label: 'interview modes' },
              { value: 'STAR', label: 'AI scoring' },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  padding: '7px 16px',
                  border: '1px solid #2a2a2e',
                  borderRadius: 8,
                  background: '#141416',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.85rem', color: '#f0f0f0' }}>{s.value}</span>
                <span style={{ fontSize: '0.78rem', color: '#6b6b7a' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mode Gallery ─────────────────────────────────────────────────────── */}
      <section id="modes" style={{ padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Section header */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.14em', color: '#6b6b7a', marginBottom: 10 }}>
            INTERVIEW MODES
          </p>
          <h2 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.025em', color: '#f0f0f0', margin: 0 }}>
            Every format that stands between<br />you and the offer.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {MODES.map((mode, i) => (
            <Link
              key={mode.title}
              to={mode.href}
              style={{ textDecoration: 'none' }}
              onMouseEnter={() => setHoveredMode(i)}
              onMouseLeave={() => setHoveredMode(null)}
            >
              <div
                style={{
                  padding: '28px 24px',
                  borderRadius: 14,
                  border: `1px solid ${hoveredMode === i ? mode.accentBorder : '#2a2a2e'}`,
                  background: hoveredMode === i ? mode.accentBg : '#141416',
                  boxShadow: hoveredMode === i ? `0 0 28px ${mode.accentGlow}` : 'none',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    border: `1px solid ${mode.accentBorder}`,
                    background: mode.accentBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: mode.accent,
                  }}
                >
                  {mode.icon}
                </div>

                <div style={{ flex: 1 }}>
                  <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: '1rem', color: '#f0f0f0', margin: '0 0 6px' }}>
                    {mode.title}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#6b6b7a', lineHeight: 1.55, margin: 0 }}>
                    {mode.desc}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: mode.accent }}>
                    {mode.count}
                  </span>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={hoveredMode === i ? mode.accent : '#52525b'} style={{ transition: 'stroke 0.2s, transform 0.2s', transform: hoveredMode === i ? 'translateX(2px)' : 'none' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '80px 24px', borderTop: '1px solid #1c1c1f', borderBottom: '1px solid #1c1c1f', background: '#0f0f11' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 40 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    border: '1px solid #2a2a2e',
                    background: '#141416',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#7c3aed',
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: '1.05rem', color: '#f0f0f0', margin: '0 0 6px' }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#6b6b7a', lineHeight: 1.6, margin: 0 }}>
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo Carousel ────────────────────────────────────────────────────── */}
      <section id="demo" style={{ padding: '100px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.14em', color: '#6b6b7a', marginBottom: 10 }}>
            LIVE PREVIEW
          </p>
          <h2 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.025em', color: '#f0f0f0', margin: 0 }}>
            See exactly how you're scored,<br />in real time.
          </h2>
        </div>

        <div
          style={{ border: '1px solid #2a2a2e', borderRadius: 16, background: '#141416', overflow: 'hidden', userSelect: 'none' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Mode tabs */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a2a2e', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DEMO_SLIDES.map((s, i) => (
              <button
                key={s.mode}
                onClick={() => setDemoIdx(i)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 100,
                  border: `1px solid ${i === demoIdx ? s.accent : '#2a2a2e'}`,
                  background: i === demoIdx ? `rgba(${s.accent === '#7c3aed' ? '124,58,237' : s.accent === '#06b6d4' ? '6,182,212' : s.accent === '#f59e0b' ? '245,158,11' : '16,185,129'},0.15)` : 'transparent',
                  color: i === demoIdx ? s.accent : '#52525b',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                {s.mode}
              </button>
            ))}
          </div>

          <div style={{ padding: '24px' }}>
            {/* Question */}
            <div style={{ padding: '12px 16px', border: '1px solid #2a2a2e', borderRadius: 8, background: '#1c1c1f', marginBottom: 20 }}>
              <p style={{ fontSize: '0.85rem', color: '#a1a1aa', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
                "{slide.question}"
              </p>
            </div>

            {slide.soon ? (
              /* LeetCode coming soon */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 12 }}>
                <div style={{
                  padding: '8px 20px', borderRadius: 8,
                  border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)',
                  color: '#10b981', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', fontWeight: 700,
                }}>
                  LIVE NOW
                </div>
                <p style={{ color: '#6b6b7a', fontSize: '0.875rem', textAlign: 'center', maxWidth: 240, margin: 0 }}>
                  LeetCode mode with live AI voice interviewer is available. Try it →
                </p>
                <button
                  onClick={() => navigate('/practice/leetcode')}
                  style={{
                    marginTop: 4, padding: '8px 20px', borderRadius: 8,
                    border: '1px solid #10b981', background: 'transparent',
                    color: '#34d399', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}
                >
                  Open LeetCode →
                </button>
              </div>
            ) : (
              <>
                {/* Header row — overall score */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: '#52525b', marginBottom: 4 }}>
                      AI FEEDBACK · STAR SCORE
                    </p>
                    <p style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: '1rem', color: '#f0f0f0', margin: 0 }}>
                      {slide.mode} Interview
                    </p>
                  </div>
                  <div style={{
                    width: 56, height: 56, borderRadius: 12, flexShrink: 0,
                    border: `1px solid ${slide.accent}40`,
                    background: `rgba(${slide.accent === '#7c3aed' ? '124,58,237' : slide.accent === '#06b6d4' ? '6,182,212' : slide.accent === '#f59e0b' ? '245,158,11' : '16,185,129'},0.1)`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: '1.6rem', color: '#f0f0f0', lineHeight: 1 }}>{slide.overall}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: '#52525b', marginTop: 2 }}>/5</span>
                  </div>
                </div>

                {/* STAR bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  {slide.bars.map(bar => (
                    <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                        background: bar.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                          {bar.label[0]}
                        </span>
                      </div>
                      <span style={{ width: 68, flexShrink: 0, fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>{bar.label}</span>
                      <div style={{ flex: 1, height: 5, background: '#1c1c1f', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(bar.score / 5) * 100}%`, background: bar.color, borderRadius: 3, transition: 'width 0.5s ease-out' }} />
                      </div>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: bar.color, fontWeight: 700, flexShrink: 0 }}>{bar.score}</span>
                    </div>
                  ))}
                </div>

                {/* Coaching note */}
                <div style={{
                  padding: '12px 16px', borderRadius: 8,
                  border: `1px solid ${slide.accent}30`,
                  background: `rgba(${slide.accent === '#7c3aed' ? '124,58,237' : slide.accent === '#06b6d4' ? '6,182,212' : slide.accent === '#f59e0b' ? '245,158,11' : '16,185,129'},0.05)`,
                }}>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: slide.accent, marginBottom: 6 }}>
                    COACHING NOTE
                  </p>
                  <p style={{ fontSize: '0.82rem', color: '#a1a1aa', lineHeight: 1.55, margin: 0 }}>{slide.note}</p>
                </div>
              </>
            )}

            {/* Prev / Next + dots */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
              <button
                onClick={prevDemo}
                aria-label="Previous"
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: '1px solid #2a2a2e', background: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#6b6b7a', transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#52525b'; e.currentTarget.style.color = '#f0f0f0' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2e'; e.currentTarget.style.color = '#6b6b7a' }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {DEMO_SLIDES.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setDemoIdx(i)}
                    aria-label={`Go to ${s.mode}`}
                    style={{
                      borderRadius: 100,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      width: i === demoIdx ? 20 : 8,
                      height: 8,
                      background: i === demoIdx ? s.accent : '#2a2a2e',
                    }}
                  />
                ))}
              </div>

              <button
                onClick={nextDemo}
                aria-label="Next"
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: '1px solid #2a2a2e', background: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#6b6b7a', transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#52525b'; e.currentTarget.style.color = '#f0f0f0' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2e'; e.currentTarget.style.color = '#6b6b7a' }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Founder Story ────────────────────────────────────────────────────── */}
      <section style={{ background: '#0f0f11', borderTop: '1px solid #1c1c1f', borderBottom: '1px solid #1c1c1f', padding: '80px 24px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.14em', color: '#52525b', marginBottom: 24 }}>
            FOUNDER STORY
          </p>

          {/* Decorative quote mark */}
          <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: '4.5rem', lineHeight: 1, color: 'rgba(124,58,237,0.22)', marginBottom: 8, userSelect: 'none' }}>
            "
          </div>

          {/* Quote body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
            <p style={{ fontSize: '1rem', color: '#a1a1aa', lineHeight: 1.75, margin: 0 }}>
              I walked into a full-loop interview thinking I was ready. I'd ground out LeetCode problems, re-read my resume, rehearsed answers in my head. Then the first behavioral question hit — <em style={{ color: '#d4d4d8' }}>"Tell me about a time you showed leadership"</em> — and I just... rambled. No structure. No impact. I knew the material. I just couldn't deliver it under pressure.
            </p>
            <p style={{ fontSize: '1rem', color: '#a1a1aa', lineHeight: 1.75, margin: 0 }}>
              After that humbling experience I researched everything I could about what actually works. The answer was always the same: mock interviews. Real, timed, out-loud reps with someone who gives you hard feedback. But everyone I knew was too busy, and the platforms that offered mock sessions felt awkward, expensive, and impossible to schedule.
            </p>
            <p style={{ fontSize: '1rem', color: '#a1a1aa', lineHeight: 1.75, margin: 0 }}>
              So I built Starboard — the AI interviewer I wish I'd had. Now I practice out loud, get scored on the STAR framework after every answer, and know exactly what to fix before the next interview. No scheduling. No awkwardness.{' '}
              <span style={{ color: '#f0f0f0', fontWeight: 500 }}>Just reps that build real confidence.</span>
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#2a2a2e', marginBottom: 24 }} />

          {/* Attribution */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(124,58,237,0.15)',
              border: '1px solid rgba(124,58,237,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: '0.82rem', color: '#a78bfa' }}>AP</span>
            </div>
            <div>
              <p style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: '0.95rem', color: '#f0f0f0', margin: '0 0 2px' }}>
                Andrew Pham
              </p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.08em', color: '#52525b', margin: 0 }}>
                SOFTWARE ENGINEER · FOUNDER OF STARBOARD
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: '100px 24px',
          textAlign: 'center',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(124,58,237,0.12) 0%, transparent 60%), #0c0c0e',
          borderTop: '1px solid #1c1c1f',
        }}
      >
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <h2
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: '#f0f0f0',
              marginBottom: 16,
            }}
          >
            Ready to practice?
          </h2>
          <p style={{ color: '#6b6b7a', fontSize: '1rem', marginBottom: 36 }}>
            Pick a question, speak your answer, get instant AI feedback — free, no signup.
          </p>
          <button
            onClick={() => navigate('/practice/behavioral')}
            style={{
              padding: '15px 36px',
              borderRadius: 12,
              border: 'none',
              background: '#7c3aed',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s, transform 0.15s',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#6d28d9'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#7c3aed'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Start free →
          </button>
          <p style={{ fontSize: '0.8rem', color: '#3f3f46', marginTop: 16 }}>
            Join 1,000+ candidates practicing with Starboard
          </p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid #1c1c1f', padding: '28px 24px' }}>
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StarboardLogo size={20} />
            <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: '0.9rem', color: '#52525b' }}>
              starboard
            </span>
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {['Privacy', 'Terms', 'GitHub'].map((link) => (
              <a
                key={link}
                href="#"
                style={{ fontSize: '0.8rem', color: '#3f3f46', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#6b6b7a')}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#3f3f46')}
              >
                {link}
              </a>
            ))}
          </div>

          <span style={{ fontSize: '0.78rem', color: '#3f3f46' }}>© 2026 Starboard</span>
        </div>
      </footer>
    </div>
  )
}
