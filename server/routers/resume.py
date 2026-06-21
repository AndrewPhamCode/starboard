import io
import json

import anthropic
from fastapi import APIRouter, File, HTTPException, UploadFile
from pypdf import PdfReader

from app.config import settings

router = APIRouter(prefix="/resume", tags=["resume"])


def extract_pdf_text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


@router.post("/questions")
async def generate_resume_questions(file: UploadFile = File(...)):
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    content = await file.read()
    try:
        text = extract_pdf_text(content)
    except Exception:
        raise HTTPException(status_code=422, detail="Could not read the PDF. Please upload a text-based PDF.")

    if not text.strip():
        raise HTTPException(status_code=422, detail="No text found in PDF. Make sure it is not a scanned image.")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"""You are a senior engineer conducting a resume interview.

Based on this resume, generate exactly 8 interview questions that dig into the candidate's specific projects, roles, and accomplishments. Reference real details from their resume — company names, project names, technologies, and outcomes.

Cover a mix of:
- Walk me through [specific project] — what was your contribution and the impact?
- Tell me about a technical challenge you faced at [company] and how you solved it.
- You listed [technology/achievement] — can you go deeper on that?
- What is the most complex thing you built at [company]?

Resume:
{text[:4000]}

Return only a JSON array of question strings, no other text.
Example: ["Question 1?", "Question 2?"]""",
        }],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        questions = json.loads(raw)
        if not isinstance(questions, list) or not questions:
            raise ValueError
        return {
            "questions": [
                {"id": i + 1, "type": "resume", "category": "experience", "text": q}
                for i, q in enumerate(questions)
                if isinstance(q, str)
            ]
        }
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=500, detail="Failed to generate questions from resume.")
