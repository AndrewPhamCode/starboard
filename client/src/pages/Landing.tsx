import { Link } from 'react-router-dom'

function scrollToTypes() {
  document.getElementById('interview-types')?.scrollIntoView({ behavior: 'smooth' })
}

/* ─── Clay card helper ─────────────────────────────────────────────────────
   border: 3px solid <borderColor>
   shadow: hard offset (no blur) gives the clay "lifted" look           */
interface ClayProps {
  bg: string
  border: string
  shadow: string
  className?: string
  children: React.ReactNode
  style?: React.CSSProperties
}
function Clay({ bg, border, shadow, className = '', children, style }: ClayProps) {
  return (
    <div
      className={`rounded-3xl border-[3px] ${bg} ${border} ${className}`}
      style={{ boxShadow: `5px 5px 0px ${shadow}`, ...style }}
    >
      {children}
    </div>
  )
}

/* ─── Star rating SVG ──────────────────────────────────────────────────── */
function Stars({ n = 5 }: { n?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className={`w-4 h-4 ${i < n ? 'text-amber-400' : 'text-gray-200'}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

/* ─── Data ──────────────────────────────────────────────────────────────── */
const COURSES = [
  {
    title: 'Behavioral',
    desc: 'Master leadership, conflict, and impact stories with the STAR method.',
    count: '20 questions',
    href: '/practice/behavioral',
    bg: 'bg-rose-100',
    border: 'border-rose-400',
    shadow: '#f87171',
    iconBg: 'bg-rose-400',
    soon: false,
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Technical',
    desc: 'System design, debugging, and architecture questions with AI scoring.',
    count: '8 questions',
    href: '/practice/technical',
    bg: 'bg-violet-100',
    border: 'border-violet-400',
    shadow: '#a78bfa',
    iconBg: 'bg-violet-500',
    soon: false,
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    title: 'Resume Screening',
    desc: 'Walk through your projects and experience with confidence.',
    count: '4 questions',
    href: '/practice/resume',
    bg: 'bg-emerald-100',
    border: 'border-emerald-400',
    shadow: '#34d399',
    iconBg: 'bg-emerald-500',
    soon: false,
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    title: 'LeetCode',
    desc: 'Verbalize your algorithmic thinking out loud — coming next.',
    count: 'Coming soon',
    href: '/practice/leetcode',
    bg: 'bg-amber-100',
    border: 'border-amber-400',
    shadow: '#fbbf24',
    iconBg: 'bg-amber-400',
    soon: true,
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
  },
]

const STAR_DEMO = [
  { label: 'Situation', letter: 'S', score: 4, color: 'bg-rose-400', track: 'bg-rose-100' },
  { label: 'Task', letter: 'T', score: 3, color: 'bg-amber-400', track: 'bg-amber-100' },
  { label: 'Action', letter: 'A', score: 5, color: 'bg-violet-500', track: 'bg-violet-100' },
  { label: 'Result', letter: 'R', score: 4, color: 'bg-emerald-500', track: 'bg-emerald-100' },
]

const TESTIMONIALS = [
  {
    name: 'Marcus T.',
    role: 'Software Engineer',
    quote: "The STAR breakdown showed me exactly where I was losing interviewers. Got an offer at my dream company after two weeks of practice.",
    stars: 5,
    avatarBg: 'bg-rose-400',
    cardBg: 'bg-yellow-50',
    border: 'border-yellow-400',
    shadow: '#fbbf24',
    initials: 'MT',
  },
  {
    name: 'Priya S.',
    role: 'Product Manager',
    quote: "The model rewrites were eye-opening. I could see the gap between what I said and what a strong answer looks like.",
    stars: 5,
    avatarBg: 'bg-violet-500',
    cardBg: 'bg-violet-50',
    border: 'border-violet-400',
    shadow: '#a78bfa',
    initials: 'PS',
  },
  {
    name: 'Jordan K.',
    role: 'Data Scientist',
    quote: "Practiced 10 minutes a day for a week. My answers became so much more structured — interviewers actually commented on it.",
    stars: 5,
    avatarBg: 'bg-emerald-500',
    cardBg: 'bg-emerald-50',
    border: 'border-emerald-400',
    shadow: '#34d399',
    initials: 'JK',
  },
]

const STATS = [
  { value: '32+', label: 'Curated questions' },
  { value: '4', label: 'Interview modes' },
  { value: 'STAR', label: 'AI scoring method' },
]

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function Landing() {
  return (
    <div className="min-h-screen bg-[#FEFCE8] overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ── Nav ── */}
      <nav className="max-w-6xl mx-auto px-6 pt-6 flex items-center justify-between">
        <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: '1.4rem', color: '#1e1b4b' }}>
          Star<span style={{ color: '#f97316' }}>board</span>
        </span>
        <Clay
          bg="bg-white"
          border="border-gray-300"
          shadow="#d1d5db"
          className="px-5 py-2 cursor-pointer hover:translate-y-[1px] transition-transform duration-150 opacity-60"
          style={{ boxShadow: '4px 4px 0px #d1d5db' }}
        >
          <span className="text-gray-600 font-bold text-sm">Login</span>
        </Clay>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 text-center relative">
        {/* Decorative blobs */}
        <div className="absolute top-8 left-8 w-20 h-20 rounded-full bg-rose-300 border-[3px] border-rose-500 opacity-70"
          style={{ boxShadow: '4px 4px 0px #f87171' }} />
        <div className="absolute top-4 right-12 w-14 h-14 rounded-full bg-sky-300 border-[3px] border-sky-500 opacity-70"
          style={{ boxShadow: '3px 3px 0px #38bdf8' }} />
        <div className="absolute bottom-0 left-1/4 w-10 h-10 rounded-full bg-violet-300 border-[2px] border-violet-500 opacity-60"
          style={{ boxShadow: '3px 3px 0px #a78bfa' }} />
        <div className="absolute top-20 right-1/4 w-8 h-8 rounded-full bg-emerald-300 border-[2px] border-emerald-500 opacity-60"
          style={{ boxShadow: '2px 2px 0px #34d399' }} />

        <div className="relative z-10">
          <Clay
            bg="bg-violet-100"
            border="border-violet-300"
            shadow="#c4b5fd"
            className="inline-block px-4 py-1.5 mb-6"
          >
            <span className="text-violet-700 text-xs font-bold uppercase tracking-widest">AI-Powered Interview Prep</span>
          </Clay>

          <h1
            className="text-5xl md:text-7xl font-extrabold text-gray-900 leading-tight mb-6"
            style={{ fontFamily: "'Baloo 2', cursive" }}
          >
            Ace every{' '}
            <span className="relative inline-block">
              <span className="relative z-10 text-orange-500">interview</span>
              <span className="absolute bottom-1 left-0 right-0 h-4 bg-yellow-300 rounded-full -z-10 border-2 border-yellow-400" />
            </span>
            <br />you walk into.
          </h1>

          <p className="text-gray-600 text-lg md:text-xl max-w-xl mx-auto mb-10 leading-relaxed">
            Record your answer. Get scored on every part of the STAR method. See a model rewrite. Land the offer.
          </p>

          <button onClick={scrollToTypes}>
            <Clay
              bg="bg-orange-500"
              border="border-orange-700"
              shadow="#9a3412"
              className="inline-block px-10 py-4 cursor-pointer hover:translate-y-[2px] transition-transform duration-150"
              style={{ boxShadow: '6px 6px 0px #9a3412' }}
            >
              <span className="text-white font-extrabold text-lg" style={{ fontFamily: "'Baloo 2', cursive" }}>
                Start practicing — it's free
              </span>
            </Clay>
          </button>
          <p className="mt-4 text-gray-400 text-sm">No account needed. Pick your interview type below.</p>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
          {STATS.map((s) => (
            <Clay key={s.label} bg="bg-white" border="border-gray-300" shadow="#d1d5db" className="p-4 text-center">
              <div className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: "'Baloo 2', cursive" }}>{s.value}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</div>
            </Clay>
          ))}
        </div>
      </section>

      {/* ── Course catalog ── */}
      <section id="interview-types" className="bg-white py-20 scroll-mt-6">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-3" style={{ fontFamily: "'Baloo 2', cursive" }}>
              Pick your interview type
            </h2>
            <p className="text-gray-500 text-base max-w-md mx-auto">Four modes. One platform. Every format that stands between you and your next offer.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {COURSES.map((c) => (
              <Link key={c.title} to={c.href} className="block group">
                <Clay bg={c.bg} border={c.border} shadow={c.shadow}
                  className="p-6 relative cursor-pointer h-full group-hover:translate-y-[2px] transition-transform duration-150"
                  style={{ boxShadow: '5px 5px 0px ' + c.shadow }}>
                  {c.soon && (
                    <Clay bg="bg-amber-400" border="border-amber-600" shadow="#b45309"
                      className="absolute -top-3 -right-3 px-2 py-0.5">
                      <span className="text-white text-xs font-bold">Soon</span>
                    </Clay>
                  )}
                  <div className={`w-10 h-10 rounded-2xl ${c.iconBg} border-2 border-white flex items-center justify-center mb-4`}
                    style={{ boxShadow: '2px 2px 0px rgba(0,0,0,0.15)' }}>
                    {c.icon}
                  </div>
                  <h3 className="font-extrabold text-gray-900 mb-1.5" style={{ fontFamily: "'Baloo 2', cursive", fontSize: '1.1rem' }}>
                    {c.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">{c.desc}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 002.25 2.25h.75" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-500">{c.count}</span>
                    </div>
                    {!c.soon && (
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    )}
                  </div>
                </Clay>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Progress tracking demo ── */}
      <section className="bg-[#FEFCE8] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Clay bg="bg-emerald-100" border="border-emerald-300" shadow="#6ee7b7" className="inline-block px-3 py-1 mb-5">
                <span className="text-emerald-700 text-xs font-bold uppercase tracking-widest">Live AI Scoring</span>
              </Clay>
              <h2 className="text-4xl font-extrabold text-gray-900 mb-5 leading-tight" style={{ fontFamily: "'Baloo 2', cursive" }}>
                See exactly where<br />you need to improve.
              </h2>
              <p className="text-gray-600 text-base leading-relaxed mb-6">
                Every answer is scored across all four STAR dimensions. You see the number, the coaching note, and a model rewrite for each section — not just generic feedback.
              </p>
              <ul className="space-y-3">
                {['Instant scoring after each answer', 'Per-section model rewrites', 'Coaching notes from AI'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Clay bg="bg-emerald-400" border="border-emerald-600" shadow="#059669" className="w-6 h-6 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </Clay>
                    <span className="text-gray-700 font-medium text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Demo card */}
            <Clay bg="bg-white" border="border-gray-300" shadow="#d1d5db" className="p-7">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-0.5">AI Feedback</p>
                  <p className="font-extrabold text-gray-900 text-lg" style={{ fontFamily: "'Baloo 2', cursive" }}>STAR Score</p>
                </div>
                <Clay bg="bg-violet-500" border="border-violet-700" shadow="#5b21b6" className="w-14 h-14 flex flex-col items-center justify-center">
                  <span className="text-white font-extrabold text-2xl leading-none" style={{ fontFamily: "'Baloo 2', cursive" }}>4</span>
                  <span className="text-violet-200 text-xs font-semibold">/ 5</span>
                </Clay>
              </div>

              {/* Bars */}
              <div className="space-y-4 mb-6">
                {STAR_DEMO.map(({ label, letter, score, color, track }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Clay bg={color} border="border-transparent" shadow="rgba(0,0,0,0.15)"
                      className="w-7 h-7 flex items-center justify-center shrink-0"
                      style={{ boxShadow: '2px 2px 0px rgba(0,0,0,0.2)' }}>
                      <span className="text-white text-xs font-extrabold">{letter}</span>
                    </Clay>
                    <span className="w-16 shrink-0 text-sm font-semibold text-gray-700">{label}</span>
                    <div className={`flex-1 h-4 rounded-full ${track} border-2 border-gray-200 overflow-hidden`}>
                      <div
                        className={`h-full rounded-full ${color} border-r-2 border-white`}
                        style={{ width: `${(score / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-extrabold text-gray-700 w-6 text-right">{score}</span>
                  </div>
                ))}
              </div>

              {/* Coaching note */}
              <Clay bg="bg-yellow-50" border="border-yellow-300" shadow="#fbbf24" className="p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-yellow-700 mb-1.5">Coaching note</p>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Strong action section. Quantify your result more specifically — mention the actual metric or timeline to make it land.
                </p>
              </Clay>
            </Clay>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-3" style={{ fontFamily: "'Baloo 2', cursive" }}>
              From the people who got the job
            </h2>
            <p className="text-gray-500 text-base">Real feedback from real interview prep.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <Clay key={t.name} bg={t.cardBg} border={t.border} shadow={t.shadow} className="p-7">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-2xl ${t.avatarBg} border-2 border-white flex items-center justify-center`}
                    style={{ boxShadow: '2px 2px 0px rgba(0,0,0,0.15)' }}>
                    <span className="text-white font-extrabold text-sm">{t.initials}</span>
                  </div>
                  <div>
                    <p className="font-extrabold text-gray-900 text-sm" style={{ fontFamily: "'Baloo 2', cursive" }}>{t.name}</p>
                    <p className="text-xs text-gray-500 font-medium">{t.role}</p>
                  </div>
                </div>
                <Stars n={t.stars} />
                <p className="text-gray-700 text-sm leading-relaxed mt-3">"{t.quote}"</p>
              </Clay>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-[#FEFCE8]">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <Clay bg="bg-orange-100" border="border-orange-300" shadow="#fb923c" className="p-12">
            {/* Decorative dots */}
            <div className="flex justify-center gap-2 mb-6">
              {['bg-rose-400', 'bg-violet-400', 'bg-emerald-400', 'bg-sky-400', 'bg-amber-400'].map((c, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${c}`} />
              ))}
            </div>

            <h2 className="text-4xl font-extrabold text-gray-900 mb-4 leading-tight" style={{ fontFamily: "'Baloo 2', cursive" }}>
              Ready to land your<br />next offer?
            </h2>
            <p className="text-gray-600 text-base mb-8 max-w-sm mx-auto leading-relaxed">
              Pick a question, record your answer, and get instant AI feedback — right now, no signup.
            </p>

            <button onClick={scrollToTypes}>
              <Clay
                bg="bg-orange-500"
                border="border-orange-700"
                shadow="#9a3412"
                className="inline-block px-10 py-4 cursor-pointer hover:translate-y-[2px] transition-transform duration-150"
                style={{ boxShadow: '6px 6px 0px #9a3412' }}
              >
                <span className="text-white font-extrabold text-lg" style={{ fontFamily: "'Baloo 2', cursive" }}>
                  Choose your interview type
                </span>
              </Clay>
            </button>

            <p className="mt-5 text-gray-400 text-sm">Free forever. No credit card. Just practice.</p>
          </Clay>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t-[3px] border-gray-200 py-8 text-center bg-white">
        <span className="font-extrabold text-gray-800" style={{ fontFamily: "'Baloo 2', cursive" }}>
          Star<span className="text-orange-500">board</span>
        </span>
        <span className="text-gray-400 text-sm ml-3">— built to get you the job.</span>
      </footer>
    </div>
  )
}
