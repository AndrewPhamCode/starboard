import { useEffect, useRef, useState } from 'react'
import { Link, useParams, Navigate, useNavigate } from 'react-router-dom'

interface Question {
  id: number
  type: string
  category: string
  difficulty: 'intern' | 'mid' | 'senior'
  role: 'general' | 'backend' | 'fullstack' | 'ai' | 'cloud' | 'frontend'
  text: string
}

type InterviewType = 'behavioral' | 'technical' | 'resume' | 'leetcode'

/* ─── Per-type config ───────────────────────────────────────────────────── */
const TYPE_CONFIG: Record<InterviewType, {
  label: string
  headline: string
  subheading: string
  tip: string
  headerBg: string
  headerBorder: string
  headerShadow: string
  badgeBg: string
  badgeText: string
  accentBg: string
  accentBorder: string
  accentShadow: string
  buttonBg: string
  buttonBorder: string
  buttonShadow: string
  spinnerBorder: string
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
    tip: 'Tip: Be specific. Interviewers want real examples with measurable results, not hypotheticals.',
    headerBg: 'bg-rose-100',
    headerBorder: 'border-rose-400',
    headerShadow: '#f87171',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-600',
    accentBg: 'bg-rose-50',
    accentBorder: 'border-rose-200',
    accentShadow: '#fca5a5',
    buttonBg: 'bg-rose-500',
    buttonBorder: 'border-rose-700',
    buttonShadow: '#9f1239',
    spinnerBorder: 'border-t-rose-600',
    showCategories: true,
    categories: ['introduction', 'leadership', 'conflict', 'failure', 'teamwork', 'impact'],
    showCompanySearch: true,
    showDifficulty: true,
  },
  technical: {
    label: 'Technical',
    headline: 'Practice technical interviews',
    subheading: 'System design, debugging, and architecture questions scored on clarity, depth, and structure.',
    tip: 'Tip: Start with clarifying questions, then walk through trade-offs before committing to a design.',
    headerBg: 'bg-violet-100',
    headerBorder: 'border-violet-400',
    headerShadow: '#a78bfa',
    badgeBg: 'bg-violet-50',
    badgeText: 'text-violet-600',
    accentBg: 'bg-violet-50',
    accentBorder: 'border-violet-200',
    accentShadow: '#c4b5fd',
    buttonBg: 'bg-violet-600',
    buttonBorder: 'border-violet-800',
    buttonShadow: '#3b0764',
    spinnerBorder: 'border-t-violet-600',
    showCategories: false,
    showCompanySearch: true,
    showRoles: true,
    showDifficulty: true,
    roleTips: {
      general: 'Tip: Start with clarifying questions, then walk through trade-offs before committing to a design.',
      backend: 'Tip: Cover API contracts, data models, and failure modes. Interviewers want to see you reason about consistency and scale.',
      fullstack: 'Tip: Show you can reason across the stack — mention how frontend state, API design, and backend data models interact.',
      ai: 'Tip: Ground your answers in real trade-offs: latency vs. accuracy, cost of retraining, and how you evaluate model quality in production.',
      cloud: 'Tip: Lead with the SLA/SLO requirements — the right AWS service usually follows from the availability and latency targets.',
      frontend: 'Tip: Interviewers want to see you reason about rendering performance, accessibility, and state management as first-class concerns.',
    },
  },
  resume: {
    label: 'Resume Screening',
    headline: 'Ace your resume walkthrough',
    subheading: 'Walk through your experience with confidence. Turn every bullet point on your resume into a compelling story.',
    tip: 'Tip: For each project, lead with the impact before the implementation details.',
    headerBg: 'bg-emerald-100',
    headerBorder: 'border-emerald-400',
    headerShadow: '#34d399',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-600',
    accentBg: 'bg-emerald-50',
    accentBorder: 'border-emerald-200',
    accentShadow: '#6ee7b7',
    buttonBg: 'bg-emerald-600',
    buttonBorder: 'border-emerald-800',
    buttonShadow: '#064e3b',
    spinnerBorder: 'border-t-emerald-600',
    showCategories: false,
  },
  leetcode: {
    label: 'LeetCode',
    headline: 'LeetCode interview mode',
    subheading: '',
    tip: '',
    headerBg: 'bg-amber-100',
    headerBorder: 'border-amber-400',
    headerShadow: '#fbbf24',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-600',
    accentBg: 'bg-amber-50',
    accentBorder: 'border-amber-200',
    accentShadow: '#fde68a',
    buttonBg: 'bg-amber-500',
    buttonBorder: 'border-amber-700',
    buttonShadow: '#92400e',
    spinnerBorder: 'border-t-amber-500',
    showCategories: false,
  },
}

