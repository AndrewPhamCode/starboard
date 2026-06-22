import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ScoreResult } from '../components/StarScoreCard'
import StarScoreCard from '../components/StarScoreCard'
import { supabase } from '../lib/supabase'
import { API_URL } from '../lib/api'

type SessionState =
  | 'intro'
  | 'question_speaking'
  | 'recording_1'
  | 'processing_1'
  | 'followup_speaking'
  | 'recording_2'
  | 'processing_2'
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

  return { acquireMic, startRecording, stopRecording, releaseMic, getStream }
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

/* ─── Professional avatar illustration ──────────────────────────────────── */
function AvatarIllustration() {
  return (
    <svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#1a2540"/>
      {/* Shoulders / suit */}
      <path d="M 10 200 Q 10 158 100 148 Q 190 158 190 200 Z" fill="#1e3a5f"/>
      <path d="M 100 148 L 80 180 L 100 170 L 120 180 Z" fill="#0f2540"/>
      <path d="M 100 148 L 93 163 L 100 160 L 107 163 Z" fill="#e2e8f0"/>
      {/* Tie */}
      <path d="M 97 160 L 95 180 L 100 184 L 105 180 L 103 160 L 100 165 Z" fill="#7c3aed"/>
      {/* Neck */}
      <path d="M 88 132 Q 88 148 100 148 Q 112 148 112 132 Z" fill="#c4956a"/>
      {/* Head */}
      <ellipse cx="100" cy="98" rx="46" ry="50" fill="#c4956a"/>
      {/* Hair */}
      <path d="M 54 88 Q 56 50 100 46 Q 144 50 146 88 Q 138 66 100 63 Q 62 66 54 88 Z" fill="#1a1008"/>
      <path d="M 54 88 Q 49 98 53 112 Q 57 98 60 90 Z" fill="#1a1008"/>
      <path d="M 146 88 Q 151 98 147 112 Q 143 98 140 90 Z" fill="#1a1008"/>
      {/* Ears */}
      <ellipse cx="54" cy="102" rx="7" ry="9" fill="#b8845a"/>
      <ellipse cx="146" cy="102" rx="7" ry="9" fill="#b8845a"/>
      <ellipse cx="54" cy="102" rx="4" ry="6" fill="#c4956a"/>
      <ellipse cx="146" cy="102" rx="4" ry="6" fill="#c4956a"/>
      {/* Eye whites */}
      <ellipse cx="81" cy="95" rx="11" ry="12" fill="white"/>
      <ellipse cx="119" cy="95" rx="11" ry="12" fill="white"/>
      {/* Irises */}
      <circle cx="82" cy="96" r="7" fill="#2c4a8c"/>
      <circle cx="120" cy="96" r="7" fill="#2c4a8c"/>
      {/* Pupils */}
      <circle cx="82" cy="97" r="4" fill="#0d0d0d"/>
      <circle cx="120" cy="97" r="4" fill="#0d0d0d"/>
      {/* Eye shine */}
      <circle cx="84" cy="94" r="1.5" fill="white" fillOpacity="0.85"/>
      <circle cx="122" cy="94" r="1.5" fill="white" fillOpacity="0.85"/>
      {/* Eyebrows */}
      <path d="M 69 81 Q 81 76 93 80" stroke="#1a1008" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M 107 80 Q 119 76 131 81" stroke="#1a1008" strokeWidth="3" fill="none" strokeLinecap="round"/>
      {/* Nose */}
      <path d="M 100 103 Q 95 115 97 120 Q 100 122 103 120 Q 105 115 100 103" fill="#b8845a" fillOpacity="0.5"/>
      <circle cx="95" cy="119" r="4" fill="#b8845a"/>
      <circle cx="105" cy="119" r="4" fill="#b8845a"/>
      {/* Mouth */}
      <path d="M 86 133 Q 100 140 114 133" stroke="#8b5e3c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      {/* Cheek shadows */}
      <ellipse cx="68" cy="115" rx="12" ry="8" fill="#b8845a" fillOpacity="0.2"/>
      <ellipse cx="132" cy="115" rx="12" ry="8" fill="#b8845a" fillOpacity="0.2"/>
    </svg>
  )
}

