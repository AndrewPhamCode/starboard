import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { API_URL } from '../lib/api'
import Editor from '@monaco-editor/react'
import LeetCodeScoreCard, { type LeetCodeScore } from '../components/LeetCodeScoreCard'

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Language = 'python' | 'javascript' | 'java' | 'cpp'
type SessionPhase =
  | 'idle'
  | 'intro_speaking'
  | 'coding_free'
  | 'ai_speaking'
  | 'user_responding'
  | 'ai_processing'
  | 'end_speaking'
  | 'scoring'
  | 'results'

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
  starter_code: Record<Language, string>
}

interface SessionTurn {
  role: 'interviewer' | 'candidate'
  content: string
  timestamp: number
  trigger?: string
}

interface CodeRun {
  code: string
  language: Language
  stdout: string
  stderr: string
  compile_output: string
  exit_code: number
  timestamp: number
}

/* ─── TTS (reused from InterviewSession) ────────────────────────────────── */
let activeAudio: HTMLAudioElement | null = null

function stopAudio() {
  if (activeAudio) { activeAudio.pause(); activeAudio = null }
}

async function speak(text: string, onEnd: () => void) {
  stopAudio()
  try {
    const res = await fetch(`${API_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error('TTS failed')

    // MediaSource streaming: start playing as chunks arrive (Chrome/Firefox)
    if (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg') && res.body) {
      await new Promise<void>((resolve) => {
        const ms = new MediaSource()
        const objUrl = URL.createObjectURL(ms)
        const audio = new Audio(objUrl)
        activeAudio = audio

        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          URL.revokeObjectURL(objUrl)
          activeAudio = null
          onEnd()
          resolve()
        }
        audio.onended = finish
        audio.onerror = finish

        ms.addEventListener('sourceopen', async () => {
          let sb: SourceBuffer
          try { sb = ms.addSourceBuffer('audio/mpeg') }
          catch { finish(); return }

          let playStarted = false
          const tryPlay = () => {
            if (!playStarted) { playStarted = true; audio.play().catch(() => {}) }
          }
          audio.addEventListener('canplay', tryPlay, { once: true })

          const reader = res.body!.getReader()
          try {
            for (;;) {
              const { done, value } = await reader.read()
              if (done) {
                if (ms.readyState === 'open') ms.endOfStream()
                tryPlay()
                break
              }
              await new Promise<void>((ok, fail) => {
                sb.addEventListener('updateend', () => ok(), { once: true })
                sb.addEventListener('error', fail, { once: true })
                try { sb.appendBuffer(value) } catch (e) { fail(e) }
              })
              tryPlay()
            }
          } catch {
            if (ms.readyState === 'open') ms.endOfStream()
            finish()
          }
        })
      })
      return
    }

    // Fallback: collect full blob then play (Safari)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    activeAudio = audio
    audio.onended = () => { URL.revokeObjectURL(url); activeAudio = null; onEnd() }
    audio.onerror = () => { URL.revokeObjectURL(url); activeAudio = null; onEnd() }
    await audio.play()
  } catch {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.92
    u.onend = onEnd
    window.speechSynthesis.speak(u)
  }
}

/* ─── Mic recording (reused from InterviewSession) ──────────────────────── */
function useRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const cachedStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)

  async function acquireMic(): Promise<void> {
    if (cachedStreamRef.current) return
    cachedStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
  }

  function startRecording(): void {
    const stream = cachedStreamRef.current
    if (!stream) throw new Error('Microphone not acquired')
    chunksRef.current = []
    startTimeRef.current = Date.now()
    const mr = new MediaRecorder(stream)
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.start()
    mediaRecorderRef.current = mr
  }

  function stopRecording(): Promise<{ blob: Blob; duration: number }> {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current
      if (!mr || mr.state === 'inactive') { resolve({ blob: new Blob(), duration: 0 }); return }
      const duration = (Date.now() - startTimeRef.current) / 1000
      mr.onstop = () => {
        resolve({ blob: new Blob(chunksRef.current, { type: 'audio/webm' }), duration })
      }
      mr.stop()
    })
  }

  function releaseMic(): void {
    cachedStreamRef.current?.getTracks().forEach(t => t.stop())
    cachedStreamRef.current = null
  }

  function getStream(): MediaStream | null {
    return cachedStreamRef.current
  }

  return { acquireMic, startRecording, stopRecording, releaseMic, getStream }
}

/* ─── Live caption (reused from InterviewSession) ───────────────────────── */
type AnySR = {
  continuous: boolean; interimResults: boolean; lang: string
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: unknown) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void
}
type SRCtor = new () => AnySR
declare const webkitSpeechRecognition: SRCtor | undefined
const SR_FATAL = new Set(['not-allowed', 'audio-capture', 'network', 'service-not-allowed'])

function useLiveCaption(active: boolean) {
  const [caption, setCaption] = useState('')
  const recRef = useRef<AnySR | null>(null)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    const SR: SRCtor | undefined =
      (typeof window !== 'undefined' && 'SpeechRecognition' in window
        ? (window as unknown as { SpeechRecognition: SRCtor }).SpeechRecognition
        : undefined) ?? (typeof webkitSpeechRecognition !== 'undefined' ? webkitSpeechRecognition : undefined)
    if (!SR) return
    if (!active) { recRef.current?.stop(); recRef.current = null; setCaption(''); return }
    setCaption('')
    let fatal = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const rec = new SR()
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US'
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t; else interim += t
      }
      setCaption(prev => final ? prev + final : prev.split('…')[0] + (interim ? '… ' + interim : ''))
    }
    rec.onerror = (e: unknown) => {
      const name = (e as { error?: string })?.error ?? 'unknown'
      if (SR_FATAL.has(name)) fatal = true
    }
    rec.onend = () => {
      if (activeRef.current && !fatal) {
        timer = setTimeout(() => { if (activeRef.current && !fatal) rec.start() }, 300)
      }
    }
    rec.start(); recRef.current = rec
    return () => { fatal = true; if (timer) clearTimeout(timer); recRef.current?.stop(); recRef.current = null }
  }, [active])

  return caption
}

/* ─── Voice meter ────────────────────────────────────────────────────────── */
interface VoiceMeterOptions {
  onSilenceAfterSpeech?: () => void
  silenceThreshold?: number
  silenceDurationMs?: number
}

function useVoiceMeter(
  active: boolean,
  getStream: () => MediaStream | null,
  options?: VoiceMeterOptions,
): number {
  const [volume, setVolume] = useState(0)
  const rafRef = useRef<number | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const callbackRef = useRef<(() => void) | undefined>(undefined)
  const hasSpokeRef = useRef(false)
  const silenceStartRef = useRef<number | null>(null)

  callbackRef.current = options?.onSilenceAfterSpeech

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ctxRef.current?.close()
      ctxRef.current = null
      hasSpokeRef.current = false
      silenceStartRef.current = null
      setVolume(0)
      return
    }
    hasSpokeRef.current = false
    silenceStartRef.current = null
    const stream = getStream()
    if (!stream) return
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    ctx.createMediaStreamSource(stream).connect(analyser)
    ctxRef.current = ctx
    const data = new Uint8Array(analyser.frequencyBinCount)
    function tick() {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.min(1, Math.sqrt(sum / data.length) * 6)
      setVolume(rms)

      const threshold = options?.silenceThreshold ?? 0.08
      const durationMs = options?.silenceDurationMs ?? 1800
      if (rms >= threshold) {
        hasSpokeRef.current = true
        silenceStartRef.current = null
      } else if (hasSpokeRef.current) {
        if (silenceStartRef.current === null) {
          silenceStartRef.current = performance.now()
        } else if (performance.now() - silenceStartRef.current >= durationMs) {
          hasSpokeRef.current = false
          silenceStartRef.current = null
          callbackRef.current?.()
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ctx.close()
      ctxRef.current = null
    }
  }, [active])

  return volume
}

const BAR_WEIGHTS = [0.5, 0.75, 0.9, 1.0, 0.95, 0.85, 0.7, 0.55]

function VoiceMeter({ volume }: { volume: number }) {
  return (
    <div className="flex items-center gap-[3px]" style={{ height: 24 }}>
      {BAR_WEIGHTS.map((w, i) => {
        const h = Math.max(4, Math.round(volume * 24 * w))
        return (
          <div
            key={i}
            className="w-[3px] rounded-full transition-all duration-75"
            style={{
              height: h,
              background: volume > 0.15 ? '#22c55e' : '#d1d5db',
            }}
          />
        )
      })}
    </div>
  )
}

/* ─── Difficulty badge ───────────────────────────────────────────────────── */
function DiffBadge({ d }: { d: string }) {
  const cls =
    d === 'easy' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
    d === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-300' :
    'bg-red-100 text-red-700 border-red-300'
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {d.charAt(0).toUpperCase() + d.slice(1)}
    </span>
  )
}

const MONACO_LANG: Record<Language, string> = {
  python: 'python', javascript: 'javascript', java: 'java', cpp: 'cpp',
}

const LANG_LABELS: Record<Language, string> = {
  python: 'Python', javascript: 'JavaScript', java: 'Java', cpp: 'C++',
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function LeetCodeSession() {
  const location = useLocation()
  const navigate = useNavigate()
  const problem: LeetCodeProblem | undefined = (location.state as { problem?: LeetCodeProblem })?.problem

  const [phase, setPhase] = useState<SessionPhase>('idle')
  const [language, setLanguage] = useState<Language>('python')
  const [codeByLang, setCodeByLang] = useState<Record<Language, string>>(() => ({
    python: problem?.starter_code.python ?? '',
    javascript: problem?.starter_code.javascript ?? '',
    java: problem?.starter_code.java ?? '',
    cpp: problem?.starter_code.cpp ?? '',
  }))
  const [runOutput, setRunOutput] = useState<CodeRun | null>(null)
  const [runLoading, setRunLoading] = useState(false)
  const [sessionLog, setSessionLog] = useState<SessionTurn[]>([])
  const [codeRuns, setCodeRuns] = useState<CodeRun[]>([])
  const [aiText, setAiText] = useState('')
  const [score, setScore] = useState<LeetCodeScore | null>(null)
  const [endingInterview, setEndingInterview] = useState(false)

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const followUpCountRef = useRef(0)  // user_question exchanges since last run_success
  const postRunRef = useRef(false)    // true after run_success, reset on new run

  const { acquireMic, startRecording, stopRecording, releaseMic, getStream } = useRecorder()
  const caption = useLiveCaption(phase === 'user_responding' || phase === 'coding_free')
  const meterActive = phase === 'coding_free' || phase === 'user_responding'
  const volume = useVoiceMeter(meterActive, getStream, {
    onSilenceAfterSpeech: () => {
      if (phaseRef.current === 'coding_free') submitQuestion()
    },
    silenceDurationMs: 1400,
  })

  // Silence detection for both always-on (coding_free) and end-interview (user_responding)
  useEffect(() => {
    if (phase === 'user_responding') {
      // End-of-interview final remarks — silence or 45s max → finish
      if (!maxDurationTimerRef.current) {
        maxDurationTimerRef.current = setTimeout(() => {
          if (phaseRef.current === 'user_responding') finishSession()
        }, 45000)
      }
      if (!caption.trim()) return
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        if (phaseRef.current === 'user_responding') finishSession()
      }, 2500)
      return
    }

    if (phase === 'coding_free') {
      return  // silence detection handled by useVoiceMeter RAF loop
    }

    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
    if (maxDurationTimerRef.current) { clearTimeout(maxDurationTimerRef.current); maxDurationTimerRef.current = null }
  }, [phase])

  // Pre-acquire mic on mount so the first interview turn has no permission delay
  useEffect(() => {
    acquireMic().catch(() => {})
  }, [])

  // Redirect if no problem in state
  useEffect(() => {
    if (!problem) navigate('/practice/leetcode', { replace: true })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio()
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current)
      releaseMic()
    }
  }, [])

  // Always-on: start recording fresh whenever we enter coding_free
  useEffect(() => {
    if (phase !== 'coding_free') return
    try { startRecording() } catch { /* mic not acquired yet */ }
  }, [phase])

  function resetIdleTimer() {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      if (phaseRef.current === 'coding_free') {
        triggerAIMessage('idle')
      }
    }, 2 * 60 * 1000)
  }

  function appendTurn(role: SessionTurn['role'], content: string, trigger?: string) {
    setSessionLog(prev => [...prev, { role, content, timestamp: Date.now(), trigger }])
  }

  async function fetchInterviewerMessage(trigger: string, currentRunOutput?: CodeRun | null, pendingUtterance?: string) {
    if (!problem) return ''
    // Build log from current state, then manually append the pending candidate utterance
    // so the AI sees it immediately without waiting for React to commit the state update
    const log = sessionLog.slice(-6).map(t => ({ role: t.role, content: t.content }))
    if (pendingUtterance) log.push({ role: 'candidate', content: pendingUtterance })
    const res = await fetch(`${API_URL}/api/leetcode/interviewer-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem_title: problem.title,
        problem_description: problem.description,
        trigger,
        current_code: codeByLang[language],
        run_output: currentRunOutput ? {
          stdout: currentRunOutput.stdout,
          stderr: currentRunOutput.stderr,
          compile_output: currentRunOutput.compile_output,
          exit_code: currentRunOutput.exit_code,
        } : null,
        session_log: log,
        follow_up_hints: problem.follow_up_hints,
      }),
    })
    if (!res.ok) throw new Error('Failed to get interviewer message')
    const data = await res.json()
    return data.message as string
  }

  async function triggerAIMessage(trigger: string, currentRunOutput?: CodeRun | null, pendingUtterance?: string) {
    if (!problem) return
    // Stop any in-progress always-on recording before AI speaks
    try { await stopRecording() } catch { /* ignore */ }
    setPhase('ai_speaking')
    try {
      const message = await fetchInterviewerMessage(trigger, currentRunOutput, pendingUtterance)
      setAiText(message)
      appendTurn('interviewer', message, trigger)
      speak(message, () => {
        // Return to always-on listening mode
        setPhase('coding_free')
      })
    } catch {
      setPhase('coding_free')
    }
  }

  async function beginInterview() {
    if (!problem) return
    await acquireMic()
    setPhase('intro_speaking')
    try {
      const message = await fetchInterviewerMessage('start')
      setAiText(message)
      appendTurn('interviewer', message, 'start')
      speak(message, () => {
        // Drop into always-on listening
        setPhase('coding_free')
      })
    } catch {
      setPhase('coding_free')
      resetIdleTimer()
    }
  }

  async function submitQuestion() {
    const captionText = caption.trim()
    setPhase('ai_processing')

    let blob = new Blob()
    try {
      const result = await stopRecording()
      blob = result.blob
    } catch { /* ignore */ }

    if (captionText) {
      // Fast path: caption already available — skip Whisper, call Claude immediately
      appendTurn('candidate', captionText)
      if (postRunRef.current && ++followUpCountRef.current >= 2) {
        await finishSession(); return
      }
      await triggerAIMessage('user_question', null, captionText)
    } else {
      // Slow path: no caption — fall back to Whisper
      let utterance: string | undefined
      try {
        if (blob.size > 100) {
          const form = new FormData()
          form.append('audio', blob, 'question.webm')
          const res = await fetch(`${API_URL}/api/transcribe`, { method: 'POST', body: form })
          if (res.ok) {
            const { transcript } = await res.json()
            const clean = transcript.trim()
            if (clean) {
              utterance = clean
              appendTurn('candidate', clean)
            }
          }
        }
      } catch { /* ignore */ }
      if (postRunRef.current && ++followUpCountRef.current >= 2) {
        await finishSession(); return
      }
      await triggerAIMessage('user_question', null, utterance)
    }
  }

  async function handleRun() {
    if (!problem || runLoading) return
    setRunLoading(true)
    resetIdleTimer()
    try {
      const res = await fetch(`${API_URL}/api/leetcode/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code: codeByLang[language], problem_id: problem.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail ?? 'Execution failed')
      const run: CodeRun = {
        code: codeByLang[language], language,
        stdout: data.stdout ?? '',
        stderr: data.stderr ?? '',
        compile_output: data.compile_output ?? '',
        exit_code: data.exit_code ?? 0,
        timestamp: Date.now(),
      }
      setRunOutput(run)
      setCodeRuns(prev => [...prev, run])

      if (phaseRef.current === 'coding_free') {
        const hasError = run.exit_code !== 0 || run.stderr || run.compile_output
        postRunRef.current = !hasError
        followUpCountRef.current = 0
        triggerAIMessage(hasError ? 'run_error' : 'run_success', run)
      }
    } catch (e) {
      setRunOutput({
        code: codeByLang[language], language,
        stdout: '', stderr: (e instanceof Error ? e.message : 'Unknown error'),
        compile_output: '', exit_code: 1, timestamp: Date.now(),
      })
    } finally {
      setRunLoading(false)
    }
  }

  async function handleEndInterview() {
    if (endingInterview) return
    setEndingInterview(true)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    stopAudio()
    await finishSession()
  }

  async function finishSession() {
    if (!problem) return
    setPhase('ai_processing')
    try {
      const { blob } = await stopRecording()
      if (blob.size > 100) {
        const form = new FormData()
        form.append('audio', blob, 'final.webm')
        const res = await fetch(`${API_URL}/api/transcribe`, { method: 'POST', body: form })
        if (res.ok) {
          const { transcript } = await res.json()
          if (transcript?.trim()) appendTurn('candidate', transcript.trim())
        }
      }
    } catch { /* ignore */ }

    setPhase('scoring')
    try {
      const res = await fetch(`${API_URL}/api/leetcode/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_title: problem.title,
          problem_description: problem.description,
          session_log: sessionLog.map(t => ({ role: t.role, content: t.content })),
          code_runs: codeRuns.map(r => ({
            exit_code: r.exit_code, stdout: r.stdout, stderr: r.stderr,
          })),
          final_code: codeByLang[language],
          language,
        }),
      })
      if (!res.ok) throw new Error('Scoring failed')
      const result = await res.json()
      setScore(result)
      // Silently persist session if user is signed in
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase.from('interview_sessions').insert({
          user_id: user.id,
          type: 'leetcode',
          question: problem.title,
          score: result,
        })
      })
      releaseMic()
      setPhase('results')
    } catch {
      setPhase('coding_free')
      setEndingInterview(false)
    }
  }

  if (!problem) return null

  /* ── Results screen ─────────────────────────────────────────────────────── */
  if (phase === 'results' && score) {
    return (
      <LeetCodeScoreCard
        score={score}
        problemTitle={problem.title}
        onPracticeAgain={() => navigate('/practice/leetcode')}
      />
    )
  }

  /* ── Scoring spinner ────────────────────────────────────────────────────── */
  if (phase === 'scoring') {
    return (
      <div style={{ minHeight: '100vh', background: '#0c0c0e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24" style={{ color: '#10b981' }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
        <p style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: '1.1rem', color: '#f0f0f0', margin: 0 }}>
          Scoring your interview…
        </p>
        <p style={{ color: '#6b6b7a', fontSize: '0.875rem', margin: 0 }}>Analyzing your communication, code, and complexity discussion</p>
      </div>
    )
  }

  const currentCode = codeByLang[language]
  const hasSuccess = runOutput && runOutput.exit_code === 0 && !runOutput.stderr && !runOutput.compile_output

  /* ── Main editor UI ─────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0c0c0e', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <header style={{ background: '#141416', borderBottom: '1px solid #2a2a2e', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0, height: 52 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            onClick={() => navigate('/practice/leetcode')}
            style={{ color: '#6b6b7a', fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0, fontFamily: "'Inter', system-ui, sans-serif', transition: 'color 0.15s'" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f0f0f0' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#6b6b7a' }}
          >
            ← Back
          </button>
          <div style={{ width: 1, height: 14, background: '#2a2a2e', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, color: '#f0f0f0', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {problem.title}
          </span>
          <DiffBadge d={problem.difficulty} />
          {phase === 'user_responding' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
              Recording
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {(['python', 'javascript', 'java', 'cpp'] as Language[]).map(lang => (
            <button
              key={lang}
              onClick={() => { setLanguage(lang); setRunOutput(null) }}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: `1px solid ${language === lang ? '#10b981' : '#2a2a2e'}`,
                background: language === lang ? 'rgba(16,185,129,0.12)' : 'transparent',
                color: language === lang ? '#34d399' : '#6b6b7a',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
                transition: 'all 0.15s',
              }}
            >
              {LANG_LABELS[lang]}
            </button>
          ))}

          <button
            onClick={handleRun}
            disabled={runLoading}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: '#10b981',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              opacity: runLoading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            {runLoading ? (
              <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
              </svg>
            )}
            Run
          </button>

          {phase !== 'idle' && (
            <button
              onClick={handleEndInterview}
              disabled={endingInterview}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid #2a2a2e',
                background: 'transparent',
                color: '#6b6b7a',
                fontWeight: 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                opacity: endingInterview ? 0.5 : 1,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              End Interview
            </button>
          )}
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex flex-row flex-1 min-h-0">

        {/* Left pane — problem */}
        <div
          style={{ width: '42%', overflowY: 'auto', background: '#0f0f11', borderRight: '1px solid #2a2a2e', padding: '18px 20px', height: 'calc(100vh - 52px)' }}
        >
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.1em', color: '#10b981' }}>
              #{problem.neetcode_number} · {problem.category.replace(/-/g, ' ')}
            </span>
          </div>

          <p style={{ fontSize: '0.875rem', color: '#a1a1aa', lineHeight: 1.65, marginBottom: 18, whiteSpace: 'pre-line' }}>
            {problem.description}
          </p>

          {problem.examples.map((ex, i) => (
            <div
              key={i}
              style={{ border: '1px solid #2a2a2e', borderRadius: 8, background: '#141416', padding: '12px 14px', marginBottom: 10 }}
            >
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: '#10b981', marginBottom: 8 }}>
                EXAMPLE {i + 1}
              </p>
              <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: '#d4d4d8', display: 'block', marginBottom: 3 }}>Input: {ex.input}</code>
              <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: '#d4d4d8', display: 'block', marginBottom: 3 }}>Output: {ex.output}</code>
              {ex.explanation && <p style={{ fontSize: '0.75rem', color: '#6b6b7a', marginTop: 4 }}>{ex.explanation}</p>}
            </div>
          ))}

          <div style={{ marginTop: 16 }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: '#52525b', marginBottom: 8 }}>CONSTRAINTS</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {problem.constraints.map((c, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.78rem', color: '#6b6b7a' }}>
                  <span style={{ color: '#10b981', marginTop: 1, flexShrink: 0 }}>·</span> {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right pane — editor + output + voice bar */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Monaco editor */}
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language={MONACO_LANG[language]}
              value={currentCode}
              onChange={(val) => {
                setCodeByLang(prev => ({ ...prev, [language]: val ?? '' }))
                if (phaseRef.current === 'coding_free') resetIdleTimer()
              }}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                tabSize: language === 'python' ? 4 : 2,
                automaticLayout: true,
                padding: { top: 12 },
                quickSuggestions: { other: true, comments: false, strings: false },
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: 'on',
                wordBasedSuggestions: 'matchingDocuments',
                parameterHints: { enabled: true },
              }}
            />
          </div>

          {/* Output panel */}
          <div className="shrink-0 bg-gray-950 border-t-[3px] border-gray-700 font-mono text-xs" style={{ height: 140 }}>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Output</span>
              {runOutput && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  hasSuccess ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'
                }`}>
                  {hasSuccess ? 'Success' : `Error (exit ${runOutput.exit_code})`}
                </span>
              )}
              {runLoading && <span className="text-amber-400 text-xs animate-pulse">Running…</span>}
            </div>
            <div className="px-4 py-2 overflow-y-auto" style={{ maxHeight: 100 }}>
              {!runOutput && !runLoading && (
                <span className="text-gray-600">Click Run ▶ to execute your code.</span>
              )}
              {runOutput?.compile_output && (
                <pre className="text-red-400 whitespace-pre-wrap">{runOutput.compile_output}</pre>
              )}
              {runOutput?.stderr && (
                <pre className="text-red-400 whitespace-pre-wrap">{runOutput.stderr}</pre>
              )}
              {runOutput?.stdout && (
                <pre className="text-green-300 whitespace-pre-wrap">{runOutput.stdout}</pre>
              )}
              {runOutput && !runOutput.stdout && !runOutput.stderr && !runOutput.compile_output && (
                <span className="text-gray-500">(no output)</span>
              )}
            </div>
          </div>

          {/* AI Voice bar */}
          <div
            style={{ flexShrink: 0, borderTop: '1px solid #2a2a2e', background: '#141416', display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 64 }}
          >
            {phase === 'idle' && (
              <button
                onClick={beginInterview}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#7c3aed',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#6d28d9' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#7c3aed' }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                </svg>
                Start Interview
              </button>
            )}

            {(phase === 'intro_speaking' || phase === 'ai_speaking' || phase === 'end_speaking') && (
              <>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', animation: `bounce 1.2s infinite ${i * 0.2}s` }}
                    />
                  ))}
                </div>
                <p style={{ fontSize: '0.875rem', color: '#a1a1aa', fontWeight: 500, lineHeight: 1.4, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{aiText}</p>
              </>
            )}

            {phase === 'user_responding' && (
              <>
                <VoiceMeter volume={volume} />
                <p style={{ fontSize: '0.875rem', color: caption ? '#d4d4d8' : '#52525b', fontStyle: caption ? 'italic' : 'normal', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {caption || 'Listening…'}
                </p>
                <button
                  onClick={finishSession}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: '1px solid #2a2a2e',
                    background: 'transparent',
                    color: '#6b6b7a',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    flexShrink: 0,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#52525b'; e.currentTarget.style.color = '#f0f0f0' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2e'; e.currentTarget.style.color = '#6b6b7a' }}
                >
                  Done
                </button>
              </>
            )}

            {phase === 'ai_processing' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24" style={{ color: '#7c3aed', flexShrink: 0 }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span style={{ fontSize: '0.875rem', color: '#6b6b7a' }}>Processing…</span>
              </div>
            )}

            {phase === 'coding_free' && (
              <>
                <VoiceMeter volume={volume} />
                <p style={{ fontSize: '0.875rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: caption.trim() ? '#d4d4d8' : '#52525b', fontStyle: caption.trim() ? 'italic' : 'normal' }}>
                  {caption.trim() || 'Listening — just ask me anything…'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
