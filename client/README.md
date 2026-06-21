# Starboard — Design Decisions

## Frontend

**Claymorphism UI**
Hard 3px borders, zero-blur drop shadows (`5px 5px 0px`), and `rounded-3xl` corners. All built on a single `Clay` component so the style is consistent and easy to update globally.

**Color-per-mode**
Each interview mode owns a color family (rose, violet, emerald, amber) applied consistently across cards, tabs, icons, and score bars. Color becomes a navigation signal — users recognize their mode by color before reading text.

**Fonts**
- Baloo 2 — headings and CTAs, rounds out the clay aesthetic
- Plus Jakarta Sans — body and UI text

**Warm cream base (`#FEFCE8`)**
Avoids pure white fatigue. Alternating `bg-white` sections create rhythm without hard dividers.

**Record button states**
Three distinct states (idle / recording / transcribing) with `animate-pulse` during recording and a live `MM:SS` monospace timer. Prevents users from wondering if the mic is on.

**Score card color coding**
4–5 → indigo, 3 → amber, 1–2 → red. Users read their score at a glance without parsing numbers.

---

## Backend

**Whisper (OpenAI) for transcription**
Voice input to simulate a real interview environment. Whisper handles accents and filler words better than browser-native speech APIs and returns clean text for Claude to score.

**FastAPI**
The whole backend stays in Python — Whisper, Claude API, and Supabase all have Python SDKs. FastAPI gives async support and auto-generated `/docs` for free.

**Supabase over Firebase**
Session data (questions, scores, transcripts) is relational — users have sessions, sessions have answers, answers have scores. A document store would mean nested objects and manual joins. Supabase gives PostgreSQL, auth, and real-time out of the box.

**Claude (`claude-sonnet-4-6`) for scoring**
All Claude API calls go through a single `claude_service.py`. Centralizing this means one place to update prompts, tweak the model, or add retries.