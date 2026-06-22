import { useEffect, useRef, useState } from 'react'
import { API_URL } from '../lib/api'

type RecordState = 'idle' | 'recording' | 'transcribing'

interface Props {
  onTranscript: (text: string) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function MicIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

export default function RecordButton({ onTranscript }: Props) {
  const [state, setState] = useState<RecordState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const startRecording = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        timerRef.current && clearInterval(timerRef.current)
        streamRef.current?.getTracks().forEach((t) => t.stop())
        setState('transcribing')

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        const ext = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm'
        const formData = new FormData()
        formData.append('audio', blob, `recording.${ext}`)

        try {
          const res = await fetch(`${API_URL}/api/transcribe`, { method: 'POST', body: formData })
          if (!res.ok) {
            const detail = await res.json().then((d) => d.detail).catch(() => res.statusText)
            throw new Error(detail)
          }
          const data = await res.json()
          onTranscript(data.transcript)
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : 'Transcription failed')
        } finally {
          setState('idle')
          setElapsed(0)
        }
      }

      recorder.start()
      setState('recording')
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } catch {
      setError('Microphone access denied or unavailable')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
  }

  const handleClick = () => {
    if (state === 'idle') startRecording()
    else if (state === 'recording') stopRecording()
  }

  const isRecording = state === 'recording'
  const isTranscribing = state === 'transcribing'

  return (
    <div className="mt-5">
      <button
        onClick={handleClick}
        disabled={isTranscribing}
        aria-label={isRecording ? 'Stop recording' : 'Record answer'}
        className={[
          'w-full flex items-center justify-center gap-2.5 rounded-xl font-semibold py-3 text-sm transition-all duration-200 cursor-pointer',
          isRecording
            ? 'bg-red-50 border-2 border-red-400 text-red-600 animate-pulse'
            : isTranscribing
              ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
              : 'bg-white border border-gray-200 text-gray-700 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50',
        ].join(' ')}
      >
        {isRecording ? (
          <>
            <StopIcon />
            Stop recording
            <span className="ml-1 font-mono text-red-500">{formatTime(elapsed)}</span>
          </>
        ) : isTranscribing ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
            Transcribing…
          </>
        ) : (
          <>
            <MicIcon />
            Record answer
          </>
        )}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-500 text-center">{error}</p>
      )}
    </div>
  )
}
