from openai import AsyncOpenAI
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text: str


@router.post("")
async def text_to_speech(body: TTSRequest):
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    oai = AsyncOpenAI(api_key=settings.openai_api_key)

    async def generate():
        async with oai.audio.speech.with_streaming_response.create(
            model="tts-1",
            voice="onyx",
            input=body.text[:4096],
        ) as response:
            async for chunk in response.iter_bytes(1024):
                yield chunk

    return StreamingResponse(generate(), media_type="audio/mpeg")
