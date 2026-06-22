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

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec