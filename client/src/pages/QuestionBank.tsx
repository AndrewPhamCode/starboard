import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import RecordButton from '../components/RecordButton'
import StarScoreCard from '../components/StarScoreCard'
import type { ScoreResult } from '../components/StarScoreCard'

interface Question {
  id: number
  type: string
  category: string
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
    categories: ['leadership', 'conflict', 'failure', 'teamwork', 'impact'],
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

const VALID_TYPES: InterviewType[] = ['behavioral', 'technical', 'resume', 'leetcode']

function pickRandom<T>(arr: T[]): T | null {
  if (!arr.length) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

/* ─── Clay helper (inline, no extra import) ─────────────────────────────── */
function clayStyle(shadow: string) {
  return { boxShadow: `4px 4px 0px ${shadow}` }
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
  const [category, setCategory] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [transcript, setTranscript] = useState('')
  const [score, setScore] = useState<ScoreResult | null>(null)
  const [scoring, setScoring] = useState(false)
  const [scoreError, setScoreError] = useState('')

  useEffect(() => {
    if (interviewType === 'leetcode') { setLoading(false); return }
    setLoading(true)
    setError('')
    setTranscript('')
    setScore(null)
    const params = new URLSearchParams({ type: interviewType })
    if (category) params.set('category', category)
    fetch(`/api/questions?${params}`)
      .then((r) => { if (!r.ok) throw new Error('Failed to load questions'); return r.json() })
      .then((data: Question[]) => { setQuestions(data); setCurrent(pickRandom(data)) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [interviewType, category])

  const handleNew = () => {
    const next = pickRandom(questions.filter((q) => q.id !== current?.id))
    setCurrent(next ?? pickRandom(questions))
    setTranscript('')
    setScore(null)
    setScoreError('')
  }

  const handleScore = async () => {
    if (!current || !transcript) return
    setScoring(true)
    setScoreError('')
    setScore(null)
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, question: current.text }),
      })
      if (!res.ok) {
        const detail = await res.json().then((d: { detail: string }) => d.detail).catch(() => res.statusText)
        throw new Error(detail)
      }
      setScore(await res.json() as ScoreResult)
    } catch (e: unknown) {
      setScoreError(e instanceof Error ? e.message : 'Scoring failed')
    } finally {
      setScoring(false)
    }
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

        {/* ── LeetCode coming soon ── */}
        {interviewType === 'leetcode' && (
          <div
            className={`rounded-3xl border-[3px] ${cfg.headerBg} ${cfg.headerBorder} p-12 text-center`}
            style={clayStyle(cfg.headerShadow)}
          >
            <div className="w-16 h-16 bg-amber-300 border-[3px] border-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ boxShadow: '3px 3px 0px #b45309' }}>
              <svg className="w-8 h-8 text-amber-800" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-3" style={{ fontFamily: "'Baloo 2', cursive" }}>
              Coming soon
            </h2>
            <p className="text-gray-600 text-sm max-w-xs mx-auto leading-relaxed mb-8">
              LeetCode mode will let you practice verbalizing your algorithmic thinking out loud — just like in a real coding interview.
            </p>
            <Link to="/">
              <span
                className={`inline-block rounded-2xl border-[3px] ${cfg.buttonBg} ${cfg.buttonBorder} px-6 py-3 text-white font-bold text-sm cursor-pointer`}
                style={clayStyle(cfg.buttonShadow)}
              >
                Back to home
              </span>
            </Link>
          </div>
        )}

        {interviewType !== 'leetcode' && (
          <>
            {/* ── Category filter (behavioral only) ── */}
            {cfg.showCategories && cfg.categories && (
              <div className="mb-6">
                <label htmlFor="category" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Category
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setTranscript(''); setScore(null) }}
                  className={`w-full border-[3px] ${cfg.headerBorder} rounded-2xl px-4 py-2.5 text-gray-800 ${cfg.headerBg} focus:outline-none text-sm font-semibold cursor-pointer`}
                  style={clayStyle(cfg.headerShadow)}
                >
                  <option value="">All categories</option>
                  {cfg.categories.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Tip card ── */}
            {cfg.tip && (
              <div className={`rounded-2xl border-[2px] ${cfg.accentBorder} ${cfg.accentBg} px-4 py-3 mb-6`}
                style={{ boxShadow: `3px 3px 0px ${cfg.accentShadow}` }}>
                <p className="text-xs font-semibold text-gray-600 leading-relaxed">{cfg.tip}</p>
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

            {!loading && !error && !current && (
              <div className="rounded-3xl border-[3px] border-gray-200 bg-white p-8 text-center text-gray-400 text-sm font-medium"
                style={clayStyle('#e5e7eb')}>
                No questions found.
              </div>
            )}

            {/* ── New question button ── */}
            {!loading && !error && questions.length > 1 && (
              <button
                onClick={handleNew}
                className={`mt-5 w-full rounded-2xl border-[3px] ${cfg.buttonBg} ${cfg.buttonBorder} text-white font-extrabold py-3 text-sm cursor-pointer hover:translate-y-[2px] transition-transform duration-150`}
                style={clayStyle(cfg.buttonShadow)}
              >
                New question
              </button>
            )}

            {!loading && !error && (
              <p className="mt-3 text-center text-xs text-gray-400">
                {questions.length} question{questions.length !== 1 ? 's' : ''} available
              </p>
            )}

            {/* ── Record + transcript + score ── */}
            {!loading && !error && current && (
              <>
                <RecordButton
                  onTranscript={(t) => { setTranscript(t); setScore(null); setScoreError('') }}
                />

                {transcript && (
                  <div className="mt-5 rounded-3xl border-[3px] border-gray-200 bg-white p-6"
                    style={clayStyle('#e5e7eb')}>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Your answer</p>
                    <p className="text-gray-700 text-sm leading-relaxed">{transcript}</p>
                  </div>
                )}

                {transcript && (
                  <button
                    onClick={handleScore}
                    disabled={scoring}
                    className={[
                      'mt-5 w-full rounded-2xl border-[3px] font-extrabold py-3 text-sm transition-all duration-150',
                      scoring
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : `${cfg.buttonBg} ${cfg.buttonBorder} text-white cursor-pointer hover:translate-y-[2px]`,
                    ].join(' ')}
                    style={scoring ? {} : clayStyle(cfg.buttonShadow)}
                  >
                    {scoring ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className={`inline-block w-4 h-4 border-2 border-gray-300 ${cfg.spinnerBorder} rounded-full animate-spin`} />
                        Scoring…
                      </span>
                    ) : 'Score my answer'}
                  </button>
                )}

                {scoreError && (
                  <p className="mt-3 text-xs text-red-500 text-center font-medium">{scoreError}</p>
                )}

                {score && <StarScoreCard score={score} />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
