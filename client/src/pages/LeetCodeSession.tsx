import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error('TTS failed')
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
      if (!mr) { resolve({ blob: new Blob(), duration: 0 }); return }
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

  return { acquireMic, startRecording, stopRecording, releaseMic }
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
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const isDoneAfterEndRef = useRef(false)

  const { acquireMic, startRecording, stopRecording, releaseMic } = useRecorder()
  const caption = useLiveCaption(phase === 'user_responding')

  // Auto-submit after 2.5s of silence during user_responding
  useEffect(() => {
    if (phase !== 'user_responding') {
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
      return
    }
    if (!caption.trim()) return
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== 'user_responding') return
      if (isDoneAfterEndRef.current) finishSession()
      else doneResponding()
    }, 2500)
  }, [caption, phase])

  // Redirect if no problem in state
  useEffect(() => {
    if (!problem) navigate('/practice/leetcode', { replace: true })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio()
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      releaseMic()
    }
  }, [])

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

  async function fetchInterviewerMessage(trigger: string, currentRunOutput?: CodeRun | null) {
    if (!problem) return ''
    const res = await fetch('/api/leetcode/interviewer-message', {
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
        session_log: sessionLog.slice(-6).map(t => ({ role: t.role, content: t.content })),
        follow_up_hints: problem.follow_up_hints,
      }),
    })
    if (!res.ok) throw new Error('Failed to get interviewer message')
    const data = await res.json()
    return data.message as string
  }

  async function triggerAIMessage(trigger: string, currentRunOutput?: CodeRun | null) {
    if (!problem) return
    setPhase('ai_speaking')
    try {
      const message = await fetchInterviewerMessage(trigger, currentRunOutput)
      setAiText(message)
      appendTurn('interviewer', message, trigger)
      speak(message, () => {
        startRecording()
        setPhase('user_responding')
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
        startRecording()
        setPhase('user_responding')
      })
    } catch {
      setPhase('coding_free')
      resetIdleTimer()
    }
  }

  async function doneResponding() {
    setPhase('ai_processing')
    try {
      const { blob } = await stopRecording()
      if (blob.size > 100) {
        const form = new FormData()
        form.append('audio', blob, 'response.webm')
        const res = await fetch('/api/transcribe', { method: 'POST', body: form })
        if (res.ok) {
          const { transcript } = await res.json()
          if (transcript?.trim()) appendTurn('candidate', transcript.trim())
        }
      }
    } catch {
      // transcript failed — continue without it
    }
    setPhase('coding_free')
    resetIdleTimer()
  }

  async function handleRun() {
    if (!problem || runLoading) return
    setRunLoading(true)
    resetIdleTimer()
    try {
      const res = await fetch('/api/leetcode/execute', {
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

  const handleEndInterview = useCallback(async () => {
    if (endingInterview) return
    setEndingInterview(true)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    setPhase('end_speaking')
    try {
      const message = await fetchInterviewerMessage('end')
      setAiText(message)
      appendTurn('interviewer', message, 'end')
      speak(message, () => {
        startRecording()
        setPhase('user_responding')
      })
    } catch {
      finishSession()
    }
  }, [endingInterview, sessionLog, codeByLang, language])

  async function finishSession() {
    if (!problem) return
    setPhase('ai_processing')
    try {
      const { blob } = await stopRecording()
      if (blob.size > 100) {
        const form = new FormData()
        form.append('audio', blob, 'final.webm')
        const res = await fetch('/api/transcribe', { method: 'POST', body: form })
        if (res.ok) {
          const { transcript } = await res.json()
          if (transcript?.trim()) appendTurn('candidate', transcript.trim())
        }
      }
    } catch { /* ignore */ }

    setPhase('scoring')
    try {
      const res = await fetch('/api/leetcode/score', {
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
      setScore(await res.json())
      releaseMic()
      setPhase('results')
    } catch {
      setPhase('coding_free')
      setEndingInterview(false)
    }
  }

  const isDoneAfterEnd = endingInterview && phase === 'user_responding'
  isDoneAfterEndRef.current = isDoneAfterEnd

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
      <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-200 border-[3px] border-amber-400 flex items-center justify-center"
          style={{ boxShadow: '3px 3px 0px #f59e0b' }}>
          <svg className="w-7 h-7 animate-spin text-amber-700" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
        <p className="font-extrabold text-gray-800 text-lg" style={{ fontFamily: "'Baloo 2', cursive" }}>
          Scoring your interview…
        </p>
        <p className="text-gray-500 text-sm">Analyzing your communication, code, and complexity discussion</p>
      </div>
    )
  }

  const currentCode = codeByLang[language]
  const hasError = runOutput && (runOutput.exit_code !== 0 || runOutput.stderr || runOutput.compile_output)
  const hasSuccess = runOutput && runOutput.exit_code === 0 && !runOutput.stderr && !runOutput.compile_output

  /* ── Main editor UI ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50" style={{ height: '100vh', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header
        className="bg-amber-100 border-b-[3px] border-amber-400 px-4 flex items-center justify-between gap-3 shrink-0"
        style={{ height: 56, boxShadow: '0 3px 0 #fbbf24' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/practice/leetcode')}
            className="text-amber-700 hover:text-amber-900 font-bold text-sm cursor-pointer shrink-0"
          >
            ← Back
          </button>
          <span className="font-extrabold text-gray-900 text-sm truncate" style={{ fontFamily: "'Baloo 2', cursive" }}>
            {problem.title}
          </span>
          <DiffBadge d={problem.difficulty} />
          {phase === 'user_responding' && (
            <span className="flex items-center gap-1 text-xs font-bold text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Recording
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Language pills */}
          {(['python', 'javascript', 'java', 'cpp'] as Language[]).map(lang => (
            <button
              key={lang}
              onClick={() => {
                setLanguage(lang)
                setRunOutput(null)
              }}
              className={`rounded-xl border-[2px] px-3 py-1 text-xs font-bold cursor-pointer transition-colors duration-100 ${
                language === lang
                  ? 'bg-amber-500 border-amber-700 text-white'
                  : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
              }`}
              style={{ boxShadow: language === lang ? '2px 2px 0px #92400e' : '2px 2px 0px #fde68a' }}
            >
              {LANG_LABELS[lang]}
            </button>
          ))}

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={runLoading || phase === 'scoring'}
            className="rounded-2xl border-[3px] border-amber-700 bg-amber-500 text-white font-extrabold text-sm px-4 py-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ boxShadow: '3px 3px 0px #92400e' }}
          >
            {runLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
              </svg>
            )}
            Run
          </button>

          {/* End Interview */}
          {phase !== 'idle' && (
            <button
              onClick={handleEndInterview}
              disabled={endingInterview || phase === 'scoring'}
              className="rounded-2xl border-[3px] border-gray-400 bg-white text-gray-700 font-bold text-sm px-4 py-1.5 cursor-pointer disabled:opacity-50 hover:bg-gray-50"
              style={{ boxShadow: '3px 3px 0px #d1d5db' }}
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
          className="w-[42%] overflow-y-auto bg-amber-50 border-r-[3px] border-amber-200 p-5"
          style={{ height: 'calc(100vh - 56px)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">
              #{problem.neetcode_number} · {problem.category.replace(/-/g, ' ')}
            </span>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed mb-5 whitespace-pre-line">
            {problem.description}
          </p>

          {problem.examples.map((ex, i) => (
            <div
              key={i}
              className="rounded-2xl border-[3px] border-amber-200 bg-white p-4 mb-3"
              style={{ boxShadow: '3px 3px 0px #fde68a' }}
            >
              <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">Example {i + 1}</p>
              <code className="text-xs text-gray-800 block mb-1">Input: {ex.input}</code>
              <code className="text-xs text-gray-800 block mb-1">Output: {ex.output}</code>
              {ex.explanation && <p className="text-xs text-gray-500 mt-1">{ex.explanation}</p>}
            </div>
          ))}

          <div className="mt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Constraints</p>
            <ul className="space-y-1">
              {problem.constraints.map((c, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                  <span className="text-amber-400 mt-0.5">·</span> {c}
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
            className="shrink-0 border-t-[3px] border-amber-200 bg-amber-50 flex items-center gap-4 px-5"
            style={{ height: 72 }}
          >
            {phase === 'idle' && (
              <button
                onClick={beginInterview}
                className="flex-1 rounded-2xl border-[3px] border-amber-700 bg-amber-500 text-white font-extrabold py-2.5 text-sm cursor-pointer hover:translate-y-[1px] transition-transform duration-150 flex items-center justify-center gap-2"
                style={{ boxShadow: '3px 3px 0px #92400e' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                </svg>
                Start Interview
              </button>
            )}

            {(phase === 'intro_speaking' || phase === 'ai_speaking' || phase === 'end_speaking') && (
              <>
                <div className="flex gap-1 shrink-0">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-amber-500"
                      style={{ animation: `bounce 1.2s infinite ${i * 0.2}s` }}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-700 font-medium leading-snug line-clamp-2 flex-1">{aiText}</p>
              </>
            )}

            {phase === 'user_responding' && (
              <>
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />
                <p className="text-sm text-gray-600 italic flex-1 line-clamp-1 min-w-0">
                  {caption || 'Listening…'}
                </p>
                <span className="text-xs text-gray-400 shrink-0">auto-submits on silence</span>
              </>
            )}

            {phase === 'ai_processing' && (
              <div className="flex items-center gap-3 flex-1">
                <svg className="w-4 h-4 animate-spin text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span className="text-sm text-gray-500">Processing…</span>
              </div>
            )}

            {phase === 'coding_free' && (
              <p className="text-sm text-gray-500 flex-1">
                Interviewer is watching — run your code or speak your thinking at any time.
              </p>
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
