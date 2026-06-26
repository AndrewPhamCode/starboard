import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/interview", tags=["interview"])

PERSONA_PROMPTS = {
    "collaborative": (
        "You are Sam, a senior engineer at Google. You are thoughtful and collaborative. "
        "You probe to help candidates surface their best thinking. You acknowledge good points "
        "briefly but still push for depth. You're supportive but rigorous."
    ),
    "direct": (
        "You are Alex, a senior engineer conducting a technical interview. You are direct and efficient. "
        "You don't waste words. A solid answer gets a neutral acknowledgment and an immediate follow-up push. "
        "An incomplete answer gets an immediate redirect. No small talk."
    ),
    "challenging": (
        "You are Jordan, a principal engineer at Stripe. You are skeptical and demanding. "
        "You push back on every vague claim. You ask 'Why?' and 'What specifically?' constantly. "
        "You're never satisfied with generic answers — you want numbers, names, and edge cases."
    ),
}

RESPONSE_RULES = """Rules:
- 1-2 sentences MAXIMUM. Never 3 sentences.
- BANNED phrases: 'Great!', 'Excellent!', 'That's a good point', 'Interesting!', 'I see', 'Perfect'.
- Always reference what the candidate actually said — never respond generically.
- If the answer is vague, ask for the specific detail they omitted.
- If the result is missing, ask: 'What was the measurable outcome?'
- If their individual contribution is unclear, ask: 'What specifically did YOU do?'
- If the answer is comprehensive and this is turn 3+, you may wrap up: say 'Got it, I think I have what I need.' and nothing else."""


class InterviewTurnRequest(BaseModel):
    question: str
    transcript_so_far: str
    turn_number: int  # 0 = initial answer, 1+ = follow-ups
    session_history: list[dict] = []  # [{role: "interviewer"|"candidate", content: str}]
    persona: str = "direct"  # "collaborative" | "direct" | "challenging"


@router.post("/turn")
async def interview_turn(body: InterviewTurnRequest):
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    persona_prompt = PERSONA_PROMPTS.get(body.persona, PERSONA_PROMPTS["direct"])

    conversation = "\n".join(
        f"{'Interviewer' if t['role'] == 'interviewer' else 'Candidate'}: {t['content']}"
        for t in body.session_history[-8:]
    )

    is_final_turn = body.turn_number >= 3

    if body.turn_number == 0:
        task = (
            "The candidate just gave their initial answer. React to what they actually said. "
            "Find the weakest STAR component (situation, task, action, or result) and probe it with one sharp question. "
            "If the result has no metrics, ask for them. If actions are vague, ask what THEY specifically did."
        )
    elif is_final_turn:
        task = (
            "This is the last follow-up. If the conversation is complete, wrap up in one sentence. "
            "If there's one critical gap still missing, ask about it — then that's it."
        )
    else:
        task = (
            f"This is follow-up turn {body.turn_number + 1}. React to their most recent response. "
            "Ask the single most important question based on what they just said. "
            "Focus on what's still missing: specifics, metrics, individual contribution, or actual outcome."
        )

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        system=f"{persona_prompt}\n\n{RESPONSE_RULES}",
        messages=[{
            "role": "user",
            "content": (
                f"Interview question: {body.question}\n\n"
                f"Conversation so far:\n{conversation}\n\n"
                f"Latest candidate response: {body.transcript_so_far}\n\n"
                f"Task: {task}\n\n"
                "Generate your next interviewer response:"
            ),
        }],
    )

    text = message.content[0].text.strip()

    wrap_up_signals = [
        "i think i have what i need", "that's everything", "we're done here",
        "that covers it", "good, i have enough", "that's all i need",
    ]
    is_done = is_final_turn or any(s in text.lower() for s in wrap_up_signals)

    return {
        "message": text,
        "is_done": is_done,
        "turn_number": body.turn_number,
    }