/* ─── User camera pip — draggable, resizable, speaking indicator ─────────── */
function UserCamera({ isSpeaking }: { isSpeaking: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [available, setAvailable] = useState(true)

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
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }}
          />
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
  recording_1: 'Your turn — recording',
  processing_1: 'Transcribing…',
  followup_speaking: 'Alex has a follow-up…',
  recording_2: 'Answer the follow-up',
  processing_2: 'Transcribing…',
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
  const [followUpQuestion, setFollowUpQuestion] = useState('')
  const [transcript1, setTranscript1] = useState('')
  const [transcript2, setTranscript2] = useState('')
  const [duration1, setDuration1] = useState(0)
  const [score, setScore] = useState<ScoreResult | null>(null)
  const [error, setError] = useState('')

  const { acquireMic, startRecording, stopRecording, releaseMic, getStream } = useRecorder()
  const isRecording = sessionState === 'recording_1' || sessionState === 'recording_2'
  const timer = useTimer(isRecording)
  const caption = useLiveCaption(isRecording)

  // If no question was passed in state, redirect on next tick (can't navigate during render)
  useEffect(() => {
    if (!question) navigate(`/practice/${type}`, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!question) return null

  const q = question

  function autoStop() {
    if (sessionState === 'recording_1') stopAnswer1()
    else if (sessionState === 'recording_2') stopAnswer2()
  }

  const silenceCountdown = useSilenceDetector(isRecording, getStream, autoStop)

  /* ── Step 1: acquire mic in the click handler (user gesture), then start TTS ── */
  async function beginInterview() {
    try {
      await acquireMic() // Must happen during the click event — Chrome requires a user gesture
    } catch (e) {
      const err = e as DOMException
      console.error('getUserMedia failed:', err.name, err.message)
      setError(`Mic error (${err.name || 'unknown'}): ${err.message || 'Could not access microphone.'}`)
      return
    }
    console.log('[interview] mic acquired, starting TTS')
    setSessionState('question_speaking')
    speak(q.text, () => {
      try {
        startRecording() // Mic already granted — this is now synchronous
        setSessionState('recording_1')
      } catch {
        setError('Microphone error. Please refresh and try again.')
        setSessionState('intro')
      }
    })
  }

  /* ── Step 2: stop recording answer 1, transcribe, get follow-up ── */
  async function stopAnswer1() {
    setSessionState('processing_1')
    setError('')
    try {
      const { blob, duration } = await stopRecording()
      setDuration1(duration)

      const form = new FormData()
      form.append('audio', blob, 'answer.webm')
      const transcribeRes = await fetch(`${API_URL}/api/transcribe`, { method: 'POST', body: form })
      if (!transcribeRes.ok) throw new Error(await apiError(transcribeRes))
      const { transcript } = await transcribeRes.json()
      if (!transcript) throw new Error('Transcription returned empty — please speak clearly and try again.')
      setTranscript1(transcript)

      const fuRes = await fetch(`${API_URL}/api/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.text, transcript }),
      })
      if (!fuRes.ok) throw new Error(await apiError(fuRes))
      const { follow_up, reaction } = await fuRes.json()
      setFollowUpQuestion(follow_up)

      setSessionState('followup_speaking')
      speak(`${reaction} ${follow_up}`, () => {
        try {
          startRecording() // Stream is still cached from step 1
          setSessionState('recording_2')
        } catch {
          setError('Microphone error starting follow-up recording. Please try again.')
          setSessionState('recording_1')
        }
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong processing your answer.')
      setSessionState('recording_1')
    }
  }

  /* ── Step 3: stop recording answer 2, transcribe, score ── */
  async function stopAnswer2() {
    setSessionState('processing_2')
    setError('')
    try {
      const { blob, duration } = await stopRecording()

      const form = new FormData()
      form.append('audio', blob, 'answer.webm')
      const transcribeRes = await fetch(`${API_URL}/api/transcribe`, { method: 'POST', body: form })
      if (!transcribeRes.ok) throw new Error(await apiError(transcribeRes))
      const { transcript: followUpTranscript } = await transcribeRes.json()
      setTranscript2(followUpTranscript ?? '')

      setSessionState('scoring')

      const scoreRes = await fetch(`${API_URL}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q.text,
          transcript: transcript1,
          follow_up_question: followUpQuestion || null,
          follow_up_transcript: followUpTranscript || null,
          duration_seconds: duration1 || null,
          follow_up_duration_seconds: duration || null,
        }),
      })
      if (!scoreRes.ok) throw new Error(await apiError(scoreRes))
      const result = await scoreRes.json()
      setScore(result as ScoreResult)
      // Silently persist session if user is signed in
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase.from('interview_sessions').insert({
          user_id: user.id,
          type: 'behavioral',
          question: q.text,
          transcript: [transcript1, followUpTranscript].filter(Boolean).join('\n\n'),
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

  const speaking = sessionState === 'question_speaking' || sessionState === 'followup_speaking'
  const subtitle = sessionState === 'question_speaking' ? q.text
    : sessionState === 'followup_speaking' ? followUpQuestion
    : undefined

  /* ─── Results view ─────────────────────────────────────────────────────── */
  if (sessionState === 'results' && score) {
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

          {/* Transcripts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
            <div style={{ padding: '14px 16px', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, background: 'rgba(124,58,237,0.05)' }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: '#7c3aed', marginBottom: 6 }}>YOUR ANSWER</p>
              <p style={{ color: '#a1a1aa', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>{transcript1}</p>
            </div>
            {transcript2 && (
              <div style={{ padding: '14px 16px', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, background: 'rgba(99,102,241,0.05)' }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: '#818cf8', marginBottom: 6 }}>
                  FOLLOW-UP: "{followUpQuestion}"
                </p>
                <p style={{ color: '#a1a1aa', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>{transcript2}</p>
              </div>
            )}
          </div>

          <StarScoreCard result={score} />
        </div>
      </div>
    )
  }

  /* ─── Interview room view (Zoom-style) ────────────────────────────────── */
  const isProcessingState = sessionState === 'processing_1' || sessionState === 'processing_2' || sessionState === 'scoring'

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
            <>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} className="animate-pulse"/>
              <span style={{ fontFamily: 'monospace', color: '#f0f0f0', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.05em' }}>{timer}</span>
            </>
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
            border: speaking ? '3px solid #22c55e' : '3px solid #2d3748',
            boxShadow: speaking ? '0 0 0 6px rgba(34,197,94,0.12), 0 0 60px rgba(34,197,94,0.06)' : '0 0 0 1px rgba(255,255,255,0.04)',
            transition: 'border-color 0.4s, box-shadow 0.4s',
          }}>
            <AvatarIllustration />
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

        <UserCamera isSpeaking={isRecording && caption.length > 0} />
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
            {/* Mic / Stop */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <button
                onClick={isRecording ? (sessionState === 'recording_1' ? stopAnswer1 : stopAnswer2) : undefined}
                style={{ width: 48, height: 48, borderRadius: '50%', background: isRecording ? '#ef4444' : '#232630', border: 'none', cursor: isRecording ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s', boxShadow: isRecording ? '0 0 0 3px rgba(239,68,68,0.25)' : 'none' }}
              >
                {isRecording ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#6b7280"><path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4zm-1 17.93V21h-2v2h6v-2h-2v-2.07A8.001 8.001 0 0020 11h-2a6 6 0 01-12 0H4a8.001 8.001 0 017 6.93z"/></svg>
                )}
              </button>
              <span style={{ color: silenceCountdown !== null ? '#f97316' : '#6b7280', fontSize: '0.65rem' }}>
                {silenceCountdown !== null ? `${silenceCountdown}s…` : isRecording ? 'Stop' : 'Mic'}
              </span>
            </div>

            {/* Camera */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <button style={{ width: 48, height: 48, borderRadius: '50%', background: '#232630', border: 'none', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              </button>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Camera</span>
            </div>

            {/* Processing indicator */}
            {isProcessingState && !error && sessionState !== 'scoring' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#6b7280', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#374151" strokeWidth="3"/>
                  <path d="M12 2a10 10 0 010 20" stroke="#6b7280" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: '0.78rem' }}>Processing audio…</span>
              </div>
            )}

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