interface LeetCodeProblem {
  id: number
  slug: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
  neetcode_number: number
  description: string
  examples: Array<{ input: string; output: string; explanation?: string }>
  constraints: string[]
  follow_up_hints: string[]
  starter_code: { python: string; javascript: string; java: string; cpp: string }
}

const VALID_TYPES: InterviewType[] = ['behavioral', 'technical', 'resume', 'leetcode']

function pickRandom<T>(arr: T[]): T | null {
  if (!arr.length) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

/* ─── Clay helper (inline, no extra import) ─────────────────────────────── */
function clayStyle(shadow: string) {
  return { boxShadow: `4px 4px 0px ${shadow}` }
}

/* ─── Custom clay dropdown ───────────────────────────────────────────────── */
function ClaySelect({
  value, onChange, options, cfg,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  cfg: (typeof TYPE_CONFIG)[InterviewType]
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
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between border-[3px] ${cfg.headerBorder} ${cfg.headerBg} rounded-2xl px-4 py-2.5 text-gray-800 font-bold text-sm cursor-pointer focus:outline-none`}
        style={clayStyle(cfg.headerShadow)}
      >
        <span>{selected.label}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Menu */}
      {open && (
        <div
          className={`absolute z-20 mt-2 w-full rounded-2xl border-[3px] ${cfg.headerBorder} bg-white overflow-hidden`}
          style={clayStyle(cfg.headerShadow)}
        >
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm font-semibold cursor-pointer transition-colors duration-100 ${
                o.value === value
                  ? `${cfg.headerBg} ${cfg.badgeText}`
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── LeetCode problem browser ──────────────────────────────────────────── */
function LeetCodeBrowser({ cfg }: { cfg: (typeof TYPE_CONFIG)[InterviewType] }) {
  const navigate = useNavigate()
  const [problems, setProblems] = useState<LeetCodeProblem[]>([])
  const [loading, setLoading] = useState(true)
  const [diffFilter, setDiffFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')
  const [catFilter, setCatFilter] = useState('all')

  useEffect(() => {
    fetch('/api/leetcode/problems')
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

  const diffBadge = (d: string) => {
    const cls = d === 'easy'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
      : d === 'medium'
      ? 'bg-amber-100 text-amber-700 border-amber-300'
      : 'bg-red-100 text-red-700 border-red-300'
    return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cls}`}>{d}</span>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2" style={{ fontFamily: "'Baloo 2', cursive" }}>
          LeetCode Interview Mode
        </h1>
        <p className="text-gray-500 text-sm">Practice coding problems with a live AI interviewer — explain your thinking, ask clarifying questions, and get scored on communication and complexity analysis.</p>
      </div>

      {/* Difficulty filter */}
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Difficulty</p>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'easy', 'medium', 'hard'] as const).map(d => {
            const active = diffFilter === d
            const activeColor = d === 'easy' ? 'bg-emerald-500 border-emerald-700 text-white' : d === 'medium' ? 'bg-amber-500 border-amber-700 text-white' : d === 'hard' ? 'bg-red-500 border-red-700 text-white' : `${cfg.buttonBg} ${cfg.buttonBorder} text-white`
            return (
              <button key={d} onClick={() => setDiffFilter(d)}
                className={`rounded-2xl border-[3px] px-4 py-1.5 text-sm font-bold cursor-pointer transition-colors duration-100 ${active ? activeColor : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                style={{ boxShadow: active ? '3px 3px 0px rgba(0,0,0,0.2)' : '3px 3px 0px #d1d5db' }}>
                {d === 'all' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Category filter */}
      <div className="mb-6">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Category</p>
        <div className="flex gap-2 flex-wrap">
          {categories.map(c => {
            const active = catFilter === c
            return (
              <button key={c} onClick={() => setCatFilter(c)}
                className={`rounded-2xl border-[3px] px-3 py-1 text-xs font-bold cursor-pointer transition-colors duration-100 ${active ? `${cfg.headerBg} ${cfg.headerBorder} ${cfg.badgeText}` : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                style={{ boxShadow: active ? `3px 3px 0px ${cfg.headerShadow}` : '3px 3px 0px #d1d5db' }}>
                {c === 'all' ? 'All' : c.replace(/-/g, ' ')}
              </button>
            )
          })}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <svg className={`w-8 h-8 animate-spin ${cfg.spinnerBorder} border-4 border-t-transparent rounded-full`} viewBox="0 0 24 24" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-gray-400 py-8">No problems match these filters.</p>
      )}

      <div className="grid grid-cols-1 gap-3">
        {filtered.map(p => (
          <div
            key={p.id}
            className="rounded-3xl border-[3px] border-amber-200 bg-white p-5 hover:translate-y-[2px] transition-transform duration-150 cursor-pointer"
            style={{ boxShadow: '4px 4px 0px #fde68a' }}
            onClick={() => navigate('/practice/leetcode/session', { state: { problem: p } })}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-bold text-amber-600 shrink-0">#{p.neetcode_number}</span>
                <span className="font-extrabold text-gray-900 text-sm truncate" style={{ fontFamily: "'Baloo 2', cursive" }}>
                  {p.title}
                </span>
                {diffBadge(p.difficulty)}
                <span className="text-xs font-semibold text-gray-400 hidden sm:block shrink-0">
                  {p.category.replace(/-/g, ' ')}
                </span>
              </div>
              <button
                className={`rounded-2xl border-[3px] ${cfg.buttonBg} ${cfg.buttonBorder} text-white font-bold text-xs px-4 py-1.5 cursor-pointer shrink-0`}
                style={{ boxShadow: `3px 3px 0px ${cfg.buttonShadow}` }}
                onClick={e => { e.stopPropagation(); navigate('/practice/leetcode/session', { state: { problem: p } }) }}
              >
                Solve →
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && (
        <p className="mt-4 text-center text-xs text-gray-400">{filtered.length} problem{filtered.length !== 1 ? 's' : ''}</p>
      )}
    </div>
  )
}

