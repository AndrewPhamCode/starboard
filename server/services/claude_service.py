import json
from typing import Optional

import anthropic
from fastapi import HTTPException

from app.config import settings


def score_star_response(
    question: str,
    transcript: str,
    follow_up_question: Optional[str] = None,
    follow_up_transcript: Optional[str] = None,
) -> dict:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    has_follow_up = bool(follow_up_question and follow_up_transcript)

    system = """You are a senior interview coach evaluating STAR method responses.
Score each dimension using these exact anchors:

SITUATION — Context clarity
1: No context at all  2: Vague ("at my last job"), no specifics  3: Basic context but missing timeframe, stakes, or scope
4: Clear context with team size, timeline, and business stakes  5: Vivid, specific setup — stakes immediately obvious and relevant

TASK — Personal ownership
1: No personal responsibility stated  2: Generic title only ("I was the lead"), no challenge  3: Role stated but challenge is vague ("I needed to fix it")
4: Clear personal ownership with defined scope and why it was their problem  5: Precise ownership + explicit constraints (deadline, resources, competing priorities)

ACTION — Individual steps (most important — weight ~40% of overall assessment)
1: Absent or reduced to "I solved it"  2: "We did X", passive voice, no individual agency  3: Steps named but decisions unexplained
4: Concrete sequential steps with reasoning; uses "I"; explains why each decision  5: Specific tools/techniques, tradeoffs considered, obstacles named and overcome

RESULT — Measurable outcome
1: No outcome stated  2: Vague ("it went well", "everyone was happy")  3: Outcome stated but no metrics
4: Quantified result: %, time saved, $ amount, user count, or concrete KPI  5: Quantified + broader impact (org/team/product level) + lesson learned

CONFIDENCE — How assertive and direct the speaker sounds
1: Heavy hedging throughout ("I think", "maybe", "I'm not sure", "sort of"), passive constructions, self-undermining
2: Frequent hedges, avoids committing to statements
3: Mostly direct but hedges on key claims
4: Confident declarative sentences, owns their decisions
5: Fully direct, owns every statement, no unnecessary qualifiers

FLOW — Structure and coherence of the spoken answer
1: Disjointed, jumps between topics, restarts mid-sentence, hard to follow
2: Loose structure, some tangents
3: Adequate structure but transitions are abrupt
4: Clear narrative arc, smooth transitions, easy to follow
5: Perfectly structured, each part logically leads to the next, interviewer never has to re-orient

FOLLOW-UP HANDLING (only score if a follow-up question and answer are provided)
1: Ignored the follow-up entirely or gave the same answer
2: Acknowledged it but gave a vague non-answer
3: Partially addressed it but missed the core probe
4: Directly addressed the probe with a specific new detail
5: Fully answered the follow-up AND connected it back to the original answer with new evidence

Return only valid JSON — no markdown fences, no extra text."""

    follow_up_section = ""
    if has_follow_up:
        follow_up_section = f"""

Follow-up question: {follow_up_question}

Candidate's follow-up answer: {follow_up_transcript}"""

    follow_up_json = '"follow_up_handling": <1-5>,' if has_follow_up else '"follow_up_handling": null,'

    user = f"""Question: {question}

Candidate answer: {transcript}{follow_up_section}

Score each dimension using the anchors above.
Return exactly this JSON structure:
{{
  "situation": <1-5>,
  "task": <1-5>,
  "action": <1-5>,
  "result": <1-5>,
  {follow_up_json}
  "confidence": <1-5>,
  "flow": <1-5>,
  "feedback": "<2-3 sentence coaching note covering STAR gaps AND delivery — mention specific filler words, pacing, or confidence issues if present>",
  "rewrite": {{
    "situation": "<1-2 sentences: a strong model Situation — the context and background>",
    "task": "<1-2 sentences: a strong model Task — your specific responsibility or challenge>",
    "action": "<2-3 sentences: a strong model Action — concrete steps you took>",
    "result": "<1-2 sentences: a strong model Result — measurable outcome and impact. Use LaTeX notation wrapped in $ for any math expressions, e.g. $O(n^2)$, $3\\times$ improvement>"
  }}
}}"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=system,
        messages=[{"role": "user", "content": user}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown code fences if Claude wraps the JSON despite being told not to
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        raw = raw.rsplit("```", 1)[0].strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Failed to parse Claude response: {raw[:200]}")
