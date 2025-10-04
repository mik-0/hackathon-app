"""FastAPI application for AI services"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import transcription_router
from services import TranscriptionService

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="AI Services API",
    description="Modular AI services including transcription, classification, and more",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
transcription_service = TranscriptionService()


@app.on_event("startup")
async def startup_event():
    """Initialize models on startup"""
    # Get configuration from environment variables
    model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
    device = os.getenv("WHISPER_DEVICE", "cpu")
    compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

    print(f"Initializing Whisper model: {model_size} on {device}")
    transcription_service.initialize_whisper(
        model_size=model_size, device=device, compute_type=compute_type
    )
    print("All services initialized!")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    if transcription_service.whisper_model:
        transcription_service.whisper_model.unload()


# Root endpoint
@app.get("/")
def read_root():
    return {
        "service": "AI Services API",
        "status": "running",
        "available_endpoints": ["/transcription", "/docs"],
    }


# Include routers
app.include_router(transcription_router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
