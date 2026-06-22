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

  return { acquireMic, startRecording, stopRecording, releaseMic }
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

/* ─── Interviewer avatar ─────────────────────────────────────────────────── */
function InterviewerCard({ speaking, subtitle }: { speaking: boolean; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`relative w-40 h-40 rounded-3xl border-[3px] bg-violet-900 flex items-center justify-center transition-all duration-300 ${
        speaking ? 'border-violet-400' : 'border-violet-700'
      }`} style={{ boxShadow: speaking ? '0 0 0 4px rgba(167,139,250,0.3), 5px 5px 0px #4c1d95' : '5px 5px 0px #4c1d95' }}>
        {speaking && (
          <span className="absolute inset-0 rounded-3xl border-[3px] border-violet-400 animate-ping opacity-40" />
        )}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-violet-700 border-2 border-violet-500 flex items-center justify-center"
            style={{ boxShadow: '2px 2px 0px #4c1d95' }}>
            <span className="text-white font-extrabold text-2xl" style={{ fontFamily: "'Baloo 2', cursive" }}>AI</span>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-sm" style={{ fontFamily: "'Baloo 2', cursive" }}>Alex</p>
            <p className="text-violet-400 text-xs">Senior Engineer</p>
          </div>
        </div>
      </div>

      {subtitle && (
        <div className="max-w-xs bg-gray-800 border border-gray-600 rounded-2xl px-4 py-3 text-center">
          <p className="text-gray-200 text-sm leading-relaxed italic">"{subtitle}"</p>
        </div>
      )}
    </div>
  )
}

