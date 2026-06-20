from fastapi import APIRouter, File, HTTPException, UploadFile
from openai import OpenAI

from app.config import settings

router = APIRouter(prefix="/transcribe", tags=["transcribe"])


@router.post("")
async def transcribe(audio: UploadFile = File(...)):
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    client = OpenAI(api_key=settings.openai_api_key)
    content = await audio.read()
    result = client.audio.transcriptions.create(
        model="whisper-1",
        file=(audio.filename or "audio.webm", content, audio.content_type or "audio/webm"),
    )
    return {"transcript": result.text}
