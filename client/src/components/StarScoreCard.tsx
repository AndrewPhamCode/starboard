import katex from 'katex'
import 'katex/dist/katex.min.css'

/* ─── Inline LaTeX renderer — splits on $...$ and renders math segments ── */
function MathText({ text }: { text: string }) {
  const parts = text.split(/\$([^$]+)\$/)
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const html = katex.renderToString(part, { throwOnError: false, output: 'html' })
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export interface DeliveryScores {
  filler_word_count: number
  words_per_minute: number
  confidence: number
  flow: number
}

export interface ScoreResult {
  situation: number
  task: number
  action: number
  result: number
  follow_up_handling?: number | null
  delivery?: DeliveryScores
  feedback: string
  rewrite: {
    situation: string
    task: string
    action: string
    result: string
  }
}

interface Props {
  result: ScoreResult
}

const STAR_DIMS = [
  { key: 'situation' as const, label: 'Situation', letter: 'S' },
  { key: 'task' as const, label: 'Task', letter: 'T' },
  { key: 'action' as const, label: 'Action', letter: 'A' },
  { key: 'result' as const, label: 'Result', letter: 'R' },
]

function starStyle(val: number) {
  if (val >= 4) return { bar: 'bg-indigo-500', pill: 'bg-indigo-100 text-indigo-700', letter: 'bg-indigo-600' }
  if (val === 3) return { bar: 'bg-amber-400', pill: 'bg-amber-100 text-amber-700', letter: 'bg-amber-500' }
  return { bar: 'bg-red-400', pill: 'bg-red-100 text-red-700', letter: 'bg-red-500' }
}

function deliveryStyle(val: number) {
  if (val >= 4) return 'bg-emerald-500'
  if (val === 3) return 'bg-amber-400'
  return 'bg-red-400'
}

function wpmBadge(wpm: number): { label: string; cls: string } {
  if (wpm === 0) return { label: '—', cls: 'bg-gray-100 text-gray-500' }
  if (wpm < 100) return { label: `${wpm} wpm · slow`, cls: 'bg-amber-100 text-amber-700' }
  if (wpm <= 160) return { label: `${wpm} wpm · ideal`, cls: 'bg-emerald-100 text-emerald-700' }
  return { label: `${wpm} wpm · fast`, cls: 'bg-red-100 text-red-700' }
}

function fillerBadge(count: number): { cls: string } {
  if (count <= 2) return { cls: 'bg-emerald-100 text-emerald-700' }
  if (count <= 5) return { cls: 'bg-amber-100 text-amber-700' }
  return { cls: 'bg-red-100 text-red-700' }
}

export default function StarScoreCard({ result }: Props) {
  const overall = Math.round(
    (result.situation + result.task + result.action + result.result) / 4
  )

  const d = result.delivery
  const hasFollowUp = result.follow_up_handling != null

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between">
        <div>
          <p className="text-indigo-100 text-xs font-semibold uppercase tracking-widest mb-0.5">AI Feedback</p>
          <h3 className="text-white font-bold text-lg">Interview Score</h3>
        </div>
        <div className="text-right">
          <div className="text-4xl font-extrabold text-white">{overall}</div>
          <div className="text-indigo-200 text-xs font-medium">out of 5</div>
        </div>
      </div>

      <div className="p-6 space-y-7">

        {/* ── STAR bars ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">STAR Scores</p>
          <div className="space-y-3">
            {STAR_DIMS.map(({ key, label }) => {
              const val = result[key]
              const styles = starStyle(val)
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-sm text-gray-600 font-medium">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-700 ease-out ${styles.bar}`}
                      style={{ width: `${(val / 5) * 100}%` }}
                    />
                  </div>
                  <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${styles.pill}`}>
                    {val}/5
                  </span>
                </div>
              )
            })}

            {/* Follow-up handling bar */}
            {hasFollowUp && (
              <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
                <span className="w-20 shrink-0 text-sm text-gray-600 font-medium">Follow-up</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-700 ease-out ${starStyle(result.follow_up_handling!).bar}`}
                    style={{ width: `${(result.follow_up_handling! / 5) * 100}%` }}
                  />
                </div>
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${starStyle(result.follow_up_handling!).pill}`}>
                  {result.follow_up_handling}/5
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Delivery section ── */}
        {d && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Delivery</p>

            {/* Filler words + WPM badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${fillerBadge(d.filler_word_count).cls}`}>
                {d.filler_word_count} filler word{d.filler_word_count !== 1 ? 's' : ''}
              </span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${wpmBadge(d.words_per_minute).cls}`}>
                {wpmBadge(d.words_per_minute).label}
              </span>
            </div>

            {/* Confidence + Flow bars */}
            <div className="space-y-3">
              {[
                { label: 'Confidence', val: d.confidence },
                { label: 'Flow', val: d.flow },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-sm text-gray-600 font-medium">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-700 ease-out ${deliveryStyle(val)}`}
                      style={{ width: `${(val / 5) * 100}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {val}/5
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Coaching note ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Coaching note</p>
          <p className="text-gray-700 text-sm leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-100">
            {result.feedback}
          </p>
        </div>

        {/* ── Per-STAR model rewrite ── */}
        {result.rewrite && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Model rewrite</p>
            <div className="space-y-3">
              {STAR_DIMS.map(({ key, label, letter }) => {
                const val = result[key]
                const styles = starStyle(val)
                return (
                  <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-extrabold shrink-0 ${styles.letter}`}>
                        {letter}
                      </span>
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</span>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed"><MathText text={result.rewrite[key]} /></p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
