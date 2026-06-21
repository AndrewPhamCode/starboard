import katex from 'katex'
import 'katex/dist/katex.min.css'

function MathText({ text }: { text: string }) {
  const parts = text.split(/\$([^$]+)\$/)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(part, { throwOnError: false, output: 'html' }) }} />
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

export interface LeetCodeScore {
  clarification: number
  communication: number
  solution_quality: number
  complexity_analysis: number
  follow_up_handling: number
  adaptability: number
  delivery: {
    filler_word_count: number
    words_per_minute: number
    confidence: number
    flow: number
  }
  feedback: string
  model_approach: string
}

interface Props {
  score: LeetCodeScore
  problemTitle: string
  onPracticeAgain: () => void
}

const DIMS = [
  { key: 'clarification' as const,       label: 'Problem Clarification' },
  { key: 'communication' as const,       label: 'Communication' },
  { key: 'solution_quality' as const,    label: 'Solution Quality' },
  { key: 'complexity_analysis' as const, label: 'Complexity Analysis' },
  { key: 'follow_up_handling' as const,  label: 'Follow-up Handling' },
  { key: 'adaptability' as const,        label: 'Adaptability' },
]

function scoreColor(v: number) {
  if (v >= 4) return 'bg-emerald-500'
  if (v >= 3) return 'bg-amber-400'
  return 'bg-red-400'
}

function scoreTextColor(v: number) {
  if (v >= 4) return 'text-emerald-600'
  if (v >= 3) return 'text-amber-600'
  return 'text-red-500'
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</span>
        <span className={`text-sm font-extrabold ${scoreTextColor(value)}`}>{value}/5</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${scoreColor(value)}`}
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
    </div>
  )
}

export default function LeetCodeScoreCard({ score, problemTitle, onPracticeAgain }: Props) {
  const overall = Math.round(
    (score.clarification + score.communication + score.solution_quality +
      score.complexity_analysis + score.follow_up_handling + score.adaptability) / 6 * 10
  ) / 10

  const wpm = score.delivery?.words_per_minute ?? 0
  const wpmLabel = wpm < 100 ? 'Slow' : wpm > 160 ? 'Fast' : 'Ideal'
  const wpmColor = wpm < 100 ? 'bg-amber-100 text-amber-700' : wpm > 160 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'

  return (
    <div className="min-h-screen bg-amber-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div
          className="rounded-3xl border-[3px] border-amber-400 p-8 mb-6 text-center"
          style={{ background: 'linear-gradient(135deg, #fbbf24, #f97316)', boxShadow: '4px 4px 0px #92400e' }}
        >
          <p className="text-amber-100 text-sm font-semibold uppercase tracking-widest mb-1">LeetCode Interview</p>
          <p className="text-white font-bold text-base mb-4">{problemTitle}</p>
          <div className="text-6xl font-extrabold text-white mb-1" style={{ fontFamily: "'Baloo 2', cursive" }}>
            {overall.toFixed(1)}
          </div>
          <p className="text-amber-100 text-sm">out of 5.0</p>
        </div>

        {/* Dimension scores */}
        <div
          className="rounded-3xl border-[3px] border-amber-200 bg-white p-6 mb-5"
          style={{ boxShadow: '4px 4px 0px #fde68a' }}
        >
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">Performance Breakdown</p>
          {DIMS.map(d => (
            <ScoreBar key={d.key} value={score[d.key]} label={d.label} />
          ))}
        </div>

        {/* Delivery */}
        {score.delivery && (
          <div
            className="rounded-3xl border-[3px] border-amber-200 bg-white p-6 mb-5"
            style={{ boxShadow: '4px 4px 0px #fde68a' }}
          >
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Delivery</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                score.delivery.filler_word_count <= 5
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  : score.delivery.filler_word_count <= 15
                  ? 'bg-amber-100 text-amber-700 border-amber-300'
                  : 'bg-red-100 text-red-700 border-red-300'
              }`}>
                {score.delivery.filler_word_count} filler words
              </span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${wpmColor} border-current`}>
                {wpm} WPM · {wpmLabel}
              </span>
            </div>
            <ScoreBar value={score.delivery.confidence} label="Confidence" />
            <ScoreBar value={score.delivery.flow} label="Flow" />
          </div>
        )}

        {/* Coaching feedback */}
        <div
          className="rounded-3xl border-[3px] border-amber-200 bg-white p-6 mb-5"
          style={{ boxShadow: '4px 4px 0px #fde68a' }}
        >
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Coaching Note</p>
          <p className="text-sm text-gray-700 leading-relaxed">{score.feedback}</p>
        </div>

        {/* Model approach */}
        {score.model_approach && (
          <div
            className="rounded-3xl border-[3px] border-amber-300 bg-amber-50 p-6 mb-6"
            style={{ boxShadow: '4px 4px 0px #fbbf24' }}
          >
            <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3">Optimal Approach</p>
            <p className="text-sm text-gray-700 leading-relaxed">
              <MathText text={score.model_approach} />
            </p>
          </div>
        )}

        {/* Practice again */}
        <button
          onClick={onPracticeAgain}
          className="w-full rounded-2xl border-[3px] border-amber-700 bg-amber-500 text-white font-extrabold py-3 text-sm cursor-pointer hover:translate-y-[1px] transition-transform duration-150"
          style={{ boxShadow: '3px 3px 0px #92400e' }}
        >
          Practice Another Problem
        </button>
      </div>
    </div>
  )
}
