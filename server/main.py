from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from routers.company import router as company_router
from routers.leetcode import router as leetcode_router
from routers.follow_up import router as follow_up_router
from routers.questions import router as questions_router
from routers.resume import router as resume_router
from routers.score import router as score_router
from routers.transcribe import router as transcribe_router
from routers.tts import router as tts_router

app = FastAPI(title="Starboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(questions_router, prefix="/api")
app.include_router(transcribe_router, prefix="/api")
app.include_router(score_router, prefix="/api")
app.include_router(follow_up_router, prefix="/api")
app.include_router(resume_router, prefix="/api")
app.include_router(tts_router, prefix="/api")
app.include_router(company_router, prefix="/api")
app.include_router(leetcode_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
