import json
from typing import Optional

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/company", tags=["company"])

POPULAR_COMPANIES = {
    "amazon": "Amazon's 14 Leadership Principles (Customer Obsession, Ownership, Bias for Action, etc.)",
    "google": "Google's four behavioral pillars: General Cognitive Ability, Leadership, Googleyness, and Role-Related Knowledge",
    "meta": "Meta's focus on impact at scale, moving fast, and cross-functional collaboration",
    "microsoft": "Microsoft's Growth Mindset culture and emphasis on customer empathy and collaboration",
    "apple": "Apple's focus on craftsmanship, attention to detail, and product thinking",
    "stripe": "Stripe's high bar for technical rigor, written communication, and first-principles thinking",
    "airbnb": "Airbnb's focus on belonging, entrepreneurial thinking, and hosting culture",
    "uber": "Uber's emphasis on customer obsession, map-reduce thinking, and building for global scale",
    "netflix": "Netflix's high-performance culture, context-not-control philosophy, and freedom with responsibility",
    "linkedin": "LinkedIn's focus on transformation, integrity, and member-first decisions",
}


class CompanyRequest(BaseModel):
    company: str
    type: str = "behavioral"
    role: Optional[str] = None
    difficulty: Optional[str] = None


@router.post("/questions")
async def generate_company_questions(body: CompanyRequest):
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    company = body.company.strip()
    if not company:
        raise HTTPException(status_code=422, detail="Company name is required.")

    interview_type = body.type
    role = body.role or "general"
    difficulty = body.difficulty or "mid"

    company_hint = POPULAR_COMPANIES.get(company.lower(), "")
    company_context = f"Known interview culture: {company_hint}" if company_hint else ""

    type_instruction = (
        "behavioral STAR-format questions (Situation, Task, Action, Result) that probe real past experiences"
        if interview_type == "behavioral"
        else (
            "technical questions covering system design, debugging, and architecture. "
            "Do NOT generate LeetCode-style coding puzzles, data structure implementations, "
            "or algorithm questions (e.g. sorting, graph traversal, dynamic programming, "
            "string manipulation). Every question must probe production engineering "
            "experience and architectural thinking, not whiteboard coding."
        )
    )

    role_line = f"Role focus: {role}" if role and role != "general" else ""
    difficulty_line = f"Difficulty level: {difficulty} (intern = entry-level concepts, mid = production experience, senior = architectural depth and leadership)" if difficulty else ""

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system="You are an expert on tech company interview processes with deep knowledge of how top companies hire engineers.",
        messages=[{
            "role": "user",
            "content": f"""Generate exactly 8 {interview_type} interview questions that {company} asks candidates in real interviews.

{company_context}
Interview type: {type_instruction}
{role_line}
{difficulty_line}

Make the questions specific to {company}'s known style — reference the company's values, culture, and interview format where appropriate.

Return only valid JSON — no markdown fences, no extra text:
{{
  "questions": ["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?", "Question 6?", "Question 7?", "Question 8?"],
  "style_note": "One sentence describing what {company} emphasizes in this type of interview."
}}""",
        }],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(raw)
        questions_list = parsed.get("questions", [])
        style_note = parsed.get("style_note", "")
        if not isinstance(questions_list, list) or not questions_list:
            raise ValueError
        return {
            "questions": [
                {
                    "id": i + 1,
                    "type": interview_type,
                    "category": company.lower(),
                    "role": role,
                    "difficulty": difficulty,
                    "text": q,
                }
                for i, q in enumerate(questions_list)
                if isinstance(q, str)
            ],
            "style_note": style_note,
        }
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=500, detail="Failed to generate company questions.")
