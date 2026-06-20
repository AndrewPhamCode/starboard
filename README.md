# Interview Coach

Full-stack application with a React + TypeScript frontend and a FastAPI backend, backed by Supabase.

## Project structure

```
interview-coach/
├── client/   # React + TypeScript (Vite, Tailwind CSS v4)
└── server/   # FastAPI (Python)
```

## Prerequisites

- Node.js 18+
- Python 3.11+
- A [Supabase](https://supabase.com) project

## Getting started

### 1. Clone and configure environment variables

**Frontend** — copy and fill in your Supabase credentials:

```bash
cp client/.env.example client/.env.local
```

**Backend** — copy and fill in your Supabase credentials:

```bash
cp server/.env.example server/.env
```

### 2. Start the frontend

```bash
cd client
npm install
npm run dev
```

Runs on <http://localhost:5173>. API calls to `/api/*` are proxied to the backend.

### 3. Start the backend

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Runs on <http://localhost:8000>. Interactive docs at <http://localhost:8000/docs>.

## Environment variables

### client/.env.local

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

### server/.env

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (keep secret) |
| `CORS_ORIGINS` | JSON list of allowed origins, e.g. `["http://localhost:5173"]` |
