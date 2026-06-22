import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Session {
  id: string
  type: 'behavioral' | 'leetcode'
  question: string
  transcript: string | null
  score: Record<string, unknown>
  created_at: string
}

interface BehavioralScore {
  situation: number; task: number; action: number; result: number
  feedback?: string
  rewrite?: { situation: string; task: string; action: string; result: string }
}

interface LeetCodeScore {
  clarification?: number; communication?: number; solution_quality?: number
  complexity_analysis?: number; follow_up_handling?: number; adaptability?: number
  feedback?: string; model_approach?: string; follow_up_answer?: string
}

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const ds = {
  bg: '#0c0c0e', surface: '#141416', surface2: '#1c1c1f',
  border: '#2a2a2e', text: '#f0f0f0', muted: '#6b6b7a',
  accent: '#7c3aed', cyan: '#06b6d4', emerald: '#10b981',
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase()
}

function avgBehavioralScore(s: BehavioralScore) {
  return (s.situation + s.task + s.action + s.result) / 4
}

function avgLeetCodeScore(s: LeetCodeScore) {
  const dims = [s.clarification, s.communication, s.solution_quality, s.complexity_analysis, s.follow_up_handling, s.adaptability].filter((v): v is number => v != null)
  return dims.length ? dims.reduce((a, b) => a + b, 0) / dims.length : 0
}

function overallScore(session: Session): number {
  if (session.type === 'behavioral') return avgBehavioralScore(session.score as unknown as BehavioralScore)
  return avgLeetCodeScore(session.score as unknown as LeetCodeScore)
}

function scorePill(val: number) {
  const color = val >= 4 ? ds.emerald : val >= 3 ? '#f59e0b' : '#ef4444'
  const bg = val >= 4 ? 'rgba(16,185,129,0.12)' : val >= 3 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'
  return { color, bg }
}

/* ─── Sparkline SVG ──────────────────────────────────────────────────────── */
function Sparkline({ values, accent }: { values: number[]; accent: string }) {
  if (values.length < 2) return null
  const w = 120, h = 32, pad = 4
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  )
}

/* ─── STAR dimension bar ─────────────────────────────────────────────────── */
function DimBar({ label, value, tag }: { label: string; value: number; tag?: string }) {
  const pct = (value / 5) * 100
  const color = tag === 'best' ? ds.emerald : tag === 'worst' ? '#ef4444' : ds.accent
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tag && (
            <span style={{
              fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
              fontFamily: "'JetBrains Mono', monospace",
              padding: '2px 7px', borderRadius: 100,
              color: tag === 'best' ? ds.emerald : '#ef4444',
              background: tag === 'best' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            }}>
              {tag === 'best' ? 'STRENGTH' : 'FOCUS AREA'}
            </span>
          )}
          <span style={{ fontSize: '0.78rem', fontFamily: "'JetBrains Mono', monospace", color: ds.muted }}>{value.toFixed(1)}/5</span>
        </div>
      </div>
      <div style={{ height: 5, background: ds.surface2, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease-out' }} />
      </div>
    </div>
  )
}

