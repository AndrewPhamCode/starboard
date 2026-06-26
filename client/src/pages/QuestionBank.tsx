import { useEffect, useRef, useState } from 'react'
import { Link, useParams, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { API_URL } from '../lib/api'

interface Question {
  id: number
  type: string
  category: string
  difficulty: 'intern' | 'mid' | 'senior'
  role: 'general' | 'backend' | 'fullstack' | 'ai' | 'cloud' | 'frontend'
  text: string
}

type InterviewType = 'behavioral' | 'technical' | 'resume' | 'leetcode' | 'system-design'

const TYPE_CONFIG: Record<InterviewType, {
  label: string
  headline: string
  subheading: string
  tip: string
  accent: string
  showCategories: boolean
  categories?: string[]
  showRoles?: boolean
  showDifficulty?: boolean
  roleTips?: Record<string, string>
  showCompanySearch?: boolean
}> = {
  behavioral: {
    label: 'Behavioral',
    headline: 'Master behavioral interviews',
    subheading: 'Practice the STAR method — Situation, Task, Action, Result — until your stories land every time.',
    tip: 'Be specific. Interviewers want real examples with measurable results, not hypotheticals.',
    accent: '#7c3aed',
    showCategories: true,
    categories: ['introduction', 'leadership', 'conflict', 'failure', 'teamwork', 'impact'],
    showCompanySearch: true,
    showDifficulty: true,
  },
  technical: {
    label: 'Technical',
    headline: 'Practice technical interviews',
    subheading: 'System design, debugging, and architecture questions scored on clarity, depth, and structure.',
    tip: 'Start with clarifying questions, then walk through trade-offs before committing to a design.',
    accent: '#06b6d4',
    showCategories: false,
    showCompanySearch: true,
    showRoles: true,
    showDifficulty: true,
    roleTips: {
      general: 'Start with clarifying questions, then walk through trade-offs before committing to a design.',
      backend: 'Cover API contracts, data models, and failure modes. Interviewers want to see you reason about consistency and scale.',
      fullstack: 'Show you can reason across the stack — mention how frontend state, API design, and backend data models interact.',
      ai: 'Ground your answers in real trade-offs: latency vs. accuracy, cost of retraining, and how you evaluate model quality in production.',
      cloud: 'Lead with the SLA/SLO requirements — the right AWS service usually follows from the availability and latency targets.',
      frontend: 'Interviewers want to see you reason about rendering performance, accessibility, and state management as first-class concerns.',
    },
  },
  resume: {
    label: 'Resume',
    headline: 'Ace your resume walkthrough',
    subheading: 'Walk through your experience with confidence. Turn every bullet point on your resume into a compelling story.',
    tip: 'For each project, lead with the impact before the implementation details.',
    accent: '#10b981',
    showCategories: false,
  },
  leetcode: {
    label: 'LeetCode',
    headline: 'LeetCode interview mode',
    subheading: '',
    tip: '',
    accent: '#10b981',
    showCategories: false,
  },
  'system-design': {
    label: 'System Design',
    headline: 'Ace system design rounds',
    subheading: 'Practice open-ended architecture questions scored on clarity, depth, trade-offs, and scalability thinking.',
    tip: 'Always start by clarifying scope, users, and scale before jumping into a solution.',
    accent: '#f97316',
    showCategories: true,
    categories: ['scalability', 'databases', 'caching', 'api-design', 'microservices', 'distributed-systems'],
    showCompanySearch: true,
    showDifficulty: true,
  },
}

interface LeetCodeProblem {
  id: number
  slug: string
  title: string
  difficulty: string
  category: string
  neetcode_number: number
  description: string
  examples: Array<{ input: string; output: string; explanation?: string }>
  constraints: string[]
  follow_up_hints: string[]
  starter_code: { python: string; javascript: string; java: string; cpp: string }
}

const VALID_TYPES: InterviewType[] = ['behavioral', 'technical', 'resume', 'leetcode', 'system-design']

function pickRandom<T>(arr: T[]): T | null {
  if (!arr.length) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

/* ─── Shared dark style tokens ─────────────────────────────────────────────── */
const ds = {
  surface: { background: '#141416', border: '1px solid #2a2a2e', borderRadius: 12 },
  text: '#f0f0f0',
  muted: '#6b6b7a',
  dimmer: '#52525b',
  mono: { fontFamily: "'JetBrains Mono', monospace" },
}

/* ─── Dark dropdown ─────────────────────────────────────────────────────────── */
function DarkSelect({
  value, onChange, options, accent,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  accent: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find(o => o.value === value) ?? options[0]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderRadius: 8,
          border: `1px solid ${open ? accent : '#2a2a2e'}`,
          background: '#141416',
          color: '#f0f0f0',
          fontSize: '0.875rem',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'border-color 0.15s',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <span>{selected.label}</span>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#6b6b7a"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          zIndex: 20,
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: '#141416',
          border: `1px solid ${accent}`,
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                background: o.value === value ? `rgba(${accent === '#7c3aed' ? '124,58,237' : accent === '#06b6d4' ? '6,182,212' : '16,185,129'},0.12)` : 'transparent',
                color: o.value === value ? '#f0f0f0' : '#a1a1aa',
                border: 'none',
                transition: 'background 0.1s',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
              onMouseEnter={(e) => { if (o.value !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={(e) => { if (o.value !== value) e.currentTarget.style.background = 'transparent' }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Pill filter button ────────────────────────────────────────────────────── */
function PillBtn({
  active, accent, onClick, children,
}: {
  active: boolean
  accent: string
  onClick: () => void
  children: React.ReactNode
}) {
  const accentRgba = accent === '#7c3aed' ? '124,58,237'
    : accent === '#06b6d4' ? '6,182,212'
    : accent === '#f59e0b' ? '245,158,11'
    : '16,185,129'

  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px',
        borderRadius: 8,
        border: `1px solid ${active ? accent : '#2a2a2e'}`,
        background: active ? `rgba(${accentRgba},0.12)` : 'transparent',
        color: active ? accent === '#06b6d4' ? '#67e8f9' : accent === '#7c3aed' ? '#a78bfa' : accent === '#f59e0b' ? '#fbbf24' : '#34d399' : '#6b6b7a',
        fontSize: '0.82rem',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {children}
    </button>
  )
}

/* ─── Difficulty dot ─────────────────────────────────────────────────────────── */
function DiffBadge({ d }: { d: string }) {
  const map = {
    easy: { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    hard: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  }
  const s = map[d.toLowerCase() as keyof typeof map]
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 100,
      fontSize: '0.7rem',
      fontWeight: 700,
      background: s.bg,
      color: s.color,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {d}
    </span>
  )
}

/* ─── Spinner ─────────────────────────────────────────────────────────────────── */
function Spinner({ color }: { color: string }) {
  return (
    <svg className="animate-spin" width="20" height="20" fill="none" viewBox="0 0 24 24" style={{ color }}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

/* ─── LeetCode problem browser ──────────────────────────────────────────────── */
function LeetCodeBrowser({ accent }: { accent: string }) {
  const navigate = useNavigate()
  const [problems, setProblems] = useState<LeetCodeProblem[]>([])
  const [loading, setLoading] = useState(true)
  const [diffFilter, setDiffFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')
  const [catFilter, setCatFilter] = useState('all')

  useEffect(() => {
    fetch(`${API_URL}/api/leetcode/problems`)
      .then(r => r.json())
      .then(setProblems)
      .finally(() => setLoading(false))
  }, [])

  const categories = ['all', ...Array.from(new Set(problems.map(p => p.category)))]

  const filtered = problems.filter(p => {
    if (diffFilter !== 'all' && p.difficulty !== diffFilter) return false
    if (catFilter !== 'all' && p.category !== catFilter) return false
    return true
  })

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: '1.6rem', color: '#f0f0f0', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          LeetCode Interview Mode
        </h1>
        <p style={{ color: '#6b6b7a', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
          Practice coding problems with a live AI interviewer — explain your thinking, ask clarifying questions, and get scored on communication and complexity analysis.
        </p>
      </div>

      {/* Difficulty filter */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: '#52525b', marginBottom: 8 }}>DIFFICULTY</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'easy', 'medium', 'hard'] as const).map(d => {
            const dAccent = d === 'easy' ? '#10b981' : d === 'medium' ? '#f59e0b' : d === 'hard' ? '#ef4444' : accent
            return (
              <PillBtn key={d} active={diffFilter === d} accent={dAccent} onClick={() => setDiffFilter(d)}>
                {d === 'all' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
              </PillBtn>
            )
          })}
        </div>
      </div>

      {/* Category filter */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: '#52525b', marginBottom: 8 }}>CATEGORY</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categories.map(c => (
            <PillBtn key={c} active={catFilter === c} accent={accent} onClick={() => setCatFilter(c)}>
              {c === 'all' ? 'All' : c.replace(/-/g, ' ')}
            </PillBtn>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Spinner color={accent} />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: '#52525b', padding: '32px 0', fontSize: '0.875rem' }}>No problems match these filters.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(p => (
          <div
            key={p.id}
            onClick={() => navigate('/practice/leetcode/session', { state: { problem: p } })}
            style={{
              padding: '14px 18px',
              border: '1px solid #2a2a2e',
              borderRadius: 10,
              background: '#141416',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement
              el.style.borderColor = 'rgba(16,185,129,0.4)'
              el.style.background = 'rgba(16,185,129,0.04)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement
              el.style.borderColor = '#2a2a2e'
              el.style.background = '#141416'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: '#52525b', flexShrink: 0 }}>
                #{p.neetcode_number}
              </span>
              <span style={{ fontWeight: 600, color: '#f0f0f0', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.title}
              </span>
              <DiffBadge d={p.difficulty} />
              <span style={{ fontSize: '0.75rem', color: '#52525b', flexShrink: 0, display: 'none' }} className="sm:block">
                {p.category.replace(/-/g, ' ')}
              </span>
            </div>
            <button
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${accent}`,
                background: 'transparent',
                color: '#34d399',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                fontFamily: "'Inter', system-ui, sans-serif",
                transition: 'background 0.15s',
              }}
              onClick={e => { e.stopPropagation(); navigate('/practice/leetcode/session', { state: { problem: p } }) }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Solve →
            </button>
          </div>
        ))}
      </div>

      {!loading && (
        <p style={{ marginTop: 16, textAlign: 'center', fontSize: '0.75rem', color: '#3f3f46' }}>
          {filtered.length} problem{filtered.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

/* ─── Page entry ─────────────────────────────────────────────────────────────── */
export default function QuestionBank() {
  const { type } = useParams<{ type: string }>()

  if (!type || !VALID_TYPES.includes(type as InterviewType)) {
    return <Navigate to="/" replace />
  }

  const interviewType = type as InterviewType
  const cfg = TYPE_CONFIG[interviewType]
  return <PracticeView interviewType={interviewType} cfg={cfg} />
}

function PracticeView({
  interviewType,
  cfg,
}: {
  interviewType: InterviewType
  cfg: (typeof TYPE_CONFIG)[InterviewType]
}) {
  const navigate = useNavigate()
  const touchStartX = useRef<number | null>(null)
  const currentIdx = VALID_TYPES.indexOf(interviewType)
  function goType(dir: 1 | -1) {
    const next = VALID_TYPES[(currentIdx + dir + VALID_TYPES.length) % VALID_TYPES.length]
    navigate(`/practice/${next}`, { replace: true })
  }
  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 48) goType(dx < 0 ? 1 : -1)
    touchStartX.current = null
  }
  const [category, setCategory] = useState('')
  const [role, setRole] = useState('general')
  const [difficulty, setDifficulty] = useState('mid')
  const [companyInput, setCompanyInput] = useState('')
  const [activeCompany, setActiveCompany] = useState('')
  const [companyStyleNote, setCompanyStyleNote] = useState('')
  const [companyLoading, setCompanyLoading] = useState(false)
  const [companyError, setCompanyError] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeFileName, setResumeFileName] = useState('')
  const [resumeError, setResumeError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [savedResumeUrl, setSavedResumeUrl] = useState<string | null>(null)
  const [_savedResumeChecked] = useState(true) // kept for future use; upload zone shows immediately
  const [showUploadZone, setShowUploadZone] = useState(false)

  const { accent } = cfg

  // Silently check for saved resume — upload zone shows immediately, notice replaces it if found
  useEffect(() => {
    if (interviewType !== 'resume') return
    supabase.auth.getUser().then(async ({ data }) => {
      try {
        if (!data.user) return
        const { data: urlData, error } = await supabase.storage
          .from('resumes')
          .createSignedUrl(`${data.user.id}/resume.pdf`, 3600)
        if (error || !urlData?.signedUrl) return
        setSavedResumeUrl(urlData.signedUrl)
        const blob = await fetch(urlData.signedUrl).then(r => r.blob())
        const file = new File([blob], 'saved-resume.pdf', { type: 'application/pdf' })
        handleResumeUpload(file)
      } catch {
        // Silently fall back — upload zone is already visible
      }
    }).catch(() => {})
  }, [interviewType])

  useEffect(() => {
    if (interviewType === 'leetcode' || interviewType === 'resume') { setLoading(false); return }
    if (activeCompany) return
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ type: interviewType })
    if (category) params.set('category', category)
    params.set('difficulty', difficulty)
    if (interviewType === 'technical') {
      if (role !== 'general') params.set('role', role)
    }
    fetch(`${API_URL}/api/questions?${params}`)
      .then((r) => { if (!r.ok) throw new Error('Failed to load questions'); return r.json() })
      .then((data: Question[]) => { setQuestions(data); setCurrent(pickRandom(data)) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [interviewType, category, role, difficulty, activeCompany])

  async function searchCompany(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    setCompanyLoading(true)
    setCompanyError('')
    setCompanyInput(trimmed)
    try {
      const res = await fetch(`${API_URL}/api/company/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: trimmed, type: interviewType, role, difficulty }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail ?? `Server error ${res.status}`)
      }
      const { questions: qs, style_note } = await res.json()
      setQuestions(qs)
      setCurrent(pickRandom(qs))
      setActiveCompany(trimmed)
      setCompanyStyleNote(style_note ?? '')
    } catch (e) {
      setCompanyError(e instanceof Error ? e.message : 'Failed to load company questions.')
    } finally {
      setCompanyLoading(false)
    }
  }

  function clearCompany() {
    setActiveCompany('')
    setCompanyStyleNote('')
    setCompanyInput('')
    setCompanyError('')
  }

  async function handleResumeUpload(file: File) {
    if (!file.name.endsWith('.pdf')) { setResumeError('Please upload a PDF file.'); return }
    setResumeUploading(true)
    setResumeError('')
    setResumeFileName(file.name)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_URL}/api/resume/questions`, { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail ?? `Server error ${res.status}`)
      }
      const { questions: qs } = await res.json()
      setQuestions(qs)
      setCurrent(pickRandom(qs))
    } catch (e) {
      setResumeError(e instanceof Error ? e.message : 'Upload failed.')
      setResumeFileName('')
    } finally {
      setResumeUploading(false)
    }
  }

  const handleNew = () => {
    const next = pickRandom(questions.filter((q) => q.id !== current?.id))
    setCurrent(next ?? pickRandom(questions))
  }

  const tip = cfg.showRoles && cfg.roleTips ? (cfg.roleTips[role] ?? cfg.tip) : cfg.tip

  return (
    <div
      style={{ minHeight: '100vh', background: '#0c0c0e', fontFamily: "'Inter', system-ui, sans-serif" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >

      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        borderBottom: '1px solid #1c1c1f',
        background: 'rgba(12,12,14,0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#6b6b7a',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#f0f0f0')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#6b6b7a')}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back
          </Link>
          <div style={{ width: 1, height: 16, background: '#2a2a2e' }} />

          {/* Type switcher */}
          <button
            onClick={() => goType(-1)}
            title="Previous mode"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', color: '#52525b', display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f0f0f0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: '0.9rem', color: '#f0f0f0', minWidth: 100, textAlign: 'center' }}>
            {cfg.label}
          </span>
          <button
            onClick={() => goType(1)}
            title="Next mode"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', color: '#52525b', display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f0f0f0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          <div style={{
            marginLeft: 'auto',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: accent,
            boxShadow: `0 0 6px ${accent}`,
          }} />
        </div>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>

        {/* Page intro */}
        {interviewType !== 'leetcode' && (
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: '1.6rem', color: '#f0f0f0', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              {cfg.headline}
            </h1>
            <p style={{ color: '#6b6b7a', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>{cfg.subheading}</p>
          </div>
        )}

        {/* LeetCode problem browser */}
        {interviewType === 'leetcode' && <LeetCodeBrowser accent={accent} />}

        {interviewType !== 'leetcode' && (
          <>
            {/* Company search */}
            {cfg.showCompanySearch && (
              <div style={{ marginBottom: 20 }}>
                {!activeCompany ? (
                  <div style={{ ...ds.surface, padding: '18px 20px' }}>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: '#52525b', marginBottom: 12 }}>
                      SEARCH BY COMPANY
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <input
                        type="text"
                        value={companyInput}
                        onChange={e => setCompanyInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && searchCompany(companyInput)}
                        placeholder="e.g. Google, Amazon, Stripe…"
                        style={{
                          flex: 1,
                          padding: '9px 14px',
                          borderRadius: 8,
                          border: '1px solid #2a2a2e',
                          background: '#0c0c0e',
                          color: '#f0f0f0',
                          fontSize: '0.875rem',
                          outline: 'none',
                          fontFamily: "'Inter', system-ui, sans-serif",
                          transition: 'border-color 0.15s',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = accent }}
                        onBlur={(e) => { e.target.style.borderColor = '#2a2a2e' }}
                      />
                      <button
                        onClick={() => searchCompany(companyInput)}
                        disabled={companyLoading || !companyInput.trim()}
                        style={{
                          padding: '9px 18px',
                          borderRadius: 8,
                          border: 'none',
                          background: accent,
                          color: '#fff',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          opacity: (companyLoading || !companyInput.trim()) ? 0.5 : 1,
                          fontFamily: "'Inter', system-ui, sans-serif",
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {companyLoading ? <Spinner color="#fff" /> : 'Search'}
                      </button>
                    </div>

                    {/* Quick picks */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {['Google', 'Amazon', 'Meta', 'Microsoft', 'Apple', 'Stripe', 'Airbnb', 'Uber'].map(c => (
                        <button
                          key={c}
                          onClick={() => searchCompany(c)}
                          disabled={companyLoading}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid #2a2a2e',
                            background: 'transparent',
                            color: '#6b6b7a',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            fontFamily: "'Inter', system-ui, sans-serif",
                            transition: 'border-color 0.15s, color 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = '#f0f0f0' }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2e'; e.currentTarget.style.color = '#6b6b7a' }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>

                    {companyError && (
                      <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#f87171', fontSize: '0.85rem' }}>
                        {companyError}
                      </div>
                    )}
                    {companyLoading && (
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, color: '#6b6b7a', fontSize: '0.85rem' }}>
                        <Spinner color={accent} />
                        Generating {companyInput} questions…
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ ...ds.surface, padding: '14px 18px', borderColor: `${accent}40` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: companyStyleNote ? 8 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="#fff">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                        <span style={{ fontWeight: 600, color: '#f0f0f0', fontSize: '0.875rem' }}>
                          {activeCompany} · {questions.length} questions
                        </span>
                      </div>
                      <button onClick={clearCompany} style={{ fontSize: '0.8rem', color: '#6b6b7a', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'Inter', system-ui, sans-serif" }}>
                        ← Back
                      </button>
                    </div>
                    {companyStyleNote && <p style={{ fontSize: '0.8rem', color: '#6b6b7a', lineHeight: 1.5, margin: 0 }}>{companyStyleNote}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Category filter */}
            {!activeCompany && cfg.showCategories && cfg.categories && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: '#52525b', marginBottom: 8 }}>CATEGORY</p>
                <DarkSelect
                  value={category}
                  onChange={setCategory}
                  accent={accent}
                  options={[
                    { value: '', label: 'All categories' },
                    ...cfg.categories.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
                  ]}
                />
              </div>
            )}

            {/* Resume upload */}
            {interviewType === 'resume' && (
              <div style={{ marginBottom: 20 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f) }}
                />

                {/* Saved resume notice */}
                {savedResumeUrl && !showUploadZone && !resumeFileName && resumeUploading && (
                  <div style={{ background: '#141416', border: `1px solid #2a2a2e`, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 0 }}>
                    <Spinner color={accent} />
                    <div>
                      <p style={{ fontWeight: 600, color: '#f0f0f0', fontSize: '0.875rem', margin: '0 0 2px' }}>Loading your saved resume</p>
                      <p style={{ color: accent, fontSize: '0.78rem', margin: 0 }}>Generating personalized questions…</p>
                    </div>
                  </div>
                )}

                {savedResumeUrl && !showUploadZone && !resumeUploading && !resumeFileName && (
                  <div style={{ background: '#141416', border: `1px solid ${accent}40`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `rgba(16,185,129,0.1)`, border: `1px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke={accent}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, color: '#f0f0f0', fontSize: '0.875rem', margin: '0 0 1px' }}>Using your saved resume</p>
                      <p style={{ color: '#6b6b7a', fontSize: '0.75rem', margin: 0 }}>Auto-loaded from your profile</p>
                    </div>
                    <button
                      onClick={() => { setSavedResumeUrl(null); setShowUploadZone(true) }}
                      style={{ fontSize: '0.78rem', color: '#6b6b7a', cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0, fontFamily: "'Inter', system-ui, sans-serif" }}
                    >
                      Change
                    </button>
                  </div>
                )}

                {(!savedResumeUrl || showUploadZone) && !resumeFileName && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault(); setDragOver(false)
                      const f = e.dataTransfer.files?.[0]; if (f) handleResumeUpload(f)
                    }}
                    style={{
                      border: `1px dashed ${dragOver ? accent : '#2a2a2e'}`,
                      borderRadius: 12,
                      padding: '40px 24px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: dragOver ? `rgba(16,185,129,0.05)` : 'transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, border: `1px solid ${accent}`,
                      background: `rgba(16,185,129,0.08)`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', margin: '0 auto 16px', color: accent,
                    }}>
                      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <p style={{ fontWeight: 600, color: '#f0f0f0', marginBottom: 4 }}>Upload your resume</p>
                    <p style={{ color: '#6b6b7a', fontSize: '0.85rem', margin: 0 }}>Drag and drop or click to browse · PDF only</p>
                  </div>
                )}
                {resumeUploading && (
                  <div style={{ ...ds.surface, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Spinner color={accent} />
                    <div>
                      <p style={{ fontWeight: 600, color: '#f0f0f0', fontSize: '0.875rem', margin: '0 0 2px' }}>{resumeFileName}</p>
                      <p style={{ color: accent, fontSize: '0.78rem', margin: 0 }}>Generating personalized questions…</p>
                    </div>
                  </div>
                )}
                {resumeFileName && !resumeUploading && (
                  <div style={{ ...ds.surface, padding: '14px 18px', borderColor: `${accent}40`, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `rgba(16,185,129,0.1)`, border: `1px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke={accent}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, color: '#f0f0f0', fontSize: '0.875rem', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumeFileName}</p>
                      <p style={{ color: '#6b6b7a', fontSize: '0.75rem', margin: 0 }}>{questions.length} personalized questions generated</p>
                    </div>
                    <button
                      onClick={() => { setResumeFileName(''); setQuestions([]); setCurrent(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      style={{ fontSize: '0.78rem', color: '#6b6b7a', cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0, fontFamily: "'Inter', system-ui, sans-serif" }}
                    >
                      Replace
                    </button>
                  </div>
                )}
                {resumeError && (
                  <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#f87171', fontSize: '0.85rem' }}>
                    {resumeError}
                  </div>
                )}
              </div>
            )}

            {/* Role selector */}
            {!activeCompany && cfg.showRoles && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: '#52525b', marginBottom: 8 }}>ROLE</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { value: 'general', label: 'All' },
                    { value: 'backend', label: 'Backend' },
                    { value: 'fullstack', label: 'Full Stack' },
                    { value: 'ai', label: 'AI / ML' },
                    { value: 'cloud', label: 'Cloud / AWS' },
                    { value: 'frontend', label: 'Frontend' },
                  ].map(r => (
                    <PillBtn key={r.value} active={role === r.value} accent={accent} onClick={() => setRole(r.value)}>
                      {r.label}
                    </PillBtn>
                  ))}
                </div>
              </div>
            )}

            {/* Difficulty selector */}
            {!activeCompany && cfg.showDifficulty && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: '#52525b', marginBottom: 8 }}>DIFFICULTY</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { value: 'intern', label: 'Intern' },
                    { value: 'mid', label: 'Mid-level' },
                    { value: 'senior', label: 'Senior' },
                  ].map(d => (
                    <PillBtn key={d.value} active={difficulty === d.value} accent={accent} onClick={() => setDifficulty(d.value)}>
                      {d.label}
                    </PillBtn>
                  ))}
                </div>
              </div>
            )}

            {/* Tip */}
            {!activeCompany && tip && (
              <div style={{
                padding: '12px 16px',
                border: `1px solid rgba(${accent === '#7c3aed' ? '124,58,237' : accent === '#06b6d4' ? '6,182,212' : '16,185,129'},0.2)`,
                borderRadius: 8,
                background: `rgba(${accent === '#7c3aed' ? '124,58,237' : accent === '#06b6d4' ? '6,182,212' : '16,185,129'},0.05)`,
                marginBottom: 20,
              }}>
                <p style={{ fontSize: '0.82rem', color: '#a1a1aa', lineHeight: 1.55, margin: 0 }}>
                  <span style={{ fontWeight: 600, color: accent === '#06b6d4' ? '#67e8f9' : accent === '#7c3aed' ? '#a78bfa' : '#34d399' }}>Tip: </span>
                  {tip}
                </p>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ ...ds.surface, padding: '40px', display: 'flex', justifyContent: 'center' }}>
                <Spinner color={accent} />
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ padding: '16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#f87171', fontSize: '0.875rem', textAlign: 'center' }}>
                {error}
              </div>
            )}

            {/* Question card */}
            {!loading && !error && current && (
              <div style={{ ...ds.surface, padding: '24px' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 100,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.08em',
                  background: `rgba(${accent === '#7c3aed' ? '124,58,237' : accent === '#06b6d4' ? '6,182,212' : '16,185,129'},0.12)`,
                  color: accent === '#06b6d4' ? '#67e8f9' : accent === '#7c3aed' ? '#a78bfa' : '#34d399',
                  marginBottom: 14,
                }}>
                  {current.category.replace('-', ' ')}
                </span>
                <p style={{ color: '#f0f0f0', fontSize: '1rem', fontWeight: 500, lineHeight: 1.65, margin: 0 }}>{current.text}</p>
              </div>
            )}

            {!loading && !error && !current && interviewType !== 'resume' && (
              <div style={{ ...ds.surface, padding: '32px', textAlign: 'center', color: '#52525b', fontSize: '0.875rem' }}>
                No questions found.
              </div>
            )}

            {/* Actions */}
            {!loading && !error && current && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigate(`/practice/${interviewType}/session`, { state: { question: current } })}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 10,
                    border: 'none',
                    background: accent,
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Start interview
                </button>
                {questions.length > 1 && (
                  <button
                    onClick={handleNew}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: '1px solid #2a2a2e',
                      background: 'transparent',
                      color: '#6b6b7a',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#52525b'; e.currentTarget.style.color = '#a1a1aa' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2e'; e.currentTarget.style.color = '#6b6b7a' }}
                    title="New question"
                  >
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {!loading && !error && (
              <p style={{ marginTop: 8, textAlign: 'center', fontSize: '0.72rem', color: '#3f3f46' }}>
                {questions.length} question{questions.length !== 1 ? 's' : ''} available
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
