from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from typing import List
import re

app = FastAPI()

class SegmentInput(BaseModel):
    text: str
    start: float
    end: float

class AnalysisRequest(BaseModel):
    segments: List[SegmentInput]

class SegmentResult(BaseModel):
    start: float
    end: float
    text: str
    isExtremist: bool
    class_type: str
    confidence: float

class HateSpeechClassifier:
    def __init__(self, model_path='./hate_speech_model'):
        print(f"Loading model from {model_path}...")
        self.tokenizer = DistilBertTokenizer.from_pretrained(model_path)
        self.model = DistilBertForSequenceClassification.from_pretrained(model_path)
        self.model.eval()
        
        self.labels = {
            0: "HATE_SPEECH",
            1: "OFFENSIVE",
            2: "NEITHER"
        }
        print("Model loaded successfully!")

    def classify_text(self, text):
        inputs = self.tokenizer(
            text,
            add_special_tokens=True,
            max_length=128,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )

        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits
            probabilities = torch.softmax(logits, dim=1)
            predicted_class = torch.argmax(probabilities, dim=1).item()
            confidence = probabilities[0][predicted_class].item()

        return {
            'class': self.labels[predicted_class],
            'class_id': predicted_class,
            'confidence': confidence
        }

# Initialize classifier once at startup
classifier = HateSpeechClassifier()

@app.post("/analyze", response_model=List[SegmentResult])
async def analyze_segments(request: AnalysisRequest):
    results = []
    
    for segment in request.segments:
        classification = classifier.classify_text(segment.text)
        
        # Mark as extremist if HATE_SPEECH (0) or OFFENSIVE (1)
        is_extremist = classification['class_id'] in [0, 1]
        
        results.append(SegmentResult(
            start=segment.start,
            end=segment.end,
            text=segment.text,
            isExtremist=is_extremist,
            class_type=classification['class'],
            confidence=classification['confidence']
        ))
    
    return results

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)