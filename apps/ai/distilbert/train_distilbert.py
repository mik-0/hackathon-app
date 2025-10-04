import pandas as pd
import numpy as np
import re
import random
from sklearn.model_selection import train_test_split
from transformers import (
    DistilBertTokenizer,
    DistilBertForSequenceClassification,
    Trainer,
    TrainingArguments
)
import torch
from torch.utils.data import Dataset

# Set random seeds for reproducibility
random.seed(42)
np.random.seed(42)
torch.manual_seed(42)

class HateSpeechDataset(Dataset):
    """Custom Dataset for hate speech classification"""
    def __init__(self, texts, labels, tokenizer, max_length=128):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = str(self.texts[idx])
        label = self.labels[idx]

        encoding = self.tokenizer(
            text,
            add_special_tokens=True,
            max_length=self.max_length,
            padding='max_length',
            truncation=True,
            return_attention_mask=True,
            return_tensors='pt'
        )

        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(label, dtype=torch.long)
        }

def clean_tweet(text):
    """Clean tweet text by removing usernames, hashtags, URLs, and extra spaces"""
    # Remove URLs
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
    # Remove @usernames
    text = re.sub(r'@\w+', '', text)
    # Remove hashtags but keep the text
    text = re.sub(r'#', '', text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def add_random_line_numbers(text):
    """Add random line numbers to text to train model to ignore them"""
    # Randomly decide whether to add line numbers (50% chance)
    if random.random() < 0.5:
        line_num = random.randint(1, 9999)
        return f"<{line_num}>{text}<{line_num}>"
    return text

def prepare_data(csv_path):
    """Load and prepare the dataset"""
    print("Loading dataset...")
    df = pd.read_csv(csv_path)

    # The dataset has columns: class, tweet
    # class: 0 - hate speech, 1 - offensive language, 2 - neither
    print(f"Original dataset size: {len(df)}")
    print(f"Class distribution:\n{df['class'].value_counts()}")

    # Clean tweets
    print("\nCleaning tweets...")
    df['cleaned_tweet'] = df['tweet'].apply(clean_tweet)

    # Remove empty tweets after cleaning
    df = df[df['cleaned_tweet'].str.len() > 0]
    print(f"Dataset size after cleaning: {len(df)}")

    # Add random line numbers for training
    print("Adding random line numbers to training data...")
    df['processed_tweet'] = df['cleaned_tweet'].apply(add_random_line_numbers)

    return df

def train_model(df, output_dir='./hate_speech_model'):
    """Train DistilBERT model"""
    print("\nPreparing for training...")

    # Split data
    train_texts, val_texts, train_labels, val_labels = train_test_split(
        df['processed_tweet'].tolist(),
        df['class'].tolist(),
        test_size=0.2,
        random_state=42,
        stratify=df['class']
    )

    print(f"Training samples: {len(train_texts)}")
    print(f"Validation samples: {len(val_texts)}")

    # Initialize tokenizer and model
    print("\nInitializing DistilBERT...")
    tokenizer = DistilBertTokenizer.from_pretrained('distilbert-base-uncased')
    model = DistilBertForSequenceClassification.from_pretrained(
        'distilbert-base-uncased',
        num_labels=3  # 0: hate speech, 1: offensive, 2: neither
    )

    # Create datasets
    train_dataset = HateSpeechDataset(train_texts, train_labels, tokenizer)
    val_dataset = HateSpeechDataset(val_texts, val_labels, tokenizer)

    # Training arguments
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=3,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=32,
        warmup_steps=500,
        weight_decay=0.01,
        logging_dir='./logs',
        logging_steps=100,
        eval_strategy='epoch',
        save_strategy='epoch',
        load_best_model_at_end=True,
        metric_for_best_model='eval_loss',
        save_total_limit=2,
    )

    # Initialize Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
    )

    # Train
    print("\nStarting training...")
    trainer.train()

    # Save model and tokenizer
    print(f"\nSaving model to {output_dir}...")
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)

    print("Training completed!")

    return model, tokenizer

if __name__ == "__main__":
    # Path to your downloaded CSV file
    csv_path = "hate_speech_offensive.csv"  # Update this path

    # Prepare data
    df = prepare_data(csv_path)

    # Train model
    model, tokenizer = train_model(df)

    print("\n" + "="*50)
    print("Model training complete!")
    print("Model saved to: ./hate_speech_model")
    print("="*50)
