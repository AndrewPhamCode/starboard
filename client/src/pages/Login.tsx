import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const ds = {
  bg: '#0c0c0e',
  surface: '#141416',
  surface2: '#1c1c1f',
  border: '#2a2a2e',
  text: '#f0f0f0',
  muted: '#6b6b7a',
  accent: '#7c3aed',
}

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error: err } = await signIn(email, password)
        if (err) { setError(err.message); return }
        navigate('/dashboard')
      } else {
        const { error: err } = await signUp(email, password)
        if (err) { setError(err.message); return }
        setSuccess('Check your email to confirm your account, then sign in.')
        setMode('signin')
      }
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${ds.border}`,
    background: ds.surface2,
    color: ds.text,
    fontSize: '0.9rem',
    fontFamily: "'Inter', system-ui, sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: ds.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <a href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="#2a2a2e" strokeWidth="1.5" />
              <line x1="14" y1="4" x2="14" y2="10" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="14" y1="18" x2="14" y2="24" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="4" y1="14" x2="10" y2="14" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="14" y1="14" x2="22" y2="14" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
              <polygon points="20,11 24,14 20,17" fill="#7c3aed" />
              <circle cx="14" cy="14" r="2.5" fill="white" />
            </svg>
            <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: '1.1rem', color: ds.text, letterSpacing: '-0.02em' }}>
              starboard
            </span>
          </a>
        </div>

        {/* Card */}
        <div style={{ background: ds.surface, border: `1px solid ${ds.border}`, borderRadius: 14, padding: '32px 28px' }}>
          <h1 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: '1.3rem', color: ds.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
          <p style={{ color: ds.muted, fontSize: '0.85rem', margin: '0 0 24px' }}>
            {mode === 'signin' ? 'Sign in to see your interview history.' : 'Start tracking your progress.'}
          </p>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '0.82rem', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399', fontSize: '0.82rem', marginBottom: 16 }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: ds.muted, marginBottom: 6 }}>
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = ds.accent }}
                onBlur={e => { e.currentTarget.style.borderColor = ds.border }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: ds.muted, marginBottom: 6 }}>
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = ds.accent }}
                onBlur={e => { e.currentTarget.style.borderColor = ds.border }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: 8,
                border: 'none',
                background: ds.accent,
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                fontFamily: "'Inter', system-ui, sans-serif",
                marginTop: 4,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#6d28d9' }}
              onMouseLeave={e => { e.currentTarget.style.background = ds.accent }}
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess('') }}
              style={{ background: 'none', border: 'none', color: ds.muted, fontSize: '0.82rem', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <span style={{ color: '#a78bfa' }}>{mode === 'signin' ? 'Sign up' : 'Sign in'}</span>
            </button>

            <button
              onClick={() => navigate('/practice/behavioral')}
              style={{ background: 'none', border: 'none', color: '#3f3f46', fontSize: '0.78rem', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              Continue without account →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
