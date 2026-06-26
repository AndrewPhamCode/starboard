export interface DesignScoreResult {
  clarification: number
  design: number
  deep_dive: number
  tradeoffs: number
  scale: number
  communication: number
  filler_word_count: number
  words_per_minute: number
  feedback: string
  model_answer: string
}

interface Props {
  result: DesignScoreResult
}

const DIMS = [
  { key: 'clarification' as const, label: 'Clarification', desc: 'Scope, users, constraints defined upfront' },
  { key: 'design' as const,        label: 'High-Level Design', desc: 'Right components identified and justified' },
  { key: 'deep_dive' as const,     label: 'Deep Dive', desc: 'At least one component explained in depth' },
  { key: 'tradeoffs' as const,     label: 'Trade-offs', desc: 'Explicit pros/cons with reasoned choices' },
  { key: 'scale' as const,         label: 'Scalability', desc: 'Concrete plan for growth and load' },
  { key: 'communication' as const, label: 'Communication', desc: 'Structured, precise, easy to follow' },
]

function barColor(val: number) {
  if (val >= 4) return '#f97316'
  if (val === 3) return '#f59e0b'
  return '#ef4444'
}

function pillStyle(val: number): React.CSSProperties {
  if (val >= 4) return { background: 'rgba(249,115,22,0.15)', color: '#fb923c' }
  if (val === 3) return { background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }
  return { background: 'rgba(239,68,68,0.12)', color: '#f87171' }
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

export default function DesignScoreCard({ result }: Props) {
  const overall = Math.round(
    (result.clarification + result.design + result.deep_dive + result.tradeoffs + result.scale + result.communication) / 6
  )
  const wpm = wpmBadge(result.words_per_minute)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Overall score */}
      <div style={{ background: '#141416', borderRadius: 14, border: '1px solid #2a2a2e', padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: '#52525b', marginBottom: 6 }}>
              OVERALL
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: '2.8rem', fontWeight: 700, color: '#f0f0f0', lineHeight: 1 }}>
                {overall}
              </span>
              <span style={{ color: '#52525b', fontSize: '1.1rem', fontWeight: 500 }}>/5</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ ...wpm.style, fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20 }}>{wpm.label}</span>
            <span style={{ ...fillerBadgeStyle(result.filler_word_count), fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20 }}>
              {result.filler_word_count} filler word{result.filler_word_count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Dimension scores */}
      <div style={{ background: '#141416', borderRadius: 14, border: '1px solid #2a2a2e', padding: '24px 28px' }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: '#52525b', marginBottom: 20 }}>
          DIMENSIONS
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {DIMS.map(({ key, label, desc }) => {
            const val = result[key]
            return (
              <div key={key}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <span style={{ color: '#d4d4d8', fontSize: '0.88rem', fontWeight: 600 }}>{label}</span>
                    <span style={{ color: '#52525b', fontSize: '0.75rem', marginLeft: 8 }}>{desc}</span>
                  </div>
                  <span style={{ ...pillStyle(val), fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, minWidth: 28, textAlign: 'center' }}>
                    {val}/5
                  </span>
                </div>
                <div style={{ height: 5, background: '#27272a', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(val / 5) * 100}%`, background: barColor(val), borderRadius: 3, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Coaching feedback */}
      <div style={{ background: '#141416', borderRadius: 14, border: '1px solid #2a2a2e', padding: '24px 28px' }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: '#52525b', marginBottom: 12 }}>
          COACHING NOTE
        </p>
        <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: 1.7, margin: 0 }}>{result.feedback}</p>
      </div>

      {/* Model answer */}
      <div style={{ background: '#141416', borderRadius: 14, border: '1px solid #2a2a2e', padding: '24px 28px' }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: '#52525b', marginBottom: 12 }}>
          MODEL ANSWER
        </p>
        <p style={{ color: '#d4d4d8', fontSize: '0.9rem', lineHeight: 1.75, margin: 0 }}>{result.model_answer}</p>
      </div>
    </div>
  )
}
