import json
import pathlib
from typing import Optional

import anthropic
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/leetcode", tags=["leetcode"])

DATA_FILE = pathlib.Path(__file__).parent.parent / "data" / "leetcode.json"

JUDGE0_LANGUAGE_IDS = {
    "python":     92,   # Python 3.11.2
    "javascript": 93,   # Node.js 18.15.0
    "java":       91,   # Java JDK 17.0.6
    "cpp":        54,   # C++ GCC 9.2.0
}

JUDGE0_URL = "https://ce.judge0.com/submissions?base64_encoded=false&wait=true"


class ExecuteRequest(BaseModel):
    language: str
    code: str
    problem_id: int


class InterviewerMessageRequest(BaseModel):
    problem_title: str
    problem_description: str
    trigger: str  # "start" | "run_error" | "run_success" | "idle" | "end"
    current_code: str
    run_output: Optional[dict] = None
    session_log: list[dict] = []
    follow_up_hints: list[str] = []


class LeetCodeScoreRequest(BaseModel):
    problem_title: str
    problem_description: str
    session_log: list[dict]
    code_runs: list[dict]
    final_code: str
    language: str


@router.get("/problems")
def get_problems(
    difficulty: Optional[str] = None,
    category: Optional[str] = None,
):
    problems = json.loads(DATA_FILE.read_text())
    if difficulty:
        problems = [p for p in problems if p.get("difficulty") == difficulty]
    if category:
        problems = [p for p in problems if p.get("category") == category]
    return problems


@router.post("/execute")
async def execute_code(body: ExecuteRequest):
    lang_id = JUDGE0_LANGUAGE_IDS.get(body.language)
    if not lang_id:
        raise HTTPException(status_code=422, detail=f"Unsupported language: {body.language}")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                JUDGE0_URL,
                json={"language_id": lang_id, "source_code": body.code},
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Code execution timed out. Your code may have an infinite loop.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Execution service unavailable: {str(e)}")

    status_id = data.get("status", {}).get("id", 0)
    exit_code = 0 if status_id == 3 else 1

    return {
        "stdout": data.get("stdout") or "",
        "stderr": data.get("stderr") or "",
        "compile_output": data.get("compile_output") or "",
        "exit_code": exit_code,
    }


@router.post("/interviewer-message")
async def get_interviewer_message(body: InterviewerMessageRequest):
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    trigger_instructions = {
        "start": (
            "The candidate has just opened the problem. Greet them warmly and ask them to "
            "start by clarifying the problem — what are the constraints, edge cases, and expected "
            "input/output format? Encourage them to think out loud before writing any code."
        ),
        "run_error": (
            "The candidate just ran their code and got an error. Reference the error naturally "
            "and ask them to walk you through what they think went wrong and how they plan to fix it. "
            "Be encouraging — errors are part of the process."
        ),
        "run_success": (
            "The candidate's code just ran successfully. Congratulate them briefly, then ask them "
            "to analyze the time and space complexity of their solution. Then ask if they can think "
            "of a more optimal approach."
        ),
        "idle": (
            "The candidate has been quiet for a while. Gently check in and ask them to verbalize "
            "their current thinking — what approach are they considering and what's blocking them?"
        ),
        "end": (
            "The interview is wrapping up. Ask one or two meaningful follow-up questions based on "
            "the problem and the candidate's solution. Focus on edge cases they may have missed, "
            "alternative approaches, or how they would adapt the solution for scale. "
            "Then wrap up warmly."
        ),
    }

    run_context = ""
    if body.run_output:
        if body.run_output.get("stderr") or body.run_output.get("compile_output"):
            err = body.run_output.get("stderr") or body.run_output.get("compile_output")
            run_context = f"\nLatest error output:\n{err[:500]}"
        elif body.run_output.get("stdout"):
            run_context = f"\nLatest output: {body.run_output['stdout'][:200]}"

    hint_context = ""
    if body.follow_up_hints and body.trigger == "end":
        hint_context = f"\nFollow-up hints to draw from: {'; '.join(body.follow_up_hints)}"

    conversation = "\n".join(
        f"{'Interviewer' if t['role'] == 'interviewer' else 'Candidate'}: {t['content']}"
        for t in body.session_log[-6:]
    )

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=256,
        system=(
            "You are a friendly but thorough technical interviewer at a top tech company. "
            "You speak naturally and conversationally — like a real interviewer, not a robot. "
            "Keep your responses concise: 2-4 sentences. Ask only one clear question at a time. "
            "Never give away the answer. Focus on getting the candidate to think out loud."
        ),
        messages=[{
            "role": "user",
            "content": (
                f"Problem: {body.problem_title}\n"
                f"Description: {body.problem_description[:300]}\n"
                f"{run_context}"
                f"{hint_context}\n\n"
                f"Recent conversation:\n{conversation}\n\n"
                f"Current candidate code (first 400 chars):\n{body.current_code[:400]}\n\n"
                f"Situation: {trigger_instructions.get(body.trigger, 'Check in with the candidate.')}\n\n"
                "Generate your next interviewer message:"
            ),
        }],
    )

    return {"message": message.content[0].text.strip()}


@router.post("/score")
async def score_session(body: LeetCodeScoreRequest):
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    conversation_text = "\n".join(
        f"{'Interviewer' if t['role'] == 'interviewer' else 'Candidate'}: {t['content']}"
        for t in body.session_log
    )

    runs_summary = "\n".join(
        f"Run {i+1}: exit_code={r['exit_code']}, "
        f"stdout={r.get('stdout','')[:100]}, stderr={r.get('stderr','')[:100]}"
        for i, r in enumerate(body.code_runs)
    )

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=(
            "You are an expert technical interviewer who evaluates coding interview performance. "
            "Score candidates honestly and constructively on a 1-5 scale per dimension. "
            "Return only valid JSON — no markdown fences, no extra text."
        ),
        messages=[{
            "role": "user",
            "content": f"""Evaluate this coding interview session for the problem: {body.problem_title}

Problem description: {body.problem_description[:400]}

Full conversation transcript:
{conversation_text}

Code execution history:
{runs_summary}

Final code ({body.language}):
{body.final_code[:800]}

Score on these 6 dimensions (1=poor, 3=acceptable, 5=excellent):
1. clarification: Did they ask about constraints, edge cases, and input format before coding?
2. communication: Did they explain their thinking clearly while working?
3. solution_quality: Was the final code correct, clean, and well-structured?
4. complexity_analysis: Did they correctly identify and explain time/space complexity?
5. follow_up_handling: How well did they answer the interviewer's follow-up questions?
6. adaptability: How well did they adapt when hitting errors or when pushed to optimize?

Also score delivery:
- filler_word_count: estimated count of filler words (um, uh, like, you know)
- words_per_minute: estimated speaking pace (120-160 is ideal)
- confidence: 1-5
- flow: 1-5 (natural vs choppy communication)

Return ONLY this JSON:
{{
  "clarification": <1-5>,
  "communication": <1-5>,
  "solution_quality": <1-5>,
  "complexity_analysis": <1-5>,
  "follow_up_handling": <1-5>,
  "adaptability": <1-5>,
  "delivery": {{
    "filler_word_count": <int>,
    "words_per_minute": <int>,
    "confidence": <1-5>,
    "flow": <1-5>
  }},
  "feedback": "<2-3 sentence coaching note highlighting what went well and the top improvement area>",
  "model_approach": "<One paragraph describing the optimal approach with time/space complexity, e.g. Use a hash map for $O(n)$ time and $O(n)$ space>"
}}""",
        }],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse score response.")
