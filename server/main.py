from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from routers.questions import router as questions_router
from routers.score import router as score_router
from routers.transcribe import router as transcribe_router

app = FastAPI(title="Starboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(questions_router)
app.include_router(transcribe_router)
app.include_router(score_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