/* ─── User camera pip — draggable, resizable, speaking indicator ─────────── */
function UserCamera({ isSpeaking }: { isSpeaking: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [available, setAvailable] = useState(true)

  // Position and size — initialized to bottom-right
  const [pos, setPos] = useState(() => ({ x: window.innerWidth - 196, y: 80 }))
  const [size, setSize] = useState({ w: 172, h: 129 })

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

  const { acquireMic, startRecording, stopRecording, releaseMic } = useRecorder()
  const isRecording = sessionState === 'recording_1' || sessionState === 'recording_2'
  const timer = useTimer(isRecording)
  const caption = useLiveCaption(isRecording)

  // If no question was passed in state, redirect on next tick (can't navigate during render)
  useEffect(() => {
    if (!question) navigate(`/practice/${type}`, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!question) return null

  const q = question

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
      const { follow_up } = await fuRes.json()
      setFollowUpQuestion(follow_up)

      setSessionState('followup_speaking')
      speak(follow_up, () => {
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

  /* ─── Interview room view ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
            <line x1="14" y1="3" x2="14" y2="25" stroke="#f0f0f0" strokeWidth="1.2" strokeOpacity="0.35" strokeLinecap="round" />
            <line x1="3" y1="14" x2="13" y2="14" stroke="#f0f0f0" strokeWidth="1.2" strokeOpacity="0.35" strokeLinecap="round" />
            <line x1="15" y1="14" x2="22" y2="14" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
            <path d="M20 11.5L24.5 14L20 16.5" fill="#7c3aed" />
            <circle cx="14" cy="14" r="2.5" fill="white" />
          </svg>
          <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: '0.95rem', color: '#f0f0f0' }}>starboard</span>
        </div>
        <div className="flex items-center gap-3">
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-900 border border-red-600">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-300 text-xs font-bold font-mono">{timer}</span>
            </div>
          )}
          <span className="text-gray-400 text-sm">{STATE_LABELS[sessionState]}</span>
          <button
            onClick={() => { stopAudio(); releaseMic(); navigate(`/practice/${type}`) }}
            className="text-gray-500 hover:text-gray-300 text-sm cursor-pointer transition-colors"
          >
            End interview
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-8 relative">

        <UserCamera isSpeaking={isRecording && caption.length > 0} />

        {/* Interviewer */}
        <InterviewerCard speaking={speaking} subtitle={subtitle} />

        {/* Question card (shown after intro) */}
        {(sessionState !== 'intro') && (
          <div className="max-w-lg w-full rounded-3xl border-[3px] border-gray-700 bg-gray-900 p-5"
            style={{ boxShadow: '5px 5px 0px #111827' }}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Interview question</p>
            <p className="text-gray-100 font-semibold leading-relaxed">{q.text}</p>
            {followUpQuestion && sessionState !== 'question_speaking' && sessionState !== 'recording_1' && sessionState !== 'processing_1' && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-1">Follow-up</p>
                <p className="text-gray-300 text-sm leading-relaxed">{followUpQuestion}</p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="max-w-lg w-full rounded-2xl border-2 border-red-700 bg-red-950 px-4 py-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col items-center gap-4">

          {/* INTRO */}
          {sessionState === 'intro' && (
            <button
              onClick={beginInterview}
              className="px-10 py-4 rounded-3xl border-[3px] border-violet-600 bg-violet-600 text-white font-extrabold text-lg cursor-pointer hover:bg-violet-500 transition-colors"
              style={{ fontFamily: "'Baloo 2', cursive", boxShadow: '5px 5px 0px #4c1d95' }}
            >
              Start interview
            </button>
          )}

          {/* SPEAKING STATES */}
          {(sessionState === 'question_speaking' || sessionState === 'followup_speaking') && (
            <p className="text-gray-400 text-sm animate-pulse">Alex is speaking… listen carefully</p>
          )}

          {/* RECORD ANSWER 1 */}
          {sessionState === 'recording_1' && (
            <button
              onClick={stopAnswer1}
              className="px-10 py-4 rounded-3xl border-[3px] border-red-600 bg-red-600 text-white font-extrabold text-lg cursor-pointer hover:bg-red-500 transition-colors flex items-center gap-3"
              style={{ fontFamily: "'Baloo 2', cursive", boxShadow: '5px 5px 0px #7f1d1d' }}
            >
              <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
              Stop recording
            </button>
          )}

          {/* START RECORDING ANSWER 1 */}
          {sessionState === 'recording_1' ? null : sessionState === 'question_speaking' ? null : null}

          {/* RECORD ANSWER 2 */}
          {sessionState === 'recording_2' && (
            <button
              onClick={stopAnswer2}
              className="px-10 py-4 rounded-3xl border-[3px] border-red-600 bg-red-600 text-white font-extrabold text-lg cursor-pointer hover:bg-red-500 transition-colors flex items-center gap-3"
              style={{ fontFamily: "'Baloo 2', cursive", boxShadow: '5px 5px 0px #7f1d1d' }}
            >
              <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
              Stop recording
            </button>
          )}

          {/* PROCESSING / SCORING */}
          {(sessionState === 'processing_1' || sessionState === 'processing_2' || (sessionState === 'scoring' && !error)) && (
            <div className="flex items-center gap-3 text-gray-400">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span className="text-sm">
                {sessionState === 'scoring' ? 'Scoring your full interview…' : 'Processing audio…'}
              </span>
            </div>
          )}

          {/* Scoring error — show retry */}
          {sessionState === 'scoring' && error && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-red-400 text-sm text-center max-w-xs">{error}</p>
              <button
                onClick={() => { setError(''); navigate(`/practice/${type}`) }}
                className="px-6 py-2 rounded-2xl border-2 border-gray-600 text-gray-300 text-sm font-bold cursor-pointer hover:bg-gray-800 transition-colors"
              >
                Back to questions
              </button>
            </div>
          )}
        </div>

        {/* Recording hint */}
        {isRecording && !caption && (
          <p className="text-gray-500 text-xs">Recording in progress — start speaking to see captions.</p>
        )}
      </div>

      {/* Live caption bar */}
      {isRecording && (
        <div className="px-6 pb-6">
          <div
            className="max-w-2xl mx-auto rounded-2xl px-5 py-3 border border-gray-700 bg-gray-900 min-h-[48px] flex items-center gap-3"
            style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }}
          >
            {/* Mic icon */}
            <span className="shrink-0">
              <svg className="w-4 h-4 text-red-400 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4zm-1 17.93V21h-2v2h6v-2h-2v-2.07A8.001 8.001 0 0120 11h-2a6 6 0 01-12 0H4a8.001 8.001 0 017 6.93z"/>
              </svg>
            </span>
            {caption
              ? <p className="text-gray-200 text-sm leading-relaxed">{caption}</p>
              : <p className="text-gray-600 text-sm italic">Listening…</p>
            }
          </div>
        </div>
      )}
    </div>
  )
}
