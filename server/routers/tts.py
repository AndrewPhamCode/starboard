from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from openai import OpenAI
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text: str


@router.post("")
async def text_to_speech(body: TTSRequest):
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.audio.speech.create(
        model="tts-1",
        voice="onyx",
        input=body.text[:4096],
    )
    return Response(content=response.content, media_type="audio/mpeg")
