from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
import anthropic

router = APIRouter(prefix="/follow-up", tags=["follow-up"])


class FollowUpRequest(BaseModel):
    question: str
    transcript: str


class FollowUpResponse(BaseModel):
    reaction: str
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
        max_tokens=120,
        system=(
            "You are a senior engineer conducting a technical interview. "
            "Given the question and the candidate's answer, respond with two parts:\n"
            "1. REACTION: One sentence (max 15 words) acknowledging what they said. "
            "Tone: professional and measured — not praise, not criticism. "
            "Examples: 'Got it, that gives me some context.' / 'Okay, I want to dig into that.' / 'Alright, so you took the lead on that.'\n"
            "2. FOLLOW_UP: One sharp question (max 20 words) targeting the weakest or vaguest part of their answer.\n"
            "Return exactly two lines:\nREACTION: <text>\nFOLLOW_UP: <text>"
        ),
        messages=[{
            "role": "user",
            "content": f"Question: {body.question}\n\nAnswer: {body.transcript}"
        }],
    )

    text = message.content[0].text.strip()
    lines = {
        parts[0].strip().upper(): parts[1].strip()
        for l in text.splitlines()
        if ":" in l
        for parts in [l.split(":", 1)]
    }
    reaction = lines.get("REACTION", "Okay, got it.")
    follow_up = lines.get("FOLLOW_UP", "Can you elaborate on that?").strip('"\'')
    return {"reaction": reaction, "follow_up": follow_up}
