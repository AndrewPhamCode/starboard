import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import mermaid from 'mermaid'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { API_URL } from '../lib/api'

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const ds = {
  bg: '#0c0c0e', surface: '#141416', surface2: '#1c1c1f',
  border: '#2a2a2e', text: '#f0f0f0', muted: '#6b6b7a',
  accent: '#7c3aed', emerald: '#10b981',
}

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface GitHubProject {
  id: string
  repo_url: string
  repo_name: string
  description: string | null
  languages: Record<string, number>
  breakdown: string
  diagram: string
  talking_points: string[]
  created_at: string
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f0db4f', Python: '#3572a5',
  Rust: '#dea584', Go: '#00add8', Java: '#b07219', 'C++': '#f34b7d',
  CSS: '#563d7c', HTML: '#e34c26', Ruby: '#701516', Swift: '#f05138',
}

function LangPill({ lang }: { lang: string }) {
  const color = LANG_COLORS[lang] ?? '#52525b'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 6,
      background: `${color}18`, border: `1px solid ${color}40`,
      color: '#d4d4d8', fontSize: '0.72rem', fontWeight: 500,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {lang}
    </span>
  )
}

function Spinner({ color = ds.accent }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/* ─── Mermaid diagram ────────────────────────────────────────────────────── */
function MermaidDiagram({ id, diagram }: { id: string; diagram: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !diagram) return
    mermaid.render(`mermaid-${id}`, diagram)
      .then(({ svg }) => { if (containerRef.current) containerRef.current.innerHTML = svg })
      .catch(() => setError(true))
  }, [id, diagram])

  if (error) return <p style={{ color: ds.muted, fontSize: '0.8rem', margin: 0 }}>Diagram could not be rendered.</p>
  return <div ref={containerRef} style={{ overflowX: 'auto' }} />
}

