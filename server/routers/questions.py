import json
import pathlib
from typing import Optional

from fastapi import APIRouter, Query

router = APIRouter(prefix="/questions", tags=["questions"])

DATA_FILE = pathlib.Path(__file__).parent.parent / "data" / "questions.json"


@router.get("")
def get_questions(
    category: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None),
):
    questions = json.loads(DATA_FILE.read_text())
    if type:
        questions = [q for q in questions if q.get("type") == type]
    if category:
        questions = [q for q in questions if q["category"] == category]
    return questions
