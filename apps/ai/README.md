# AI Services 🤖

Modular AI services API built with FastAPI and faster-whisper.

## Features

- 🎤 **Audio Transcription** - Using faster-whisper for accurate transcription with timestamps
- 🧩 **Modular Architecture** - Easy to add new models and services
- 🚀 **Fast API** - Built with FastAPI for high performance
- 📊 **Word-level Timestamps** - Get precise timing for each word

## Setup

1. **Create virtual environment** (if not exists):

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install dependencies**:

```bash
pip install -r requirements.txt
```

3. **Configure environment** (optional):

```bash
cp .env.example .env
# Edit .env to configure model settings
```

4. **Run the server**:

```bash
python main.py
# or
uvicorn main:app --reload --port 8001
```

## API Documentation

Once running, visit:

- **API Docs**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc

## Configuration

Configure the Whisper model via environment variables:

- `WHISPER_MODEL_SIZE`: `tiny`, `base`, `small`, `medium`, `large-v3`
- `WHISPER_DEVICE`: `cpu` or `cuda` (for GPU)
- `WHISPER_COMPUTE_TYPE`:
  - CPU: `int8`, `float32`
  - GPU: `float16`, `int8_float16`

### GPU Setup (CUDA)

For GPU acceleration:

```bash
WHISPER_MODEL_SIZE=large-v3
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
```

## API Endpoints

### Transcription

**POST** `/transcription/upload`

- Upload audio file for transcription
- Query params:
  - `beam_size`: Beam size for decoding (default: 5)
  - `language`: Language code (e.g., 'en', 'es')
  - `word_timestamps`: Include word-level timestamps (default: true)

**GET** `/transcription/health`

- Check if transcription service is ready

## Architecture

```
apps/ai/
├── main.py                 # FastAPI application
├── models/                 # AI Models
│   ├── base.py            # Base model class
│   └── whisper_model.py   # Whisper implementation
├── services/              # Business logic
│   └── transcription_service.py
├── routers/               # API endpoints
│   └── transcription.py
└── requirements.txt       # Python dependencies
```

## Adding New Models

1. Create a new model class in `models/` inheriting from `BaseModel`
2. Create a service in `services/`
3. Add API endpoints in `routers/`
4. Include router in `main.py`

Example:

```python
# models/sentiment_model.py
from .base import BaseModel

class SentimentAnalyzer(BaseModel):
    def load(self):
        # Load your model
        pass

    def predict(self, text):
        # Run inference
        pass
```

## Example Usage

### cURL

```bash
curl -X POST "http://localhost:8001/transcription/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@audio.mp3" \
  -F "beam_size=5" \
  -F "word_timestamps=true"
```

### Python

```python
import requests

with open("audio.mp3", "rb") as f:
    response = requests.post(
        "http://localhost:8001/transcription/upload",
        files={"file": f},
        params={"beam_size": 5, "word_timestamps": True}
    )

result = response.json()
print(f"Language: {result['language']}")
for segment in result['segments']:
    print(f"[{segment['start']:.2f}s -> {segment['end']:.2f}s] {segment['text']}")
```