/* ─── Repo card ──────────────────────────────────────────────────────────── */
function RepoCard({ repo, onDelete }: { repo: GitHubProject; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const langs = Object.keys(repo.languages ?? {}).slice(0, 5)

  async function handleDelete() {
    if (!confirm(`Remove ${repo.repo_name} from your profile?`)) return
    setDeleting(true)
    await supabase.from('github_projects').delete().eq('id', repo.id)
    onDelete(repo.id)
  }

  return (
    <div style={{ background: ds.surface, border: `1px solid ${ds.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', borderBottom: `1px solid ${ds.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <a href={repo.repo_url} target="_blank" rel="noopener noreferrer"
              style={{ color: ds.text, fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#a78bfa')}
              onMouseLeave={e => (e.currentTarget.style.color = ds.text)}
            >
              {repo.repo_name}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4, opacity: 0.5, verticalAlign: 'middle' }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
            {repo.description && <p style={{ color: ds.muted, fontSize: '0.8rem', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo.description}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ color: ds.muted, fontSize: '0.72rem' }}>{timeAgo(repo.created_at)}</span>
            <button onClick={handleDelete} disabled={deleting}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: '2px 4px', lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
            >
              {deleting ? <Spinner color="#f87171" /> : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {langs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
            {langs.map(l => <LangPill key={l} lang={l} />)}
          </div>
        )}
      </div>

      {repo.talking_points?.length > 0 && (
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${ds.border}` }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: '#52525b', margin: '0 0 10px' }}>KEY TALKING POINTS</p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {repo.talking_points.map((pt, i) => (
              <li key={i} style={{ color: '#d4d4d8', fontSize: '0.83rem', lineHeight: 1.5 }}>{pt}</li>
            ))}
          </ul>
        </div>
      )}

      {(repo.breakdown || repo.diagram) && (
        <div>
          <button onClick={() => setExpanded(v => !v)}
            style={{ width: '100%', padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: ds.muted, fontSize: '0.82rem', fontFamily: "'Inter', system-ui, sans-serif", borderBottom: expanded ? `1px solid ${ds.border}` : 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = ds.text)}
            onMouseLeave={e => (e.currentTarget.style.color = ds.muted)}
          >
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: 'inherit' }}>ARCHITECTURE</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {expanded && (
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {repo.breakdown && <p style={{ color: '#d4d4d8', fontSize: '0.85rem', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{repo.breakdown}</p>}
              {repo.diagram && (
                <div style={{ background: ds.surface2, borderRadius: 8, padding: 16, border: `1px solid ${ds.border}` }}>
                  <MermaidDiagram id={repo.id} diagram={repo.diagram} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function Profile() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  // Resume state
  const [resumeStatus, setResumeStatus] = useState<'loading' | 'found' | 'none'>('loading')
  const [_resumeSignedUrl, setResumeSignedUrl] = useState('')
  const [resumeUploadedAt, setResumeUploadedAt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  // GitHub repo state
  const [repos, setRepos] = useState<GitHubProject[]>([])
  const [reposLoading, setReposLoading] = useState(true)
  const [repoUrl, setRepoUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true })
  }, [user, authLoading, navigate])

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' })
  }, [])

  useEffect(() => {
    if (!user) return
    fetchResume()
    fetchRepos()
  }, [user])

  async function fetchResume() {
    setResumeStatus('loading')
    try {
      const path = `${user!.id}/resume.pdf`
      const { data, error } = await supabase.storage.from('resumes').createSignedUrl(path, 3600)
      if (error || !data?.signedUrl) {
        setResumeStatus('none')
        return
      }
      // Get metadata for upload time
      const { data: list } = await supabase.storage.from('resumes').list(user!.id)
      const meta = list?.find(f => f.name === 'resume.pdf')
      setResumeSignedUrl(data.signedUrl)
      setResumeUploadedAt(meta?.updated_at ?? meta?.created_at ?? '')
      setResumeStatus('found')
    } catch {
      setResumeStatus('none')
    }
  }

  async function fetchRepos() {
    setReposLoading(true)
    try {
      const { data } = await supabase
        .from('github_projects')
        .select('*')
        .order('created_at', { ascending: false })
      setRepos(data ?? [])
    } catch {
      // leave repos empty
    } finally {
      setReposLoading(false)
    }
  }

  async function handleResumeFile(file: File) {
    if (!file.name.endsWith('.pdf')) { setUploadError('Please upload a PDF file.'); return }
    setUploading(true)
    setUploadError('')
    try {
      const path = `${user!.id}/resume.pdf`
      const { error } = await supabase.storage.from('resumes').upload(path, file, {
        contentType: 'application/pdf',
        upsert: true,
      })
      if (error) throw error
      await fetchResume()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Check your Supabase storage policies.')
      setResumeStatus('none')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteResume() {
    if (!confirm('Remove your saved resume?')) return
    await supabase.storage.from('resumes').remove([`${user!.id}/resume.pdf`])
    setResumeStatus('none')
    setResumeSignedUrl('')
  }

  async function handleAddRepo(e: React.FormEvent) {
    e.preventDefault()
    if (!repoUrl.trim()) return
    setAdding(true)
    setAddError('')
    try {
      // Backend fetches GitHub data and runs Claude analysis
      const res = await fetch(`${API_URL}/api/profile/analyze-repo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? 'Failed to analyze repo')
      }
      const analysis = await res.json()

      // Frontend saves to Supabase directly
      const { data, error } = await supabase
        .from('github_projects')
        .insert({ user_id: user!.id, ...analysis })
        .select()
        .single()
      if (error) throw new Error(error.message)

      setRepos(prev => [data, ...prev])
      setRepoUrl('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add repo. Make sure it is a public GitHub URL.')
    } finally {
      setAdding(false)
    }
  }

  if (authLoading || (!user && !authLoading)) return null

  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: '#52525b', margin: '0 0 8px' }

  return (
    <div style={{ minHeight: '100vh', background: ds.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>

      <header style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #1c1c1f', background: 'rgba(12,12,14,0.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, color: ds.muted, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
            Dashboard
          </Link>
          <span style={{ color: '#2a2a2e' }}>·</span>
          <span style={{ color: ds.text, fontSize: '0.875rem', fontWeight: 600 }}>Profile</span>
          <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: ds.accent, marginLeft: 2 }} />
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 80px' }}>
        <p style={mono}>PROFILE</p>
        <h1 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: '1.6rem', color: ds.text, margin: '6px 0 32px', letterSpacing: '-0.02em' }}>Your Profile</h1>

        {/* ─── Resume ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <p style={mono}>RESUME</p>
          <p style={{ color: ds.muted, fontSize: '0.85rem', margin: '0 0 16px' }}>
            Upload your resume once — it will auto-load for every resume interview.
          </p>

          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeFile(f) }} />
          <input ref={replaceInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeFile(f) }} />

          {resumeStatus === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: ds.muted, fontSize: '0.85rem' }}>
              <Spinner color={ds.muted} /> Checking for saved resume…
            </div>
          )}

          {resumeStatus === 'none' && !uploading && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleResumeFile(f) }}
              style={{ border: `1px dashed ${dragOver ? ds.emerald : ds.border}`, borderRadius: 12, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(16,185,129,0.05)' : 'transparent', transition: 'all 0.15s' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, border: `1px solid ${ds.emerald}`, background: 'rgba(16,185,129,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: ds.emerald }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p style={{ fontWeight: 600, color: ds.text, margin: '0 0 4px' }}>Upload your resume</p>
              <p style={{ color: ds.muted, fontSize: '0.85rem', margin: 0 }}>Drag and drop or click to browse · PDF only</p>
            </div>
          )}

          {uploading && (
            <div style={{ background: ds.surface, border: `1px solid ${ds.border}`, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Spinner color={ds.emerald} />
              <p style={{ color: ds.text, fontSize: '0.875rem', margin: 0 }}>Uploading resume…</p>
            </div>
          )}

          {uploadError && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#f87171', fontSize: '0.85rem' }}>
              {uploadError}
            </div>
          )}

          {resumeStatus === 'found' && !uploading && (
            <div style={{ background: ds.surface, border: `1px solid ${ds.emerald}40`, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: `1px solid ${ds.emerald}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: ds.emerald }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, color: ds.text, fontSize: '0.875rem', margin: '0 0 2px' }}>Resume saved</p>
                {resumeUploadedAt && <p style={{ color: ds.muted, fontSize: '0.75rem', margin: 0 }}>Last updated {timeAgo(resumeUploadedAt)}</p>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => replaceInputRef.current?.click()}
                  style={{ fontSize: '0.78rem', color: ds.muted, cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'Inter', system-ui, sans-serif" }}
                  onMouseEnter={e => (e.currentTarget.style.color = ds.text)}
                  onMouseLeave={e => (e.currentTarget.style.color = ds.muted)}
                >Replace</button>
                <button onClick={handleDeleteResume}
                  style={{ fontSize: '0.78rem', color: '#52525b', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'Inter', system-ui, sans-serif" }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
                >Delete</button>
              </div>
            </div>
          )}
        </section>

        {/* ─── GitHub Projects ─────────────────────────────────────────── */}
        <section>
          <p style={mono}>GITHUB PROJECTS</p>
          <p style={{ color: ds.muted, fontSize: '0.85rem', margin: '0 0 16px' }}>
            Add public GitHub repos to get an architecture breakdown and interview prep guide.
          </p>

          <form onSubmit={handleAddRepo} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input
              type="url"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repo"
              disabled={adding}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: `1px solid ${ds.border}`, background: ds.surface2, color: ds.text, fontSize: '0.875rem', outline: 'none', fontFamily: "'Inter', system-ui, sans-serif", opacity: adding ? 0.6 : 1 }}
            />
            <button type="submit" disabled={adding || !repoUrl.trim()}
              style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: ds.accent, color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: adding || !repoUrl.trim() ? 'not-allowed' : 'pointer', fontFamily: "'Inter', system-ui, sans-serif", opacity: adding || !repoUrl.trim() ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}
            >
              {adding ? <><Spinner color="#fff" /> Analyzing…</> : 'Analyze repo'}
            </button>
          </form>

          {addError && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#f87171', fontSize: '0.85rem' }}>
              {addError}
            </div>
          )}

          {reposLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: ds.muted, fontSize: '0.85rem', padding: '16px 0' }}>
              <Spinner color={ds.muted} /> Loading your repos…
            </div>
          ) : repos.length === 0 ? (
            <div style={{ background: ds.surface, border: `1px solid ${ds.border}`, borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ color: ds.muted, fontSize: '0.875rem', margin: 0 }}>No repos yet. Add a public GitHub repo above to get started.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {repos.map(repo => (
                <RepoCard key={repo.id} repo={repo} onDelete={id => setRepos(prev => prev.filter(r => r.id !== id))} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
