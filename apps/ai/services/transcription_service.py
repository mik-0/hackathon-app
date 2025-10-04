"""Transcription service for handling audio transcription requests"""

import os
from typing import Optional, Dict, Any
from models.whisper_model import WhisperTranscriber


class TranscriptionService:
    """Service for managing audio transcription"""

    def __init__(self):
        self.whisper_model: Optional[WhisperTranscriber] = None
        self.temp_upload_dir = "temp_uploads"

        # Create temp directory if it doesn't exist
        os.makedirs(self.temp_upload_dir, exist_ok=True)

    def initialize_whisper(
        self, model_size: str = "medium", device: str = "cpu", compute_type: str = "int8"
    ):
        """Initialize the Whisper model"""
        if self.whisper_model is None:
            self.whisper_model = WhisperTranscriber(
                model_size=model_size, device=device, compute_type=compute_type
            )
            self.whisper_model.load()

    async def transcribe_audio(
        self,
        audio_path: str,
        beam_size: int = 5,
        language: Optional[str] = "en",
        word_timestamps: bool = False,
    ) -> Dict[str, Any]:
        """
        Transcribe an audio file

        Args:
            audio_path: Path to the audio file
            beam_size: Beam size for decoding
            language: Optional language code
            word_timestamps: Whether to include word-level timestamps

        Returns:
            Transcription results
        """
        if self.whisper_model is None:
            raise RuntimeError("Whisper model not initialized")

        result = self.whisper_model.transcribe(
            audio_path=audio_path,
            beam_size=beam_size,
            language=language,
            word_timestamps=word_timestamps,
        )

        return result

    def cleanup_temp_file(self, file_path: str):
        """Remove temporary file"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Error cleaning up temp file: {e}")

