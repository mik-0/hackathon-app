from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import requests
import json
import re

app = FastAPI(title="Hate Speech Analysis Service (Ollama)")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OllamaClassifier:
    """Classifier for detecting hate speech using Ollama Llama 3.2B"""

    def __init__(self, model_name='llama3.2:3b'):
        """Initialize the Ollama classifier"""
        print(f"Initializing Ollama classifier with model: {model_name}...")
        self.model_name = model_name
        self.ollama_url = "http://localhost:11434/api/generate"
        
        # Test connection to Ollama
        try:
            response = requests.post(
                self.ollama_url,
                json={
                    "model": self.model_name,
                    "prompt": "test",
                    "stream": False
                },
                timeout=10
            )
            if response.status_code == 200:
                print(f"✓ Successfully connected to Ollama with {model_name}")
            else:
                print(f"⚠ Warning: Ollama responded with status {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"⚠ Warning: Could not connect to Ollama: {e}")
            print("Make sure Ollama is running with: ollama serve")
        
        # System prompt for classification
        self.system_prompt = """You are a content moderation AI. Analyze the given text and classify it as either NORMAL or ABUSIVE.

NORMAL: Regular, non-offensive content including casual conversation, questions, statements, jokes without hate, etc.
ABUSIVE: Content containing hate speech, harassment, threats, slurs, discriminatory language, or extreme offensive content.

Respond ONLY in this exact JSON format:
{"class": "NORMAL", "confidence": 0.95, "reasoning": "brief explanation"}
or
{"class": "ABUSIVE", "confidence": 0.87, "reasoning": "brief explanation"}

Be conservative - only mark content as ABUSIVE if it clearly contains hate speech or harassment."""

    def classify_text(self, text):
        """Classify a single text segment using Ollama"""
        
        prompt = f"""{self.system_prompt}

Text to analyze: "{text}"

Classification:"""

        try:
            response = requests.post(
                self.ollama_url,
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,  # Low temperature for consistent classification
                        "num_predict": 150   # Limit response length
                    }
                },
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Ollama API error: {response.status_code}")
            
            result = response.json()
            response_text = result.get('response', '').strip()
            
            # Try to parse JSON response
            try:
                # Extract JSON from response (handle cases where model adds extra text)
                json_match = re.search(r'\{[^}]+\}', response_text)
                if json_match:
                    classification = json.loads(json_match.group())
                else:
                    # Fallback parsing if no JSON found
                    classification = self._fallback_parse(response_text, text)
                
                # Normalize class name
                class_name = classification.get('class', 'NORMAL').upper()
                if class_name not in ['NORMAL', 'ABUSIVE']:
                    class_name = 'NORMAL'
                
                confidence = float(classification.get('confidence', 0.5))
                confidence = max(0.0, min(1.0, confidence))  # Clamp between 0 and 1
                
                return {
                    'class_type': class_name,
                    'class_id': 1 if class_name == 'ABUSIVE' else 0,
                    'confidence': confidence,
                    'is_abusive': class_name == 'ABUSIVE',
                    'reasoning': classification.get('reasoning', '')
                }
                
            except (json.JSONDecodeError, ValueError) as e:
                print(f"Failed to parse Ollama response: {response_text}")
                # Fallback to keyword-based classification
                return self._fallback_parse(response_text, text)
                
        except requests.exceptions.Timeout:
            raise Exception("Ollama request timed out - model may be slow or unavailable")
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to connect to Ollama: {str(e)}")
    
    def _fallback_parse(self, response_text, original_text):
        """Fallback parser if JSON parsing fails"""
        response_lower = response_text.lower()
        
        # Check if response indicates abusive content
        is_abusive = any(word in response_lower for word in ['abusive', 'hate', 'offensive', 'harassment'])
        
        # Simple heuristic confidence based on strength of indicators
        confidence = 0.6 if is_abusive else 0.7
        
        return {
            'class_type': 'ABUSIVE' if is_abusive else 'NORMAL',
            'class_id': 1 if is_abusive else 0,
            'confidence': confidence,
            'is_abusive': is_abusive,
            'reasoning': 'Fallback classification - model response was not in expected format'
        }

# Request/Response models
class TextSegment(BaseModel):
    text: str
    start: float
    end: float

class AnalysisRequest(BaseModel):
    segments: List[TextSegment]

class AnalysisResult(BaseModel):
    start: float
    end: float
    text: str
    is_abusive: bool
    class_type: str
    confidence: float

# Initialize classifier
print("Initializing Ollama Hate Speech Classifier...")
classifier = OllamaClassifier()

@app.post("/analyze", response_model=List[AnalysisResult])
async def analyze(request: AnalysisRequest):
    """
    Analyze text segments for hate speech using Ollama Llama 3.2B
    """
    try:
        results = []
        
        for segment in request.segments:
            classification = classifier.classify_text(segment.text)
            
            result = AnalysisResult(
                start=segment.start,
                end=segment.end,
                text=segment.text,
                is_abusive=classification['is_abusive'],
                class_type=classification['class_type'],
                confidence=classification['confidence']
            )
            results.append(result)
        
        return results
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model": "ollama-llama3.2",
        "classes": ["NORMAL", "ABUSIVE"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)