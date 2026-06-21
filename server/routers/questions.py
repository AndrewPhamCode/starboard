import json
import pathlib
from typing import Optional

from fastapi import APIRouter, Query

router = APIRouter(prefix="/questions", tags=["questions"])

DATA_FILE = pathlib.Path(__file__).parent.parent / "data" / "questions.json"


@router.get("")
def get_questions(
    type: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    difficulty: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
):
    questions = json.loads(DATA_FILE.read_text())
    if type:
        questions = [q for q in questions if q.get("type") == type]
    if category:
        questions = [q for q in questions if q.get("category") == category]
    if difficulty:
        questions = [q for q in questions if q.get("difficulty") == difficulty]
    if role and role != "general":
        questions = [q for q in questions if q.get("role") in (role, "general")]
    return questions
