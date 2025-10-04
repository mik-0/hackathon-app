"""Faster Whisper model for audio transcription"""

import os
from typing import Dict, List, Any, Optional
from faster_whisper import WhisperModel
from .base import BaseModel


class WhisperTranscriber(BaseModel):
    """Whisper model for audio transcription using faster-whisper"""

    def __init__(
        self,
        model_size: str = "medium.en",
        device: str = "cpu",
        compute_type: str = "int8",
    ):
        super().__init__(model_size, device)
        self.compute_type = compute_type
        self.model: Optional[WhisperModel] = None

    def load(self):
        """Load the Whisper model"""
        if self.model is None:
            print(f"Loading Whisper model: {self.model_size} on {self.device}")
            self.model = WhisperModel(
                self.model_size, device=self.device, compute_type=self.compute_type
            )
            print("Model loaded successfully")

    def transcribe(
        self,
        audio_path: str,
        beam_size: int = 5,
        language: Optional[str] = None,
        word_timestamps: bool = True,
    ) -> Dict[str, Any]:
        """
        Transcribe audio file to text with timestamps

        Args:
            audio_path: Path to the audio file
            beam_size: Beam size for decoding
            language: Optional language code (e.g., 'en', 'es')
            word_timestamps: Whether to include word-level timestamps

        Returns:
            Dictionary containing transcription results
        """
        if self.model is None:
            self.load()

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Transcribe the audio
        segments, info = self.model.transcribe(
            audio_path,
            beam_size=beam_size,
            language=language,
            word_timestamps=word_timestamps,
        )

        # Convert segments to list of dictionaries
        transcription_segments = []
        for segment in segments:
            segment_data = {
                "start": segment.start,
                "end": segment.end,
                "text": segment.text,
            }

            # Add word timestamps if available
            if word_timestamps and hasattr(segment, "words"):
                segment_data["words"] = [
                    {"start": word.start, "end": word.end, "word": word.word}
                    for word in segment.words
                ]

            transcription_segments.append(segment_data)

        return {
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
            "segments": transcription_segments,
        }

    def predict(self, input_data: str) -> Dict[str, Any]:
        """
        Make predictions (alias for transcribe)

        Args:
            input_data: Path to audio file

        Returns:
            Transcription results
        """
        return self.transcribe(input_data)

    def unload(self):
        """Unload the model from memory"""
        if self.model is not None:
            del self.model
            self.model = None
            print("Model unloaded")

