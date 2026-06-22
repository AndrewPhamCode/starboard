from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
import anthropic

router = APIRouter(prefix="/follow-up", tags=["follow-up"])


class FollowUpRequest(BaseModel):
    question: str
    transcript: str


class FollowUpResponse(BaseModel):
    follow_up: str


@router.post("", response_model=FollowUpResponse)
async def generate_follow_up(body: FollowUpRequest):
    if not body.transcript.strip():
        raise HTTPException(status_code=400, detail="transcript is required")
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=60,
        system=(
            "You are a senior technical interviewer. Given the original question and the candidate's answer, "
            "write ONE sharp follow-up question (max 20 words) that targets the weakest or vaguest part of their answer. "
            "Sound like a real person — not a chatbot. No praise. No preamble. Return only the question."
        ),
        messages=[{
            "role": "user",
            "content": f"Original question: {body.question}\n\nCandidate's answer: {body.transcript}"
        }],
    )

    follow_up = message.content[0].text.strip().strip('"').strip("'")
    return {"follow_up": follow_up}
