export interface ScoreResult {
  situation: number
  task: number
  action: number
  result: number
  feedback: string
  rewrite: {
    situation: string
    task: string
    action: string
    result: string
  }
}

interface Props {
  score: ScoreResult
}

const DIMENSIONS = [
  { key: 'situation' as const, label: 'Situation', letter: 'S' },
  { key: 'task' as const, label: 'Task', letter: 'T' },
  { key: 'action' as const, label: 'Action', letter: 'A' },
  { key: 'result' as const, label: 'Result', letter: 'R' },
]

function scoreStyle(val: number) {
  if (val >= 4) return { bar: 'bg-indigo-500', pill: 'bg-indigo-100 text-indigo-700', letter: 'bg-indigo-600' }
  if (val === 3) return { bar: 'bg-amber-400', pill: 'bg-amber-100 text-amber-700', letter: 'bg-amber-500' }
  return { bar: 'bg-red-400', pill: 'bg-red-100 text-red-700', letter: 'bg-red-500' }
}

export default function StarScoreCard({ score }: Props) {
  const overall = Math.round(
    (score.situation + score.task + score.action + score.result) / 4
  )

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between">
        <div>
          <p className="text-indigo-100 text-xs font-semibold uppercase tracking-widest mb-0.5">AI Feedback</p>
          <h3 className="text-white font-bold text-lg">STAR Score</h3>
        </div>
        <div className="text-right">
          <div className="text-4xl font-extrabold text-white">{overall}</div>
          <div className="text-indigo-200 text-xs font-medium">out of 5</div>
        </div>
      </div>

      <div className="p-6 space-y-7">
        {/* Bar chart */}
        <div className="space-y-3">
          {DIMENSIONS.map(({ key, label }) => {
            const val = score[key]
            const styles = scoreStyle(val)
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
        </div>

        {/* Feedback */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Coaching note</p>
          <p className="text-gray-700 text-sm leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-100">
            {score.feedback}
          </p>
        </div>

        {/* Per-STAR rewrite */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Model rewrite</p>
          <div className="space-y-3">
            {DIMENSIONS.map(({ key, label, letter }) => {
              const val = score[key]
              const styles = scoreStyle(val)
              return (
                <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-extrabold shrink-0 ${styles.letter}`}>
                      {letter}
                    </span>
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</span>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">{score.rewrite[key]}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