export default function QuestionBank() {
  const { type } = useParams<{ type: string }>()

  if (!type || !VALID_TYPES.includes(type as InterviewType)) {
    return <Navigate to="/" replace />
  }

  const interviewType = type as InterviewType
  const cfg = TYPE_CONFIG[interviewType]

  return <PracticeView interviewType={interviewType} cfg={cfg} />
}

/* Split out so hooks always run unconditionally after the guard above */
function PracticeView({
  interviewType,
  cfg,
}: {
  interviewType: InterviewType
  cfg: (typeof TYPE_CONFIG)[InterviewType]
}) {
  const navigate = useNavigate()
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

  // Resume PDF upload state
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeFileName, setResumeFileName] = useState('')
  const [resumeError, setResumeError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (interviewType === 'leetcode' || interviewType === 'resume') { setLoading(false); return }
    if (activeCompany) return // company questions already loaded
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ type: interviewType })
    if (category) params.set('category', category)
    params.set('difficulty', difficulty)
    if (interviewType === 'technical') {
      if (role !== 'general') params.set('role', role)
    }
    fetch(`/api/questions?${params}`)
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
      const res = await fetch('/api/company/questions', {
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
    // questions/current intentionally left in place — useEffect will re-fetch and overwrite
  }

  async function handleResumeUpload(file: File) {
    if (!file.name.endsWith('.pdf')) { setResumeError('Please upload a PDF file.'); return }
    setResumeUploading(true)
    setResumeError('')
    setResumeFileName(file.name)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/resume/questions', { method: 'POST', body: form })
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

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <header
        className={`${cfg.headerBg} border-b-[3px] ${cfg.headerBorder} px-6 py-5 sticky top-0 z-10`}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm font-semibold transition-colors duration-150 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back
          </Link>
          <div className="h-4 w-px bg-gray-300" />
          <span className="font-extrabold text-gray-900" style={{ fontFamily: "'Baloo 2', cursive" }}>
            {cfg.label}
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* ── Page intro ── */}
        {interviewType !== 'leetcode' && (
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2 leading-tight"
              style={{ fontFamily: "'Baloo 2', cursive" }}>
              {cfg.headline}
            </h1>
            <p className="text-gray-500 text-sm leading-relaxed">{cfg.subheading}</p>
          </div>
        )}

        {/* ── LeetCode problem browser ── */}
        {interviewType === 'leetcode' && (
          <LeetCodeBrowser cfg={cfg} />
        )}

        {interviewType !== 'leetcode' && (
          <>
            {/* ── Company search ── */}
            {cfg.showCompanySearch && (
              <div className="mb-6">
                {!activeCompany ? (
                  <div className={`rounded-3xl border-[3px] ${cfg.headerBorder} bg-white p-5`}
                    style={{ boxShadow: `4px 4px 0px ${cfg.headerShadow}` }}>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Search by company</p>
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        value={companyInput}
                        onChange={e => setCompanyInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && searchCompany(companyInput)}
                        placeholder="e.g. Google, Amazon, Stripe…"
                        className={`flex-1 rounded-2xl border-[3px] ${cfg.headerBorder} bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800 placeholder:text-gray-400 outline-none focus:bg-white transition-colors duration-100`}
                        style={{ boxShadow: `2px 2px 0px ${cfg.headerShadow}` }}
                      />
                      <button
                        onClick={() => searchCompany(companyInput)}
                        disabled={companyLoading || !companyInput.trim()}
                        className={`rounded-2xl border-[3px] ${cfg.buttonBg} ${cfg.buttonBorder} px-5 py-2 text-white text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-100`}
                        style={{ boxShadow: `3px 3px 0px ${cfg.buttonShadow}` }}
                      >
                        {companyLoading ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        ) : 'Search'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['Google', 'Amazon', 'Meta', 'Microsoft', 'Apple', 'Stripe', 'Airbnb', 'Uber'].map(c => (
                        <button
                          key={c}
                          onClick={() => searchCompany(c)}
                          disabled={companyLoading}
                          className="rounded-xl border-[2px] border-gray-300 bg-white px-3 py-1 text-xs font-bold text-gray-600 cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-100"
                          style={{ boxShadow: '2px 2px 0px #d1d5db' }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    {companyError && (
                      <div className="mt-3 rounded-2xl border-[3px] border-red-300 bg-red-50 px-4 py-3"
                        style={{ boxShadow: '3px 3px 0px #fca5a5' }}>
                        <p className="text-red-600 text-sm font-semibold">{companyError}</p>
                      </div>
                    )}
                    {companyLoading && (
                      <div className="mt-3 text-sm font-semibold text-gray-500 flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Generating {companyInput} questions…
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`rounded-3xl border-[3px] ${cfg.headerBorder} ${cfg.headerBg} p-5`}
                    style={{ boxShadow: `4px 4px 0px ${cfg.headerShadow}` }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg ${cfg.buttonBg} ${cfg.buttonBorder} border-[2px] flex items-center justify-center`}
                          style={{ boxShadow: `2px 2px 0px ${cfg.buttonShadow}` }}>
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                        <span className={`font-extrabold text-sm ${cfg.badgeText}`} style={{ fontFamily: "'Baloo 2', cursive" }}>
                          {activeCompany} · {questions.length} questions
                        </span>
                      </div>
                      <button
                        onClick={clearCompany}
                        className="text-xs font-bold text-gray-500 hover:text-gray-700 cursor-pointer"
                      >
                        ← Back
                      </button>
                    </div>
                    {companyStyleNote && (
                      <p className="text-xs text-gray-600 font-medium leading-relaxed">{companyStyleNote}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Category filter (behavioral only) ── */}
            {!activeCompany && cfg.showCategories && cfg.categories && (
              <div className="mb-6">
                <p className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Category</p>
                <ClaySelect
                  value={category}
                  onChange={setCategory}
                  cfg={cfg}
                  options={[
                    { value: '', label: 'All categories' },
                    ...cfg.categories.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
                  ]}
                />
              </div>
            )}

            {/* ── Resume PDF upload ── */}
            {interviewType === 'resume' && (
              <div className="mb-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f) }}
                />

                {/* Upload zone */}
                {!resumeFileName && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault(); setDragOver(false)
                      const f = e.dataTransfer.files?.[0]; if (f) handleResumeUpload(f)
                    }}
                    className={`rounded-3xl border-[3px] border-dashed cursor-pointer transition-colors duration-150 p-10 text-center ${
                      dragOver
                        ? `${cfg.accentBorder} ${cfg.accentBg}`
                        : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
                    }`}
                    style={{ boxShadow: '4px 4px 0px #6ee7b7' }}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-emerald-200 border-[3px] border-emerald-400 flex items-center justify-center mx-auto mb-4"
                      style={{ boxShadow: '3px 3px 0px #34d399' }}>
                      <svg className="w-7 h-7 text-emerald-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <p className="font-extrabold text-gray-800 mb-1" style={{ fontFamily: "'Baloo 2', cursive" }}>
                      Upload your resume
                    </p>
                    <p className="text-gray-500 text-sm">Drag and drop or click to browse · PDF only</p>
                  </div>
                )}

                {/* Uploading state */}
                {resumeUploading && (
                  <div className="rounded-3xl border-[3px] border-emerald-300 bg-emerald-50 p-6 flex items-center gap-4"
                    style={{ boxShadow: '4px 4px 0px #6ee7b7' }}>
                    <div className="w-10 h-10 rounded-xl bg-emerald-200 border-2 border-emerald-400 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 animate-spin text-emerald-700" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{resumeFileName}</p>
                      <p className="text-emerald-700 text-xs font-semibold">Generating personalized questions…</p>
                    </div>
                  </div>
                )}

                {/* Uploaded — show file + replace button */}
                {resumeFileName && !resumeUploading && (
                  <div className="rounded-3xl border-[3px] border-emerald-400 bg-emerald-50 p-5 flex items-center gap-4"
                    style={{ boxShadow: '4px 4px 0px #34d399' }}>
                    <div className="w-10 h-10 rounded-xl bg-emerald-300 border-2 border-emerald-500 flex items-center justify-center shrink-0"
                      style={{ boxShadow: '2px 2px 0px #059669' }}>
                      <svg className="w-5 h-5 text-emerald-800" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate">{resumeFileName}</p>
                      <p className="text-emerald-700 text-xs font-semibold">{questions.length} personalized questions generated</p>
                    </div>
                    <button
                      onClick={() => { setResumeFileName(''); setQuestions([]); setCurrent(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="text-xs font-bold text-gray-500 hover:text-gray-700 cursor-pointer shrink-0"
                    >
                      Replace
                    </button>
                  </div>
                )}

                {/* Upload error */}
                {resumeError && (
                  <div className="mt-3 rounded-2xl border-[3px] border-red-300 bg-red-50 px-4 py-3"
                    style={{ boxShadow: '3px 3px 0px #fca5a5' }}>
                    <p className="text-red-600 text-sm font-semibold">{resumeError}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Role selector (technical only) ── */}
            {!activeCompany && cfg.showRoles && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Role</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'general', label: 'All' },
                    { value: 'backend', label: 'Backend' },
                    { value: 'fullstack', label: 'Full Stack' },
                    { value: 'ai', label: 'AI / ML' },
                    { value: 'cloud', label: 'Cloud / AWS' },
                    { value: 'frontend', label: 'Frontend' },
                  ].map(r => {
                    const active = role === r.value
                    return (
                      <button
                        key={r.value}
                        onClick={() => setRole(r.value)}
                        className={`rounded-2xl border-[3px] px-4 py-1.5 text-sm font-bold cursor-pointer transition-colors duration-100 ${
                          active
                            ? `${cfg.headerBg} ${cfg.headerBorder} ${cfg.badgeText}`
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                        style={clayStyle(active ? cfg.headerShadow : '#d1d5db')}
                      >
                        {r.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Difficulty selector (technical only) ── */}
            {!activeCompany && cfg.showDifficulty && (
              <div className="mb-6">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Difficulty</p>
                <div className="flex gap-2">
                  {[
                    { value: 'intern', label: 'Intern' },
                    { value: 'mid', label: 'Mid-level' },
                    { value: 'senior', label: 'Senior' },
                  ].map(d => {
                    const active = difficulty === d.value
                    return (
                      <button
                        key={d.value}
                        onClick={() => setDifficulty(d.value)}
                        className={`rounded-2xl border-[3px] px-4 py-1.5 text-sm font-bold cursor-pointer transition-colors duration-100 ${
                          active
                            ? `${cfg.headerBg} ${cfg.headerBorder} ${cfg.badgeText}`
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                        style={clayStyle(active ? cfg.headerShadow : '#d1d5db')}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Tip card ── */}
            {!activeCompany && (cfg.tip || cfg.roleTips) && (
              <div className={`rounded-2xl border-[2px] ${cfg.accentBorder} ${cfg.accentBg} px-4 py-3 mb-6`}
                style={{ boxShadow: `3px 3px 0px ${cfg.accentShadow}` }}>
                <p className="text-xs font-semibold text-gray-600 leading-relaxed">
                  {cfg.showRoles && cfg.roleTips ? (cfg.roleTips[role] ?? cfg.tip) : cfg.tip}
                </p>
              </div>
            )}

            {/* ── Loading ── */}
            {loading && (
              <div className="rounded-3xl border-[3px] border-gray-200 bg-white p-10 text-center"
                style={clayStyle('#e5e7eb')}>
                <div className={`inline-block w-7 h-7 border-[3px] border-gray-200 ${cfg.spinnerBorder} rounded-full animate-spin`} />
              </div>
            )}

            {/* ── Error ── */}
            {error && (
              <div className="rounded-2xl border-[3px] border-red-300 bg-red-50 p-6 text-center text-red-600 text-sm font-semibold"
                style={clayStyle('#fca5a5')}>
                {error}
              </div>
            )}

            {/* ── Question card ── */}
            {!loading && !error && current && (
              <div className="rounded-3xl border-[3px] border-gray-200 bg-white p-8"
                style={clayStyle('#e5e7eb')}>
                <span className={`inline-block text-xs font-bold uppercase tracking-widest ${cfg.badgeText} ${cfg.badgeBg} px-3 py-1 rounded-full mb-5`}>
                  {current.category.replace('-', ' ')}
                </span>
                <p className="text-gray-900 text-lg font-semibold leading-relaxed">{current.text}</p>
              </div>
            )}

            {!loading && !error && !current && interviewType !== 'resume' && (
              <div className="rounded-3xl border-[3px] border-gray-200 bg-white p-8 text-center text-gray-400 text-sm font-medium"
                style={clayStyle('#e5e7eb')}>
                No questions found.
              </div>
            )}

            {/* ── Question actions ── */}
            {!loading && !error && current && (
              <div className="mt-5 flex gap-3">
                {/* Start Interview — primary CTA */}
                <button
                  onClick={() => navigate(`/practice/${interviewType}/session`, { state: { question: current } })}
                  className={`flex-1 rounded-2xl border-[3px] ${cfg.buttonBg} ${cfg.buttonBorder} text-white font-extrabold py-3 text-sm cursor-pointer hover:translate-y-[1px] transition-transform duration-150 flex items-center justify-center gap-2`}
                  style={clayStyle(cfg.buttonShadow)}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Start interview
                </button>

                {/* New question — secondary */}
                {questions.length > 1 && (
                  <button
                    onClick={handleNew}
                    className="px-4 rounded-2xl border-[3px] border-gray-300 bg-white text-gray-600 font-bold py-3 text-sm cursor-pointer hover:bg-gray-50 transition-colors"
                    style={clayStyle('#d1d5db')}
                    title="New question"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {!loading && !error && (
              <p className="mt-3 text-center text-xs text-gray-400">
                {questions.length} question{questions.length !== 1 ? 's' : ''} available
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
