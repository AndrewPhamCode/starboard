import json

import anthropic
from fastapi import HTTPException

from app.config import settings


def score_star_response(question: str, transcript: str) -> dict:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    system = (
        "You are an expert interview coach evaluating STAR method responses. "
        "Return only valid JSON with no markdown fences or extra text."
    )

    user = f"""Question: {question}

Candidate answer: {transcript}

Score each STAR dimension from 1 (absent/very weak) to 5 (excellent).
Return exactly this JSON structure:
{{
  "situation": <1-5>,
  "task": <1-5>,
  "action": <1-5>,
  "result": <1-5>,
  "feedback": "<2-3 sentence coaching note highlighting the biggest strengths and gaps>",
  "rewrite": {{
    "situation": "<1-2 sentences: a strong model Situation — the context and background>",
    "task": "<1-2 sentences: a strong model Task — your specific responsibility or challenge>",
    "action": "<2-3 sentences: a strong model Action — concrete steps you took>",
    "result": "<1-2 sentences: a strong model Result — measurable outcome and impact>"
  }}
}}"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=system,
        messages=[{"role": "user", "content": user}],
    )

    raw = message.content[0].text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Failed to parse Claude response: {raw[:200]}")
