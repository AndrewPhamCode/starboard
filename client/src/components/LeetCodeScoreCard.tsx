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
  follow_up_answer?: string
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

function barColor(v: number) {
  if (v >= 4) return '#10b981'
  if (v >= 3) return '#f59e0b'
  return '#ef4444'
}

function pillStyle(v: number): React.CSSProperties {
  if (v >= 4) return { background: 'rgba(16,185,129,0.12)', color: '#34d399' }
  if (v >= 3) return { background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }
  return { background: 'rgba(239,68,68,0.12)', color: '#f87171' }
}

function wpmBadge(wpm: number): { label: string; style: React.CSSProperties } {
  if (wpm < 100) return { label: `${wpm} WPM · Slow`, style: { background: 'rgba(245,158,11,0.12)', color: '#fbbf24' } }
  if (wpm > 160) return { label: `${wpm} WPM · Fast`, style: { background: 'rgba(239,68,68,0.12)', color: '#f87171' } }
  return { label: `${wpm} WPM · Ideal`, style: { background: 'rgba(16,185,129,0.12)', color: '#34d399' } }
}

const pill: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 100,
  fontSize: '0.72rem',
  fontWeight: 700,
  fontFamily: "'JetBrains Mono', monospace",
}

const barRow: React.CSSProperties = {
  marginBottom: 14,
}

const barTrack: React.CSSProperties = {
  height: 5,
  background: '#1c1c1f',
  borderRadius: 3,
  overflow: 'hidden',
  marginTop: 5,
}

const mono: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.68rem',
  letterSpacing: '0.12em',
  color: '#6b6b7a',
}

const card: React.CSSProperties = {
  border: '1px solid #2a2a2e',
  borderRadius: 12,
  background: '#141416',
  padding: '20px 24px',
  marginBottom: 12,
}

export default function LeetCodeScoreCard({ score, problemTitle, onPracticeAgain }: Props) {
  const overall = Math.round(
    (score.clarification + score.communication + score.solution_quality +
      score.complexity_analysis + score.follow_up_handling + score.adaptability) / 6 * 10
  ) / 10

  const wpm = score.delivery?.words_per_minute ?? 0
  const wpmInfo = wpmBadge(wpm)

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0e', padding: '32px 16px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          borderRadius: 14,
          border: '1px solid rgba(16,185,129,0.25)',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(6,182,212,0.08) 100%)',
          padding: '28px 28px',
          marginBottom: 12,
          textAlign: 'center',
        }}>
          <p style={{ ...mono, color: '#34d399', marginBottom: 6 }}>LEETCODE INTERVIEW</p>
          <p style={{ fontSize: '0.9rem', color: '#6b6b7a', marginBottom: 16 }}>{problemTitle}</p>
          <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: '4rem', fontWeight: 700, color: '#f0f0f0', lineHeight: 1 }}>
            {overall.toFixed(1)}
          </div>
          <p style={{ fontSize: '0.8rem', color: '#52525b', marginTop: 4 }}>out of 5.0</p>
        </div>

        {/* Performance breakdown */}
        <div style={card}>
          <p style={{ ...mono, marginBottom: 16 }}>PERFORMANCE BREAKDOWN</p>
          {DIMS.map(d => (
            <div key={d.key} style={barRow}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>{d.label}</span>
                <span style={{ ...pill, ...pillStyle(score[d.key]) }}>{score[d.key]}/5</span>
              </div>
              <div style={barTrack}>
                <div style={{ height: '100%', width: `${(score[d.key] / 5) * 100}%`, background: barColor(score[d.key]), borderRadius: 3, transition: 'width 0.7s ease-out' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Delivery */}
        {score.delivery && (
          <div style={card}>
            <p style={{ ...mono, marginBottom: 16 }}>DELIVERY</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <span style={{
                ...pill,
                ...(score.delivery.filler_word_count <= 5
                  ? { background: 'rgba(16,185,129,0.12)', color: '#34d399' }
                  : score.delivery.filler_word_count <= 15
                  ? { background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }
                  : { background: 'rgba(239,68,68,0.12)', color: '#f87171' }),
              }}>
                {score.delivery.filler_word_count} filler words
              </span>
              <span style={{ ...pill, ...wpmInfo.style }}>{wpmInfo.label}</span>
            </div>
            {[{ label: 'Confidence', val: score.delivery.confidence }, { label: 'Flow', val: score.delivery.flow }].map(({ label, val }) => (
              <div key={label} style={barRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 500 }}>{label}</span>
                  <span style={{ ...pill, background: 'rgba(255,255,255,0.05)', color: '#6b6b7a' }}>{val}/5</span>
                </div>
                <div style={barTrack}>
                  <div style={{ height: '100%', width: `${(val / 5) * 100}%`, background: barColor(val), borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Coaching note */}
        <div style={card}>
          <p style={{ ...mono, marginBottom: 12 }}>COACHING NOTE</p>
          <div style={{ padding: '12px 14px', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8, background: 'rgba(124,58,237,0.05)' }}>
            <p style={{ fontSize: '0.85rem', color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>{score.feedback}</p>
          </div>
        </div>

        {/* Follow-up answer */}
        {score.follow_up_answer && (
          <div style={{ ...card, border: '1px solid rgba(6,182,212,0.25)', background: 'rgba(6,182,212,0.04)' }}>
            <p style={{ ...mono, color: '#06b6d4', marginBottom: 12 }}>FOLLOW-UP ANSWER</p>
            <p style={{ fontSize: '0.85rem', color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>
              <MathText text={score.follow_up_answer} />
            </p>
          </div>
        )}

        {/* Optimal approach */}
        {score.model_approach && (
          <div style={{ ...card, border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.04)' }}>
            <p style={{ ...mono, color: '#10b981', marginBottom: 12 }}>OPTIMAL APPROACH</p>
            <p style={{ fontSize: '0.85rem', color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>
              <MathText text={score.model_approach} />
            </p>
          </div>
        )}

        {/* Practice again */}
        <button
          onClick={onPracticeAgain}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 10,
            border: 'none',
            background: '#10b981',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            fontFamily: "'Inter', system-ui, sans-serif",
            transition: 'background 0.15s',
            marginTop: 4,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#059669' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#10b981' }}
        >
          Practice Another Problem
        </button>
      </div>
    </div>
  )
}
