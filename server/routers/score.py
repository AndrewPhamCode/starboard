from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude_service import score_star_response

router = APIRouter(prefix="/score", tags=["score"])


class ScoreRequest(BaseModel):
    transcript: str
    question: str


class StarRewrite(BaseModel):
    situation: str
    task: str
    action: str
    result: str


class ScoreResponse(BaseModel):
    situation: int
    task: int
    action: int
    result: int
    feedback: str
    rewrite: StarRewrite


@router.post("", response_model=ScoreResponse)
async def score(body: ScoreRequest):
    if not body.transcript.strip():
        raise HTTPException(status_code=400, detail="transcript is required")
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="question is required")

    result = score_star_response(body.question, body.transcript)
    return result
