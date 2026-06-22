import katex from 'katex'
import 'katex/dist/katex.min.css'

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
  { key: 'task' as const,      label: 'Task',      letter: 'T' },
  { key: 'action' as const,    label: 'Action',    letter: 'A' },
  { key: 'result' as const,    label: 'Result',    letter: 'R' },
]

function barColor(val: number) {
  if (val >= 4) return '#7c3aed'
  if (val === 3) return '#f59e0b'
  return '#ef4444'
}

function pillStyle(val: number): React.CSSProperties {
  if (val >= 4) return { background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }
  if (val === 3) return { background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }
  return { background: 'rgba(239,68,68,0.12)', color: '#f87171' }
}

function deliveryBarColor(val: number) {
  if (val >= 4) return '#10b981'
  if (val === 3) return '#f59e0b'
  return '#ef4444'
}

function wpmBadge(wpm: number): { label: string; style: React.CSSProperties } {
  if (wpm === 0) return { label: '— wpm', style: { background: 'rgba(255,255,255,0.06)', color: '#6b6b7a' } }
  if (wpm < 100) return { label: `${wpm} wpm · slow`, style: { background: 'rgba(245,158,11,0.12)', color: '#fbbf24' } }
  if (wpm <= 160) return { label: `${wpm} wpm · ideal`, style: { background: 'rgba(16,185,129,0.12)', color: '#34d399' } }
  return { label: `${wpm} wpm · fast`, style: { background: 'rgba(239,68,68,0.12)', color: '#f87171' } }
}

function fillerBadgeStyle(count: number): React.CSSProperties {
  if (count <= 2) return { background: 'rgba(16,185,129,0.12)', color: '#34d399' }
  if (count <= 5) return { background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }
  return { background: 'rgba(239,68,68,0.12)', color: '#f87171' }
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    marginTop: 24,
    borderRadius: 14,
    border: '1px solid #2a2a2e',
    background: '#141416',
    overflow: 'hidden',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #2a2a2e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(99,102,241,0.1) 100%)',
  },
  sectionLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.68rem',
    letterSpacing: '0.12em',
    color: '#6b6b7a',
    marginBottom: 12,
  },
  section: {
    padding: '20px 24px',
    borderBottom: '1px solid #1c1c1f',
  },
  barRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  barLabel: {
    width: 80,
    flexShrink: 0,
    fontSize: '0.82rem',
    color: '#a1a1aa',
    fontWeight: 500,
  },
  barTrack: {
    flex: 1,
    height: 5,
    background: '#1c1c1f',
    borderRadius: 3,
    overflow: 'hidden',
  },
  pill: {
    flexShrink: 0,
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 100,
    fontFamily: "'JetBrains Mono', monospace",
  },
  coachCard: {
    padding: '14px 16px',
    border: '1px solid rgba(124,58,237,0.2)',
    borderRadius: 10,
    background: 'rgba(124,58,237,0.05)',
  },
  rewriteCard: {
    padding: '14px 16px',
    border: '1px solid #2a2a2e',
    borderRadius: 10,
    background: '#1c1c1f',
    marginBottom: 10,
  },
}

export default function StarScoreCard({ result }: Props) {
  const overall = Math.round(
    (result.situation + result.task + result.action + result.result) / 4
  )
  const d = result.delivery
  const hasFollowUp = result.follow_up_handling != null
  const wpm = wpmBadge(d?.words_per_minute ?? 0)

  return (
    <div style={S.wrap}>

      {/* Header */}
      <div style={S.header}>
        <div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: '#a78bfa', marginBottom: 4 }}>
            AI FEEDBACK
          </p>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: '1.05rem', color: '#f0f0f0', margin: 0 }}>
            Interview Score
          </h3>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: '2.5rem', fontWeight: 700, color: '#f0f0f0', lineHeight: 1 }}>
            {overall}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b6b7a', marginTop: 2 }}>out of 5</div>
        </div>
      </div>

      {/* STAR bars */}
      <div style={S.section}>
        <p style={S.sectionLabel}>STAR SCORES</p>
        {STAR_DIMS.map(({ key, label }) => {
          const val = result[key]
          return (
            <div key={key} style={S.barRow}>
              <span style={S.barLabel}>{label}</span>
              <div style={S.barTrack}>
                <div style={{ height: '100%', width: `${(val / 5) * 100}%`, background: barColor(val), borderRadius: 3, transition: 'width 0.7s ease-out' }} />
              </div>
              <span style={{ ...S.pill, ...pillStyle(val) }}>{val}/5</span>
            </div>
          )
        })}
        {hasFollowUp && (
          <div style={{ ...S.barRow, paddingTop: 8, borderTop: '1px solid #1c1c1f' }}>
            <span style={S.barLabel}>Follow-up</span>
            <div style={S.barTrack}>
              <div style={{ height: '100%', width: `${(result.follow_up_handling! / 5) * 100}%`, background: barColor(result.follow_up_handling!), borderRadius: 3 }} />
            </div>
            <span style={{ ...S.pill, ...pillStyle(result.follow_up_handling!) }}>{result.follow_up_handling}/5</span>
          </div>
        )}
      </div>

      {/* Delivery */}
      {d && (
        <div style={S.section}>
          <p style={S.sectionLabel}>DELIVERY</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <span style={{ ...S.pill, ...fillerBadgeStyle(d.filler_word_count), padding: '4px 12px', fontSize: '0.75rem' }}>
              {d.filler_word_count} filler word{d.filler_word_count !== 1 ? 's' : ''}
            </span>
            <span style={{ ...S.pill, ...wpm.style, padding: '4px 12px', fontSize: '0.75rem' }}>
              {wpm.label}
            </span>
          </div>
          {[{ label: 'Confidence', val: d.confidence }, { label: 'Flow', val: d.flow }].map(({ label, val }) => (
            <div key={label} style={S.barRow}>
              <span style={S.barLabel}>{label}</span>
              <div style={S.barTrack}>
                <div style={{ height: '100%', width: `${(val / 5) * 100}%`, background: deliveryBarColor(val), borderRadius: 3 }} />
              </div>
              <span style={{ ...S.pill, background: 'rgba(255,255,255,0.05)', color: '#6b6b7a' }}>{val}/5</span>
            </div>
          ))}
        </div>
      )}

      {/* Coaching note */}
      <div style={S.section}>
        <p style={S.sectionLabel}>COACHING NOTE</p>
        <div style={S.coachCard}>
          <p style={{ fontSize: '0.85rem', color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>{result.feedback}</p>
        </div>
      </div>

      {/* Model rewrite */}
      {result.rewrite && (
        <div style={{ padding: '20px 24px' }}>
          <p style={S.sectionLabel}>MODEL REWRITE</p>
          {STAR_DIMS.map(({ key, label, letter }) => {
            const val = result[key]
            return (
              <div key={key} style={S.rewriteCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: barColor(val), fontSize: '0.65rem', fontWeight: 700, color: '#fff',
                  }}>
                    {letter}
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: '#52525b' }}>
                    {label.toUpperCase()}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>
                  <MathText text={result.rewrite[key]} />
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
