import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ScoreResult } from '../components/StarScoreCard'
import StarScoreCard from '../components/StarScoreCard'
import type { DesignScoreResult } from '../components/DesignScoreCard'
import DesignScoreCard from '../components/DesignScoreCard'
import { supabase } from '../lib/supabase'
import { API_URL } from '../lib/api'

type SessionState =
  | 'intro'
  | 'question_speaking'
  | 'recording'
  | 'processing'
  | 'ai_speaking'
  | 'scoring'
  | 'results'

interface Question {
  id: number
  text: string
  category: string
  type: string
}

/* ─── Extract a readable message from FastAPI error responses ───────────── */
async function apiError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    const d = body?.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d) && d.length > 0) {
      const first = d[0]
      return `${first?.loc?.slice(-1)[0] ?? 'field'}: ${first?.msg ?? 'invalid'}`
    }
    return `Server error ${res.status}`
  } catch {
    return `Server error ${res.status}`
  }
}

/* ─── TTS helper — uses OpenAI TTS API for natural-sounding voice ─────────── */
let activeAudio: HTMLAudioElement | null = null

function stopAudio() {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio = null
  }
}

async function speak(text: string, onEnd: () => void) {
  stopAudio()
  try {
    const res = await fetch(`${API_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error('TTS request failed')

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
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.92
    utterance.onend = onEnd
    window.speechSynthesis.speak(utterance)
  }
}

/* ─── Silence detector hook ─────────────────────────────────────────────── */
function useSilenceDetector(
  enabled: boolean,
  getStream: () => MediaStream | null,
  onSilence: () => void,
  minMs = 5000,
  silenceMs = 2000,
): number | null {
  const [countdown, setCountdown] = useState<number | null>(null)
  const stateRef = useRef({ silentSince: 0, startedAt: 0, fired: false })

  useEffect(() => {
    if (!enabled) {
      setCountdown(null)
      stateRef.current = { silentSince: 0, startedAt: 0, fired: false }
      return
    }
    const stream = getStream()
    if (!stream) return

    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    stateRef.current = { silentSince: 0, startedAt: Date.now(), fired: false }

    const tick = setInterval(() => {
      const s = stateRef.current
      if (s.fired) return
      if (Date.now() - s.startedAt < minMs) return

      analyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length

      if (avg < 8) {
        if (!s.silentSince) s.silentSince = Date.now()
        const silentFor = Date.now() - s.silentSince
        const remaining = Math.ceil((silenceMs - silentFor) / 1000)
        setCountdown(remaining > 0 ? remaining : 0)
        if (silentFor >= silenceMs) {
          s.fired = true
          onSilence()
        }
      } else {
        s.silentSince = 0
        setCountdown(null)
      }
    }, 100)

    return () => {
      clearInterval(tick)
      ctx.close()
      setCountdown(null)
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return countdown
}

/* ─── Mic recording hook ─────────────────────────────────────────────────── */
function useRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const cachedStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)

  // Call this from a user-gesture handler (button click) to pre-acquire mic permission.
  // Chrome requires getUserMedia to be triggered by a user gesture — TTS callbacks don't qualify.
  async function acquireMic(): Promise<void> {
    if (cachedStreamRef.current) return // already have it
    console.log('[mic] requesting getUserMedia...')
    cachedStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    console.log('[mic] granted, tracks:', cachedStreamRef.current.getTracks().map(t => `${t.kind} enabled=${t.enabled} muted=${t.muted}`))
  }

  function startRecording(): void {
    const stream = cachedStreamRef.current
    if (!stream) throw new Error('Microphone not acquired — call acquireMic() first.')
    console.log('[recorder] starting, stream active:', stream.active, 'tracks:', stream.getTracks().map(t => `${t.kind} readyState=${t.readyState}`))
    chunksRef.current = []
    startTimeRef.current = Date.now()
    const mr = new MediaRecorder(stream)
    mr.ondataavailable = (e) => {
      console.log('[recorder] data chunk:', e.data.size, 'bytes')
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    mr.start()
    console.log('[recorder] MediaRecorder state:', mr.state)
    mediaRecorderRef.current = mr
  }

  function stopRecording(): Promise<{ blob: Blob; duration: number }> {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current
      if (!mr) return
      const duration = (Date.now() - startTimeRef.current) / 1000
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        // Leave the stream open so the second recording can reuse it
        resolve({ blob, duration })
      }
      mr.stop()
    })
  }

  function releaseMic(): void {
    cachedStreamRef.current?.getTracks().forEach(t => t.stop())
    cachedStreamRef.current = null
  }

  function getStream() { return cachedStreamRef.current }

  function muteAudio(muted: boolean): void {
    cachedStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted })
  }

  return { acquireMic, startRecording, stopRecording, releaseMic, getStream, muteAudio }
}

/* ─── Live caption hook (SpeechRecognition, Chrome/Edge only) ───────────── */
type AnySR = {
  continuous: boolean; interimResults: boolean; lang: string
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: unknown) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void
}
type SRConstructor = new () => AnySR
declare const webkitSpeechRecognition: SRConstructor | undefined

// Fatal SR errors that should stop the restart loop — mic in use, permission denied, network down
const SR_FATAL_ERRORS = new Set(['not-allowed', 'audio-capture', 'network', 'service-not-allowed'])

function useLiveCaption(active: boolean) {
  const [caption, setCaption] = useState('')
  const recognitionRef = useRef<AnySR | null>(null)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    const SR: SRConstructor | undefined =
      (typeof window !== 'undefined' && 'SpeechRecognition' in window
        ? (window as unknown as { SpeechRecognition: SRConstructor }).SpeechRecognition
        : undefined) ??
      (typeof webkitSpeechRecognition !== 'undefined' ? webkitSpeechRecognition : undefined)

    if (!SR) { console.warn('[caption] SpeechRecognition not supported'); return }

    if (!active) {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      setCaption('')
      return
    }

    setCaption('')
    let fatalError = false
    let restartTimer: ReturnType<typeof setTimeout> | null = null

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      setCaption((prev) => (final ? prev + final : prev.split('…')[0] + (interim ? '… ' + interim : '')))
    }

    rec.onerror = (e: unknown) => {
      const errName = (e as { error?: string })?.error ?? 'unknown'
      console.error('[caption] SpeechRecognition error:', errName, e)
      if (SR_FATAL_ERRORS.has(errName)) {
        console.warn('[caption] fatal error, stopping SR restarts:', errName)
        fatalError = true
      }
    }

    rec.onend = () => {
      if (activeRef.current && !fatalError) {
        // Small delay prevents a tight loop if SR keeps failing immediately
        restartTimer = setTimeout(() => { if (activeRef.current && !fatalError) rec.start() }, 300)
      }
    }

    console.log('[caption] SpeechRecognition starting...')
    rec.start()
    recognitionRef.current = rec

    return () => {
      fatalError = true
      if (restartTimer) clearTimeout(restartTimer)
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [active])

  return caption
}

/* ─── Waveform bars (speaking animation) ────────────────────────────────── */
function WaveformBars() {
  const bars = [
    { x: 1,  hVals: '6;22;10;18;6',  yVals: '11;3;9;5;11',  delay: '0s' },
    { x: 13, hVals: '14;8;24;6;14',  yVals: '7;10;2;11;7',  delay: '0.12s' },
    { x: 25, hVals: '20;12;6;20;20', yVals: '4;8;11;4;4',   delay: '0.04s' },
    { x: 37, hVals: '8;18;22;8;8',   yVals: '10;5;3;10;10', delay: '0.2s' },
    { x: 49, hVals: '18;6;14;22;18', yVals: '5;11;7;3;5',   delay: '0.08s' },
  ]
  const spline = '0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1'
  return (
    <svg width="60" height="28" viewBox="0 0 60 28" style={{ display: 'block' }}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} width={10} rx={5} fill="#22c55e" fillOpacity={0.9}>
          <animate attributeName="height" values={b.hVals} dur="0.85s" repeatCount="indefinite" begin={b.delay} calcMode="spline" keySplines={spline}/>
          <animate attributeName="y" values={b.yVals} dur="0.85s" repeatCount="indefinite" begin={b.delay} calcMode="spline" keySplines={spline}/>
        </rect>
      ))}
    </svg>
  )
}

/* ─── Thinking dots (processing state) ──────────────────────────────────── */
function ThinkingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {[0, 0.18, 0.36].map((delay, i) => (
        <div key={i} className="animate-bounce" style={{ width: 8, height: 8, borderRadius: '50%', background: '#4b5563', animationDelay: `${delay}s` }}/>
      ))}
    </div>
  )
}

/* ─── Interviewer avatar — clean photo-style initials card ──────────────── */
function AvatarIllustration({ speaking }: { speaking?: boolean }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(145deg, #1e2d45 0%, #162236 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 0, position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle background texture */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(99,130,190,0.08) 0%, transparent 70%)',
      }} />
      {/* Shoulders silhouette */}
      <div style={{
        position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
        width: 240, height: 110,
        background: 'linear-gradient(180deg, #1a2e4a 0%, #111c2e 100%)',
        borderRadius: '50% 50% 0 0 / 30% 30% 0 0',
      }} />
      {/* Head circle */}
      <div style={{
        width: 88, height: 88, borderRadius: '50%',
        background: 'linear-gradient(145deg, #2d4a72, #1e3255)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 1,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: '2rem', fontWeight: 700,
          color: '#93b4d4', letterSpacing: '-0.02em',
          userSelect: 'none',
        }}>A</span>
      </div>
      {/* Speaking mouth animation */}
      <div style={{ position: 'relative', zIndex: 1, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        {speaking ? (
          [0.9, 0.6, 1, 0.7, 0.85].map((scale, i) => (
            <div key={i} style={{
              width: 3, height: `${10 * scale}px`, borderRadius: 2,
              background: '#4a9eff', opacity: 0.7,
            }} className="animate-pulse" />
          ))
        ) : (
          <div style={{ width: 20, height: 2, background: 'rgba(100,130,180,0.3)', borderRadius: 2 }} />
        )}
      </div>
    </div>
  )
}

/* ─── User camera pip — draggable, resizable, speaking indicator ─────────── */
function UserCamera({ isSpeaking, cameraOn }: { isSpeaking: boolean; cameraOn: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [available, setAvailable] = useState(true)

  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = cameraOn })
  }, [cameraOn])

  // Position and size — initialized to bottom-right
  const [pos, setPos] = useState(() => ({ x: window.innerWidth - 180, y: window.innerHeight - 72 - 140 }))
  const [size, setSize] = useState({ w: 160, h: 120 })

  // Refs so event handlers always see latest values without re-registering
  const posRef = useRef(pos)
  posRef.current = pos
  const sizeRef = useRef(size)
  sizeRef.current = size

  const drag = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 })
  const resize = useRef({ active: false, startX: 0, startY: 0, origW: 0, origH: 0 })
  const [grabbing, setGrabbing] = useState(false)

  /* ── Camera setup (video only — no audio here to avoid mic conflicts with SpeechRecognition) ── */
  useEffect(() => {
    let videoStream: MediaStream | null = null

    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(vs => {
        videoStream = vs
        streamRef.current = vs
        if (videoRef.current) videoRef.current.srcObject = vs
      })
      .catch(() => setAvailable(false))

    return () => {
      videoStream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  /* ── Global mouse handlers for drag + resize ── */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (drag.current.active) {
        const { w, h } = sizeRef.current
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - w, drag.current.origX + e.clientX - drag.current.startX)),
          y: Math.max(0, Math.min(window.innerHeight - h, drag.current.origY + e.clientY - drag.current.startY)),
        })
      }
      if (resize.current.active) {
        setSize({
          w: Math.max(120, Math.min(480, resize.current.origW + e.clientX - resize.current.startX)),
          h: Math.max(90, Math.min(360, resize.current.origH + e.clientY - resize.current.startY)),
        })
      }
    }
    const onUp = () => {
      drag.current.active = false
      resize.current.active = false
      setGrabbing(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const borderColor = isSpeaking ? '#22c55e' : '#4b5563'
  const glowStyle = isSpeaking
    ? '0 0 0 3px rgba(34,197,94,0.35), 3px 3px 0px #111827'
    : '3px 3px 0px #111827'

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: 50,
        borderRadius: 16,
        overflow: 'hidden',
        border: `3px solid ${borderColor}`,
        boxShadow: glowStyle,
        cursor: grabbing ? 'grabbing' : 'grab',
        background: '#1f2937',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        userSelect: 'none',
      }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).dataset.resize) return
        e.preventDefault()
        drag.current = { active: true, startX: e.clientX, startY: e.clientY, origX: posRef.current.x, origY: posRef.current.y }
        setGrabbing(true)
      }}
    >
      {available
        ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }}
            />
            {!cameraOn && (
              <div style={{ position: 'absolute', inset: 0, background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2">
                  <line x1="2" y1="2" x2="22" y2="22" /><path d="M10.68 10.68A2 2 0 0 0 10 12a2 2 0 0 0 2 2 2 2 0 0 0 1.32-.68" /><path d="M16.73 16.73A9.87 9.87 0 0 1 12 18c-5 0-9-4-9-8a9.6 9.6 0 0 1 2.27-4.73" /><path d="M6.61 6.61A9.6 9.6 0 0 0 3 10c0 4 4 8 9 8a9.87 9.87 0 0 0 4.73-1.27" />
                </svg>
              </div>
            )}
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', padding: '0 8px' }}>Camera unavailable</span>
          </div>
        )
      }

      {/* "You" label */}
      <div style={{
        position: 'absolute', bottom: 6, left: 8,
        background: 'rgba(0,0,0,0.55)', borderRadius: 6,
        padding: '1px 6px', pointerEvents: 'none',
      }}>
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>You</span>
      </div>

      {/* Speaking indicator dot */}
      {isSpeaking && (
        <div style={{
          position: 'absolute', bottom: 6, right: 8,
          width: 8, height: 8, borderRadius: '50%',
          background: '#22c55e',
          boxShadow: '0 0 6px #22c55e',
          pointerEvents: 'none',
        }} />
      )}

      {/* Resize handle — bottom-right corner */}
      <div
        data-resize="true"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          resize.current = { active: true, startX: e.clientX, startY: e.clientY, origW: sizeRef.current.w, origH: sizeRef.current.h }
        }}
        style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 20, height: 20,
          cursor: 'se-resize',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
          padding: 3,
        }}
      >
        {/* Drag grip dots */}
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ pointerEvents: 'none', opacity: 0.5 }}>
          <circle cx="8" cy="8" r="1.5" fill="white" />
          <circle cx="4.5" cy="8" r="1.5" fill="white" />
          <circle cx="8" cy="4.5" r="1.5" fill="white" />
        </svg>
      </div>
    </div>
  )
}

/* ─── Timer display ──────────────────────────────────────────────────────── */
function useTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      setElapsed(0)
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/* ─── Status label ───────────────────────────────────────────────────────── */
const STATE_LABELS: Partial<Record<SessionState, string>> = {
  intro: 'Get ready',
  question_speaking: 'Alex is speaking…',
  recording: 'Your turn — recording',
  processing: 'Transcribing…',
  ai_speaking: 'Alex is responding…',
  scoring: 'Scoring your interview…',
  results: 'Interview complete',
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function InterviewSession() {
  const { type } = useParams<{ type: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const question: Question | undefined = (location.state as { question?: Question })?.question

  const [sessionState, setSessionState] = useState<SessionState>('intro')
  const [turnNumber, setTurnNumber] = useState(0)
  const [sessionHistory, setSessionHistory] = useState<{role: string; content: string}[]>([])
  const [transcripts, setTranscripts] = useState<{text: string; duration: number}[]>([])
  const [aiMessage, setAiMessage] = useState('')
  const persona = (location.state as { persona?: string })?.persona ?? 'direct'
  const isSystemDesign = type === 'system-design'
  const [score, setScore] = useState<ScoreResult | DesignScoreResult | null>(null)
  const [error, setError] = useState('')

  const { acquireMic, startRecording, stopRecording, releaseMic, getStream } = useRecorder()
  const isRecording = sessionState === 'recording'
  const [cameraOn, setCameraOn] = useState(true)

  function toggleCamera() {
    setCameraOn(v => !v)
  }
  const timer = useTimer(isRecording)
  const caption = useLiveCaption(isRecording)

  // If no question was passed in state, redirect on next tick (can't navigate during render)
  useEffect(() => {
    if (!question) navigate(`/practice/${type}`, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!question) return null

  const q = question

  function autoStop() {
    if (sessionState === 'recording') stopAnswer()
  }

  const silenceCountdown = useSilenceDetector(isRecording, getStream, autoStop)

  /* ── Step 1: acquire mic in the click handler (user gesture), then speak question ── */
  async function beginInterview() {
    try {
      await acquireMic()
    } catch (e) {
      const err = e as DOMException
      console.error('getUserMedia failed:', err.name, err.message)
      setError(`Mic error (${err.name || 'unknown'}): ${err.message || 'Could not access microphone.'}`)
      return
    }
    const initialHistory = [{ role: 'interviewer', content: q.text }]
    setSessionHistory(initialHistory)
    setTurnNumber(0)
    setTranscripts([])
    setSessionState('question_speaking')
    speak(q.text, () => {
      try {
        startRecording()
        setSessionState('recording')
      } catch {
        setError('Microphone error. Please refresh and try again.')
        setSessionState('intro')
      }
    })
  }

  /* ── After each recording: transcribe → AI responds → loop until done ── */
  async function stopAnswer() {
    setSessionState('processing')
    setError('')
    try {
      const { blob, duration } = await stopRecording()

      const form = new FormData()
      form.append('audio', blob, 'answer.webm')
      const transcribeRes = await fetch(`${API_URL}/api/transcribe`, { method: 'POST', body: form })
      if (!transcribeRes.ok) throw new Error(await apiError(transcribeRes))
      const { transcript } = await transcribeRes.json()
      if (!transcript) throw new Error('Transcription returned empty — please speak clearly and try again.')

      const newTranscript = { text: transcript, duration }
      const updatedTranscripts = [...transcripts, newTranscript]
      setTranscripts(updatedTranscripts)

      const updatedHistory = [...sessionHistory, { role: 'candidate', content: transcript }]
      setSessionHistory(updatedHistory)

      const MAX_TURNS = 3

      if (turnNumber >= MAX_TURNS) {
        await scoreSession(updatedTranscripts, updatedHistory)
        return
      }

      const turnRes = await fetch(`${API_URL}/api/interview/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q.text,
          transcript_so_far: transcript,
          turn_number: turnNumber,
          session_history: updatedHistory,
          persona,
        }),
      })
      if (!turnRes.ok) throw new Error(await apiError(turnRes))
      const { message, is_done } = await turnRes.json()

      const historyWithAI = [...updatedHistory, { role: 'interviewer', content: message }]
      setSessionHistory(historyWithAI)
      setAiMessage(message)

      if (is_done) {
        await scoreSession(updatedTranscripts, historyWithAI)
        return
      }

      setSessionState('ai_speaking')
      speak(message, () => {
        try {
          startRecording()
          setTurnNumber(n => n + 1)
          setSessionState('recording')
        } catch {
          setError('Microphone error. Please try again.')
          setSessionState('recording')
        }
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong processing your answer.')
      setSessionState('recording')
    }
  }

  /* ── Score the full conversation ── */
  async function scoreSession(
    allTranscripts: {text: string; duration: number}[],
    history: {role: string; content: string}[],
  ) {
    setSessionState('scoring')
    setError('')
    try {
      const firstTranscript = allTranscripts[0]?.text ?? ''
      const totalDuration = allTranscripts.reduce((sum, t) => sum + t.duration, 0)
      const candidateTurns = history.filter(h => h.role === 'candidate')
      const interviewerFollowUps = history.filter(h => h.role === 'interviewer').slice(1)

      const scoreEndpoint = isSystemDesign ? `${API_URL}/api/score/system-design` : `${API_URL}/api/score`
      const scorePayload = isSystemDesign
        ? { question: q.text, transcript: firstTranscript, duration_seconds: totalDuration || null }
        : {
            question: q.text,
            transcript: firstTranscript,
            follow_up_question: interviewerFollowUps[0]?.content ?? null,
            follow_up_transcript: candidateTurns[1]?.content ?? null,
            duration_seconds: allTranscripts[0]?.duration || null,
            follow_up_duration_seconds: allTranscripts.slice(1).reduce((s, t) => s + t.duration, 0) || null,
            session_history: history,
          }

      const scoreRes = await fetch(scoreEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scorePayload),
      })
      if (!scoreRes.ok) throw new Error(await apiError(scoreRes))
      const result = await scoreRes.json()
      setScore(result as ScoreResult)

      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase.from('interview_sessions').insert({
          user_id: user.id,
          type: isSystemDesign ? 'system-design' : 'behavioral',
          question: q.text,
          transcript: candidateTurns.map(t => t.content).join('\n\n'),
          score: result,
        })
      })

      releaseMic()
      setSessionState('results')
    } catch (e) {
      console.error('Scoring error:', e)
      setError(e instanceof Error ? e.message : 'Something went wrong scoring your answers.')
      setSessionState('scoring')
    }
  }

  const speaking = sessionState === 'question_speaking' || sessionState === 'ai_speaking'
  const subtitle = sessionState === 'question_speaking' ? q.text
    : sessionState === 'ai_speaking' ? aiMessage
    : undefined

  /* ─── Results view ─────────────────────────────────────────────────────── */
  if (sessionState === 'results' && score) {
    const conversationTurns = sessionHistory.slice(1) // skip initial question read-aloud
    return (
      <div style={{ minHeight: '100vh', background: '#0c0c0e', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', color: '#52525b', marginBottom: 4 }}>
                INTERVIEW COMPLETE
              </p>
              <h1 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: '1.4rem', color: '#f0f0f0', margin: 0, letterSpacing: '-0.02em' }}>
                Your Results
              </h1>
            </div>
            <button
              onClick={() => navigate(`/practice/${type}`)}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: '1px solid #2a2a2e',
                background: 'transparent',
                color: '#6b6b7a',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'Inter', system-ui, sans-serif",
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#52525b'; e.currentTarget.style.color = '#f0f0f0' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2e'; e.currentTarget.style.color = '#6b6b7a' }}
            >
              ← Back to questions
            </button>
          </div>

          {/* Conversation transcript */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {conversationTurns.map((turn, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 16px',
                  border: turn.role === 'candidate'
                    ? '1px solid rgba(124,58,237,0.2)'
                    : '1px solid rgba(71,85,105,0.3)',
                  borderRadius: 10,
                  background: turn.role === 'candidate'
                    ? 'rgba(124,58,237,0.05)'
                    : 'rgba(30,41,59,0.4)',
                }}
              >
                <p style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.62rem',
                  letterSpacing: '0.1em',
                  color: turn.role === 'candidate' ? '#7c3aed' : '#64748b',
                  marginBottom: 5,
                }}>
                  {turn.role === 'candidate' ? 'YOU' : 'ALEX'}
                </p>
                <p style={{ color: '#a1a1aa', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>{turn.content}</p>
              </div>
            ))}
          </div>

          {isSystemDesign
            ? <DesignScoreCard result={score as DesignScoreResult} />
            : <StarScoreCard result={score as ScoreResult} />
          }
        </div>
      </div>
    )
  }

  /* ─── Interview room view (Zoom-style) ────────────────────────────────── */
  const isProcessingState = sessionState === 'processing' || sessionState === 'scoring'

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#111318', overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Top bar ── */}
      <div style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#16181f', borderBottom: '1px solid #232630', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <polygon points="7,15 21,9 23,15" fill="#374151"/>
            <polygon points="7,17 21,23 23,17" fill="#374151"/>
            <polygon points="5,14.5 29,16 5,17.5" fill="#1f2937"/>
            <ellipse cx="6" cy="13.5" rx="2" ry="1.4" fill="#dc2626" fillOpacity="0.9"/>
            <ellipse cx="6" cy="18.5" rx="2" ry="1.4" fill="#dc2626" fillOpacity="0.9"/>
            <circle cx="22" cy="16" r="1.5" fill="#dc2626"/>
          </svg>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f0f0f0', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>starboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isRecording ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} className="animate-pulse"/>
              <span style={{ fontFamily: 'monospace', color: '#f0f0f0', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.05em' }}>{timer}</span>
              {turnNumber > 0 && (
                <span style={{ padding: '2px 8px', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 6, color: '#a78bfa', fontSize: '0.7rem', fontWeight: 600 }}>
                  Follow-up {turnNumber}
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>{STATE_LABELS[sessionState]}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>2 participants</span>
        </div>
      </div>

      {/* ── Main tile ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: '#0a0d14' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 35%, #0e1c36 0%, #080b12 70%)' }}/>
        </div>

        {/* Avatar + animations */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 1 }}>
          <div style={{
            width: 200, height: 200, borderRadius: '50%', overflow: 'hidden',
            border: speaking ? '3px solid #4a9eff' : '3px solid #2d3748',
            boxShadow: speaking
              ? '0 0 0 6px rgba(74,158,255,0.12), 0 0 60px rgba(74,158,255,0.06)'
              : '0 0 0 1px rgba(255,255,255,0.04)',
            transition: 'border-color 0.4s, box-shadow 0.4s',
          }}>
            <AvatarIllustration speaking={speaking} />
          </div>
          {speaking && <WaveformBars />}
          {isProcessingState && !error && sessionState !== 'scoring' && <ThinkingDots />}
        </div>

        {/* Name plate */}
        <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 3, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '6px 14px', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ color: '#f0f0f0', fontSize: '0.85rem', fontWeight: 600 }}>Alex</span>
          <span style={{ color: '#4b5563', fontSize: '0.8rem' }}>·</span>
          <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Senior Engineer</span>
        </div>

        {/* LIVE badge */}
        {isRecording && (
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 3, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(220,38,38,0.85)', borderRadius: 6, padding: '4px 10px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', display: 'inline-block' }}/>
            <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span>
          </div>
        )}

        {/* Intro overlay */}
        {sessionState === 'intro' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4 }}>
            <div style={{ background: 'rgba(10,14,22,0.85)', backdropFilter: 'blur(12px)', borderRadius: 16, padding: '20px 32px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <p style={{ color: '#e2e8f0', fontSize: '0.95rem', margin: '0 0 6px', fontWeight: 500 }}>Alex is ready to start your interview</p>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Click "Start Interview" when you're ready</p>
            </div>
          </div>
        )}

        {/* Scoring overlay */}
        {sessionState === 'scoring' && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 4 }}>
            <div style={{ background: 'rgba(10,14,22,0.9)', backdropFilter: 'blur(12px)', borderRadius: 16, padding: '24px 36px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#374151" strokeWidth="3"/>
                  <path d="M12 2a10 10 0 010 20" stroke="#818cf8" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                <span style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 500 }}>Analyzing your interview…</span>
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>This usually takes 10–15 seconds</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ position: 'absolute', bottom: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: 'rgba(127,29,29,0.92)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '12px 22px', maxWidth: 480, border: '1px solid rgba(239,68,68,0.25)', textAlign: 'center' }}>
            <p style={{ color: '#fca5a5', fontSize: '0.875rem', margin: '0 0 10px' }}>{error}</p>
            <button onClick={() => { setError(''); navigate(`/practice/${type}`) }} style={{ padding: '6px 16px', background: 'transparent', border: '1px solid rgba(239,68,68,0.5)', borderRadius: 6, color: '#fca5a5', fontSize: '0.8rem', cursor: 'pointer' }}>
              Back to questions
            </button>
          </div>
        )}

        {/* Question subtitle */}
        {subtitle && !error && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', maxWidth: 'min(620px, calc(100% - 48px))', zIndex: 3, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', borderRadius: 10, padding: '10px 22px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ color: '#f0f0f0', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.55, margin: 0 }}>{subtitle}</p>
          </div>
        )}

        {/* Live captions */}
        {isRecording && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', maxWidth: 'min(580px, calc(100% - 48px))', zIndex: 3, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', borderRadius: 10, padding: '8px 18px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" className="animate-pulse" style={{ flexShrink: 0 }}>
              <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4zm-1 17.93V21h-2v2h6v-2h-2v-2.07A8.001 8.001 0 0020 11h-2a6 6 0 01-12 0H4a8.001 8.001 0 017 6.93z"/>
            </svg>
            {caption
              ? <p style={{ color: '#f0f0f0', fontSize: '0.875rem', margin: 0, lineHeight: 1.4 }}>{caption}</p>
              : <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, fontStyle: 'italic' }}>Listening…</p>
            }
          </div>
        )}

        {/* Silence countdown overlay */}
        {isRecording && silenceCountdown !== null && (
          <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 3, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', borderRadius: 8, padding: '5px 14px', border: '1px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} className="animate-pulse"/>
            <span style={{ color: '#fdba74', fontSize: '0.78rem' }}>Finishing in {silenceCountdown}s…</span>
          </div>
        )}

        <UserCamera isSpeaking={isRecording && caption.length > 0} cameraOn={cameraOn} />
      </div>

      {/* ── Bottom toolbar ── */}
      <div style={{ height: 72, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#16181f', borderTop: '1px solid #232630', position: 'relative', zIndex: 10 }}>
        {sessionState === 'intro' ? (
          <button
            onClick={beginInterview}
            style={{ padding: '12px 44px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 50, fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 0 0 2px rgba(124,58,237,0.3), 0 4px 20px rgba(124,58,237,0.25)', transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#6d28d9' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#7c3aed' }}
          >
            Start Interview
          </button>
        ) : (
          <>
            {/* Center status — passive, no click needed */}
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10 }}>
              {isRecording && (
                <>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} style={{ width: 3, borderRadius: 2, background: '#22c55e', animationName: 'none' }}
                        className="animate-pulse"
                        ref={el => { if (el) el.style.height = `${8 + Math.random() * 14}px` }}
                      />
                    ))}
                  </div>
                  <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>
                    {silenceCountdown !== null
                      ? `Finishing in ${silenceCountdown}s…`
                      : 'Listening — stop speaking to continue'}
                  </span>
                  {/* Fallback manual done button — small and secondary */}
                  <button
                    onClick={stopAnswer}
                    style={{ padding: '4px 12px', background: 'transparent', border: '1px solid #374151', borderRadius: 6, color: '#6b7280', fontSize: '0.72rem', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#6b7280'; e.currentTarget.style.color = '#9ca3af' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.color = '#6b7280' }}
                  >
                    Done speaking
                  </button>
                </>
              )}
              {isProcessingState && !error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#6b7280' }}>
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#374151" strokeWidth="3"/>
                    <path d="M12 2a10 10 0 010 20" stroke="#6b7280" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: '0.78rem' }}>{sessionState === 'scoring' ? 'Scoring your interview…' : 'Processing…'}</span>
                </div>
              )}
              {sessionState === 'ai_speaking' && (
                <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>Alex is speaking…</span>
              )}
              {sessionState === 'question_speaking' && (
                <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>Listen to the question…</span>
              )}
            </div>

            {/* Camera toggle */}
            <div style={{ position: 'absolute', left: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <button
                onClick={toggleCamera}
                style={{ width: 44, height: 44, borderRadius: '50%', background: cameraOn ? '#232630' : '#374151', border: cameraOn ? 'none' : '2px solid #ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
              >
                {cameraOn ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M16 16H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/><path d="M22.5 8.5L19 12l3.5 3.5V8.5z"/></svg>
                )}
              </button>
              <span style={{ color: cameraOn ? '#6b7280' : '#ef4444', fontSize: '0.62rem' }}>{cameraOn ? 'Camera' : 'Off'}</span>
            </div>

            {/* End Interview */}
            <button
              onClick={() => { stopAudio(); releaseMic(); navigate(`/practice/${type}`) }}
              style={{ position: 'absolute', right: 24, padding: '9px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#b91c1c' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#dc2626' }}
            >
              End Interview
            </button>
          </>
        )}
      </div>
    </div>
  )
}
