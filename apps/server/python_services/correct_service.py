from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import torch
import torch.nn as nn
from transformers import BertTokenizer, BertPreTrainedModel, BertModel
import re

app = FastAPI(title="Hate Speech Analysis Service (Binary)")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom model architecture for HateXplain
class BertPooler(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.dense = nn.Linear(config.hidden_size, config.hidden_size)
        self.activation = nn.Tanh()

    def forward(self, hidden_states):
        first_token_tensor = hidden_states[:, 0]
        pooled_output = self.dense(first_token_tensor)
        pooled_output = self.activation(pooled_output)
        return pooled_output

class Model_Rational_Label(BertPreTrainedModel):
    def __init__(self, config):
        super().__init__(config)
        self.num_labels = 2
        self.impact_factor = 0.8
        self.bert = BertModel(config, add_pooling_layer=False)
        self.bert_pooler = BertPooler(config)
        self.token_dropout = nn.Dropout(0.1)
        self.token_classifier = nn.Linear(config.hidden_size, 2)
        self.dropout = nn.Dropout(0.1)
        self.classifier = nn.Linear(config.hidden_size, self.num_labels)
        self.init_weights()

    def forward(self, input_ids=None, attention_mask=None, token_type_ids=None, attn=None, labels=None):
        outputs = self.bert(input_ids, attention_mask)
        out = outputs[0]
        logits = self.token_classifier(self.token_dropout(out))
        embed = self.bert_pooler(outputs[0])
        y_pred = self.classifier(self.dropout(embed))

        loss_token = None
        loss_label = None
        loss_total = None

        if attn is not None:
            loss_fct = nn.CrossEntropyLoss()
            if attention_mask is not None:
                active_loss = attention_mask.view(-1) == 1
                active_logits = logits.view(-1, 2)
                active_labels = torch.where(
                    active_loss, attn.view(-1), torch.tensor(loss_fct.ignore_index).type_as(attn)
                )
                loss_token = loss_fct(active_logits, active_labels)
            else:
                loss_token = loss_fct(logits.view(-1, 2), attn.view(-1))
            loss_total = self.impact_factor * loss_token

        if labels is not None:
            loss_funct = nn.CrossEntropyLoss()
            loss_logits = loss_funct(y_pred.view(-1, self.num_labels), labels.view(-1))
            loss_label = loss_logits
            if loss_total is not None:
                loss_total += loss_label
            else:
                loss_total = loss_label

        if loss_total is not None:
            return y_pred, logits, loss_total
        else:
            return y_pred, logits

class HateSpeechClassifier:
    """Binary classifier for detecting hate speech (NORMAL vs ABUSIVE)"""

    def __init__(self, model_path='Hate-speech-CNERG/bert-base-uncased-hatexplain-rationale-two'):
        """Initialize the binary classifier"""
        import os
        
        # Check if model exists locally
        local_path = './hate_speech_model_binary'
        
        if os.path.exists(local_path):
            print(f"Loading binary model from local path: {local_path}")
            load_path = local_path
        else:
            print(f"Downloading binary model from HuggingFace: {model_path}")
            print("This may take a few minutes on first run...")
            load_path = model_path

        self.tokenizer = BertTokenizer.from_pretrained(load_path)
        self.model = Model_Rational_Label.from_pretrained(load_path)
        
        # Save locally for future use if downloaded from HF
        if load_path == model_path:
            print(f"Saving model locally to {local_path} for faster future loading...")
            self.tokenizer.save_pretrained(local_path)
            self.model.save_pretrained(local_path)
            print(f"Model saved to {local_path}")
        
        self.model.eval()

        # Binary labels: 0 = NORMAL, 1 = ABUSIVE
        self.labels = {
            0: "NORMAL",
            1: "ABUSIVE"
        }

        print("Binary model loaded successfully!")

    def classify_text(self, text):
        """Classify a single text segment"""
        inputs = self.tokenizer(
            text,
            add_special_tokens=True,
            max_length=128,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )

        with torch.no_grad():
            y_pred, token_logits = self.model(
                input_ids=inputs['input_ids'],
                attention_mask=inputs['attention_mask']
            )

            probabilities = torch.softmax(y_pred, dim=1)
            predicted_class = torch.argmax(probabilities, dim=1).item()
            confidence = probabilities[0][predicted_class].item()

        return {
            'class_type': self.labels.get(predicted_class, f"CLASS_{predicted_class}"),
            'class_id': predicted_class,
            'confidence': float(confidence),
            'is_abusive': predicted_class == 1  # True if ABUSIVE
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
print("Initializing Binary Hate Speech Classifier...")
classifier = HateSpeechClassifier()

@app.post("/analyze", response_model=List[AnalysisResult])
async def analyze(request: AnalysisRequest):
    """
    Analyze text segments for hate speech using binary classification (NORMAL vs ABUSIVE)
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
        "model": "binary",
        "classes": ["NORMAL", "ABUSIVE"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)