# Interview Coach

## Stack
- Frontend: React + TypeScript + Vite + Tailwind (in /client)
- Backend: FastAPI + Python (in /server)
- Database + Auth: Supabase
- Transcription: OpenAI Whisper API
- AI Scoring: Claude API (claude-sonnet-4-6)
- Deployment: Railway

## Commands
- Frontend: cd client && npm run dev
- Backend: cd server && uvicorn main:app --reload

## Conventions
- Use TypeScript strict mode
- FastAPI routes go in /server/routers/
- All Claude API calls go through /server/services/claude_service.py
- Supabase client initialized once in /server/db.py

## Current focus
Building the STAR scoring engine