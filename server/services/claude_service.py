import json
from typing import Optional

import anthropic
from fastapi import HTTPException

from app.config import settings


def analyze_github_repo(
    repo_url: str,
    repo_name: str,
    description: str,
    languages: dict,
    readme: str,
) -> dict:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    lang_summary = ", ".join(list(languages.keys())[:8]) if languages else "unknown"
    readme_excerpt = readme[:3000] if readme else "(no README available)"

    prompt = f"""You are a senior software engineer helping a candidate prepare to explain their GitHub project in a technical interview.

Analyze this repository and return JSON with exactly these three fields. Be concise.

1. "architecture_summary": 2 short paragraphs. Cover: what the project does, key technology choices, and the main data flow.

2. "mermaid_diagram": A valid Mermaid flowchart (`flowchart TD`) with 5-8 nodes showing the system components. Use very short node labels (2-4 words max). Example format: flowchart TD\\n  A[User] --> B[React Frontend]\\n  B --> C[FastAPI Backend]

3. "talking_points": An array of exactly 5 strings. Each is one specific thing the candidate should explain in an interview.

Repository: {repo_url}
Name: {repo_name}
Description: {description or '(none provided)'}
Languages: {lang_summary}
README (excerpt):
{readme_excerpt}

Return only valid JSON — no markdown fences, no extra text."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        raw = raw.rsplit("```", 1)[0].strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Failed to parse Claude response: {raw[:200]}")


def score_system_design_response(question: str, transcript: str) -> dict:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    system = """You are a senior staff engineer evaluating a system design interview answer.
Score each dimension 1-5 using these anchors:

CLARIFICATION — Did they define scope, users, scale, and constraints before designing?
1: Dove straight into a solution with no clarifying questions  3: Asked one or two questions but missed key constraints  5: Systematically clarified: users, scale, SLAs, read/write ratio, data size

DESIGN — Did they identify the right high-level components?
1: No components named or wrong components for the problem  3: Key components identified but architecture is vague or incomplete  5: Clean component diagram in words: load balancer, services, databases, queues, cache — each justified

DEEP_DIVE — Did they explain at least one component in real depth?
1: Everything stayed high-level  3: Some depth on one component but gaps in reasoning  5: Drilled into a specific component — API contract, data model, failure modes, implementation choice

TRADEOFFS — Were explicit trade-offs discussed?
1: No trade-offs mentioned  3: One trade-off named but not analyzed  5: Multiple trade-offs explicitly compared (SQL vs NoSQL, sync vs async, strong vs eventual consistency) with reasoning for the choice

SCALE — Did they address how the system grows?
1: No mention of scale  3: Named a scaling technique but didn't tie it to the problem  5: Concrete scale plan: horizontal sharding, read replicas, CDN, caching layer, queue for async work — driven by the stated load requirements

COMMUNICATION — Was the answer structured and easy to follow?
1: Disorganized, repeated themselves, hard to follow  3: Mostly clear but jumped between topics  5: Walked through the design in a logical order, used precise vocabulary, easy to follow

Return only valid JSON — no markdown fences, no extra text."""

    user = f"""System design question: {question}

Candidate's answer: {transcript}

Return exactly this JSON:
{{
  "clarification": <1-5>,
  "design": <1-5>,
  "deep_dive": <1-5>,
  "tradeoffs": <1-5>,
  "scale": <1-5>,
  "communication": <1-5>,
  "feedback": "<2-3 sentence coaching note: what was strong, what was missing, one concrete improvement>",
  "model_answer": "<3-4 sentences: a strong model answer hitting all 6 dimensions for this specific question>"
}}"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": user}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        raw = raw.rsplit("```", 1)[0].strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Failed to parse Claude response: {raw[:200]}")


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