/* ─── Expanded behavioral session ────────────────────────────────────────── */
function BehavioralExpanded({ score }: { score: BehavioralScore }) {
  const dims: Array<{ key: keyof BehavioralScore & ('situation' | 'task' | 'action' | 'result'); label: string }> = [
    { key: 'situation', label: 'Situation' },
    { key: 'task', label: 'Task' },
    { key: 'action', label: 'Action' },
    { key: 'result', label: 'Result' },
  ]
  return (
    <div style={{ padding: '16px 0 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {score.feedback && (
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.1em', color: ds.accent, marginBottom: 6 }}>COACHING NOTE</p>
          <p style={{ fontSize: '0.82rem', color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>{score.feedback}</p>
        </div>
      )}
      {score.rewrite && (
        <div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.1em', color: ds.muted, margin: '8px 0 10px' }}>MODEL ANSWER</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dims.map(d => score.rewrite![d.key] && (
              <div key={d.key} style={{ padding: '10px 12px', borderRadius: 8, background: ds.surface2, border: `1px solid ${ds.border}` }}>
                <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 6, background: `rgba(124,58,237,0.15)`, color: ds.accent, fontWeight: 700, fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace", textAlign: 'center', lineHeight: '20px', marginRight: 8 }}>
                  {d.key[0].toUpperCase()}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#a1a1aa', lineHeight: 1.55 }}>{score.rewrite![d.key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Expanded LeetCode session ──────────────────────────────────────────── */
function LeetCodeExpanded({ score }: { score: LeetCodeScore }) {
  return (
    <div style={{ padding: '16px 0 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {score.feedback && (
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.1em', color: ds.accent, marginBottom: 6 }}>COACHING NOTE</p>
          <p style={{ fontSize: '0.82rem', color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>{score.feedback}</p>
        </div>
      )}
      {score.follow_up_answer && (
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.2)' }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.1em', color: ds.cyan, marginBottom: 6 }}>FOLLOW-UP ANSWER</p>
          <p style={{ fontSize: '0.82rem', color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>{score.follow_up_answer}</p>
        </div>
      )}
      {score.model_approach && (
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.1em', color: ds.emerald, marginBottom: 6 }}>OPTIMAL APPROACH</p>
          <p style={{ fontSize: '0.82rem', color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>{score.model_approach}</p>
        </div>
      )}
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true })
  }, [user, authLoading])

  useEffect(() => {
    if (!user) return
    supabase
      .from('interview_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSessions((data ?? []) as Session[])
        setLoadingSessions(false)
      })
  }, [user])

  if (authLoading || (!user && !authLoading)) return null

  const behavioral = sessions.filter(s => s.type === 'behavioral')
  const leetcode = sessions.filter(s => s.type === 'leetcode')

  /* STAR averages */
  const starAvgs = (() => {
    if (!behavioral.length) return null
    const keys = ['situation', 'task', 'action', 'result'] as const
    const avgs = keys.map(k => {
      const vals = behavioral.map(s => (s.score as unknown as BehavioralScore)[k]).filter((v): v is number => typeof v === 'number')
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    })
    const maxIdx = avgs.indexOf(Math.max(...avgs))
    const minIdx = avgs.indexOf(Math.min(...avgs))
    return keys.map((k, i) => ({
      key: k, label: k.charAt(0).toUpperCase() + k.slice(1), avg: avgs[i],
      tag: i === maxIdx ? 'best' : i === minIdx ? 'worst' : undefined,
    }))
  })()

  /* Trend */
  const sparkValues = [...behavioral].reverse().slice(-8).map(s => avgBehavioralScore(s.score as unknown as BehavioralScore))
  const trend = (() => {
    if (sparkValues.length < 4) return null
    const half = Math.floor(sparkValues.length / 2)
    const first = sparkValues.slice(0, half).reduce((a, b) => a + b, 0) / half
    const second = sparkValues.slice(half).reduce((a, b) => a + b, 0) / (sparkValues.length - half)
    const diff = second - first
    if (diff > 0.2) return { label: '↑ Improving', color: ds.emerald }
    if (diff < -0.2) return { label: '↓ Declining', color: '#ef4444' }
    return { label: '→ Steady', color: '#f59e0b' }
  })()

  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: ds.muted }
  const card: React.CSSProperties = { border: `1px solid ${ds.border}`, borderRadius: 12, background: ds.surface, padding: '20px 24px', marginBottom: 12 }

  return (
    <div style={{ minHeight: '100vh', background: ds.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Navbar */}
      <header style={{ borderBottom: `1px solid ${ds.border}`, background: ds.surface, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="#2a2a2e" strokeWidth="1.5" />
            <line x1="14" y1="4" x2="14" y2="10" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="14" y1="18" x2="14" y2="24" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="4" y1="14" x2="10" y2="14" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="14" y1="14" x2="22" y2="14" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
            <polygon points="20,11 24,14 20,17" fill="#7c3aed" />
            <circle cx="14" cy="14" r="2.5" fill="white" />
          </svg>
          <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: '1rem', color: ds.text, letterSpacing: '-0.02em' }}>starboard</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/practice/behavioral')} style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${ds.border}`, background: 'transparent', color: ds.muted, fontSize: '0.82rem', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", transition: 'color 0.15s, border-color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = ds.text; e.currentTarget.style.borderColor = '#52525b' }}
            onMouseLeave={e => { e.currentTarget.style.color = ds.muted; e.currentTarget.style.borderColor = ds.border }}
          >Practice</button>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa', fontWeight: 700, fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace" }}>
            {initials(user!.email ?? 'U')}
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => navigate('/'))} style={{ background: 'none', border: 'none', color: ds.muted, fontSize: '0.82rem', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
            Sign out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>

        {/* Welcome */}
        <div style={{ marginBottom: 28 }}>
          <p style={mono}>DASHBOARD</p>
          <h1 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: '1.6rem', color: ds.text, margin: '6px 0 4px', letterSpacing: '-0.02em' }}>
            Welcome back
          </h1>
          <p style={{ color: ds.muted, fontSize: '0.85rem', margin: 0 }}>
            {sessions.length === 0 ? 'No sessions yet. Start practicing to see your progress.' : `${sessions.length} session${sessions.length === 1 ? '' : 's'} total · ${behavioral.length} behavioral · ${leetcode.length} LeetCode`}
          </p>
        </div>

        {/* Empty state */}
        {!loadingSessions && sessions.length === 0 && (
          <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ color: ds.muted, fontSize: '0.9rem', margin: '0 0 20px' }}>Complete your first interview to unlock analytics.</p>
            <button onClick={() => navigate('/practice/behavioral')} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: ds.accent, color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
              Start practicing →
            </button>
          </div>
        )}

        {/* STAR Strength Panel */}
        {starAvgs && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={mono}>STAR BREAKDOWN</p>
                <p style={{ color: '#52525b', fontSize: '0.72rem', margin: '3px 0 0', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em' }}>{behavioral.length} behavioral sessions</p>
              </div>
              {trend && sparkValues.length >= 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <Sparkline values={sparkValues} accent={trend.color} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: trend.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em' }}>{trend.label}</span>
                </div>
              )}
            </div>
            {starAvgs.map(d => (
              <DimBar key={d.key} label={d.label} value={d.avg} tag={d.tag} />
            ))}
          </div>
        )}

        {/* Session list */}
        {sessions.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ ...mono, marginBottom: 14 }}>RECENT SESSIONS</p>
            {loadingSessions ? (
              <div style={{ ...card, color: ds.muted, fontSize: '0.85rem' }}>Loading…</div>
            ) : (
              sessions.map(s => {
                const overall = overallScore(s)
                const pill = scorePill(overall)
                const expanded = expandedId === s.id
                return (
                  <div key={s.id} style={{ ...card, padding: '16px 20px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3f3f46' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = ds.border }}
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Type badge */}
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', fontWeight: 700,
                        letterSpacing: '0.08em', padding: '3px 8px', borderRadius: 100, flexShrink: 0,
                        color: s.type === 'behavioral' ? '#a78bfa' : '#34d399',
                        background: s.type === 'behavioral' ? 'rgba(124,58,237,0.1)' : 'rgba(16,185,129,0.1)',
                      }}>
                        {s.type === 'behavioral' ? 'BEHAVIORAL' : 'LEETCODE'}
                      </span>

                      {/* Question */}
                      <span style={{ flex: 1, fontSize: '0.85rem', color: '#d4d4d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.question.length > 70 ? s.question.slice(0, 70) + '…' : s.question}
                      </span>

                      {/* Score + date + expand */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', fontWeight: 700, padding: '3px 9px', borderRadius: 100, color: pill.color, background: pill.bg }}>
                          {overall.toFixed(1)}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: ds.muted }}>{timeAgo(s.created_at)}</span>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#52525b" strokeWidth={2} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {expanded && (
                      <div onClick={e => e.stopPropagation()}>
                        {s.type === 'behavioral'
                          ? <BehavioralExpanded score={s.score as unknown as BehavioralScore} />
                          : <LeetCodeExpanded score={s.score as unknown as LeetCodeScore} />
                        }
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
