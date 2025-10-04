"""Transcription API endpoints"""

import os
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/transcription", tags=["transcription"])


# Response models
class WordTimestamp(BaseModel):
    start: float
    end: float
    word: str


class TranscriptionSegment(BaseModel):
    start: float
    end: float
    text: str
    words: Optional[List[WordTimestamp]] = None


class TranscriptionResponse(BaseModel):
    language: str
    language_probability: float
    duration: float
    segments: List[TranscriptionSegment]


@router.post("/upload", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    beam_size: int = Query(5, description="Beam size for decoding"),
    language: Optional[str] = Query(None, description="Language code (e.g., 'en')"),
    word_timestamps: bool = Query(True, description="Include word-level timestamps"),
):
    """
    Upload an audio file and get transcription with timestamps

    Args:
        file: Audio file to transcribe
        beam_size: Beam size for decoding (default: 5)
        language: Optional language code
        word_timestamps: Include word-level timestamps (default: True)

    Returns:
        Transcription results with segments and timestamps
    """
    # Import here to access the app state
    from main import transcription_service

    if not file.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=400, detail="Invalid file type. Please upload an audio file."
        )

    # Save uploaded file temporarily
    file_path = os.path.join(
        transcription_service.temp_upload_dir, file.filename
    )

    try:
        # Save the file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # Transcribe
        result = await transcription_service.transcribe_audio(
            audio_path=file_path,
            beam_size=beam_size,
            language=language,
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    # finally:
    #     # Cleanup temp file
    #     transcription_service.cleanup_temp_file(file_path)


@router.get("/health")
async def health_check():
    """Check if transcription service is ready"""
    from main import transcription_service

    is_ready = transcription_service.whisper_model is not None
    return {"status": "ready" if is_ready else "not_initialized", "service": "whisper"}

