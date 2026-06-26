from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude_service import score_star_response, score_system_design_response

router = APIRouter(prefix="/score", tags=["score"])

FILLER_WORDS = ["um", "uh", "like", "you know", "sort of", "kind of", "basically", "literally"]


def count_fillers(text: str) -> int:
    lower = f" {text.lower()} "
    return sum(lower.count(f" {w} ") for w in FILLER_WORDS)


def compute_wpm(text: str, duration_seconds: float) -> int:
    if duration_seconds <= 0:
        return 0
    return round(len(text.split()) / (duration_seconds / 60))


class ScoreRequest(BaseModel):
    question: str
    transcript: str
    follow_up_question: Optional[str] = None
    follow_up_transcript: Optional[str] = None
    duration_seconds: Optional[float] = None
    follow_up_duration_seconds: Optional[float] = None


class StarRewrite(BaseModel):
    situation: str
    task: str
    action: str
    result: str


class DeliveryScores(BaseModel):
    filler_word_count: int
    words_per_minute: int
    confidence: int
    flow: int


class ScoreResponse(BaseModel):
    situation: int
    task: int
    action: int
    result: int
    follow_up_handling: Optional[int] = None
    delivery: DeliveryScores
    feedback: str
    rewrite: StarRewrite


class DesignScoreRequest(BaseModel):
    question: str
    transcript: str
    duration_seconds: Optional[float] = None


class DesignScoreResponse(BaseModel):
    clarification: int
    design: int
    deep_dive: int
    tradeoffs: int
    scale: int
    communication: int
    filler_word_count: int
    words_per_minute: int
    feedback: str
    model_answer: str


@router.post("/system-design", response_model=DesignScoreResponse)
async def score_design(body: DesignScoreRequest):
    if not body.transcript.strip():
        raise HTTPException(status_code=400, detail="transcript is required")
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="question is required")

    filler_count = count_fillers(body.transcript)
    wpm = compute_wpm(body.transcript, body.duration_seconds) if body.duration_seconds else 0

    result = score_system_design_response(question=body.question, transcript=body.transcript)
    result["filler_word_count"] = filler_count
    result["words_per_minute"] = wpm
    return result


@router.post("", response_model=ScoreResponse)
async def score(body: ScoreRequest):
    if not body.transcript.strip():
        raise HTTPException(status_code=400, detail="transcript is required")
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="question is required")

    all_text = body.transcript + (" " + body.follow_up_transcript if body.follow_up_transcript else "")
    filler_count = count_fillers(all_text)

    total_words = len(body.transcript.split())
    total_duration = (body.duration_seconds or 0) + (body.follow_up_duration_seconds or 0)
    wpm = compute_wpm(body.transcript, body.duration_seconds) if body.duration_seconds else 0

    result = score_star_response(
        question=body.question,
        transcript=body.transcript,
        follow_up_question=body.follow_up_question,
        follow_up_transcript=body.follow_up_transcript,
    )

    result["delivery"] = {
        "filler_word_count": filler_count,
        "words_per_minute": wpm,
        "confidence": result.pop("confidence", 3),
        "flow": result.pop("flow", 3),
    }

    return result
