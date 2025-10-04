import re
import sys
import torch
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification

class HateSpeechClassifier:
    """Classifier for detecting hate speech and offensive language"""

    def __init__(self, model_path='./hate_speech_model'):
        """Initialize the classifier with trained model"""
        print(f"Loading model from {model_path}...")
        self.tokenizer = DistilBertTokenizer.from_pretrained(model_path)
        self.model = DistilBertForSequenceClassification.from_pretrained(model_path)
        self.model.eval()

        # Class labels
        self.labels = {
            0: "HATE_SPEECH",
            1: "OFFENSIVE",
            2: "NEITHER"
        }

        print("Model loaded successfully!")

    def split_into_sentences(self, text):
        """Split text into sentences"""
        # Simple sentence splitting on common sentence endings
        sentences = re.split(r'(?<=[.!?])\s+', text)
        # Filter out empty sentences
        sentences = [s.strip() for s in sentences if s.strip()]
        return sentences

    def add_line_numbers(self, sentences):
        """Add line numbers to sentences"""
        numbered_sentences = []
        for i, sentence in enumerate(sentences, 1):
            numbered_sentence = f"<{i}>{sentence}<{i}>"
            numbered_sentences.append(numbered_sentence)
        return numbered_sentences

    def classify_sentence(self, sentence):
        """Classify a single sentence"""
        # Tokenize
        inputs = self.tokenizer(
            sentence,
            add_special_tokens=True,
            max_length=128,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )

        # Get prediction
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

    def process_text(self, text):
        """Process text block: split into sentences, add line numbers, and classify"""
        # Split into sentences
        sentences = self.split_into_sentences(text)

        if not sentences:
            print("No sentences found in the text.")
            return []

        print(f"\nProcessing {len(sentences)} sentence(s)...\n")

        # Add line numbers
        numbered_sentences = self.add_line_numbers(sentences)

        # Classify each sentence
        results = []
        for i, (original, numbered) in enumerate(zip(sentences, numbered_sentences), 1):
            result = self.classify_sentence(numbered)
            result['line_number'] = i
            result['sentence'] = original
            results.append(result)

            # Print result
            print(f"Line {i}: [{result['class']}] (confidence: {result['confidence']:.3f})")
            print(f"  Text: {original}")
            print()

        return results

def read_multiline_input():
    """Read multiline input from terminal until EOF (Ctrl+D on Unix, Ctrl+Z on Windows)"""
    print("Enter text (press Ctrl+D on Unix/Mac or Ctrl+Z then Enter on Windows when done):")
    print("-" * 60)
    lines = []
    try:
        while True:
            line = input()
            lines.append(line)
    except EOFError:
        pass
    return '\n'.join(lines)

def main():
    """Main function to run inference"""
    # Initialize classifier
    classifier = HateSpeechClassifier()

    # Check if text is provided as command line argument
    if len(sys.argv) > 1:
        # Text provided as command line argument
        text = ' '.join(sys.argv[1:])
    else:
        # Read from terminal
        text = read_multiline_input()

    if not text.strip():
        print("No text provided!")
        return

    # Process text
    print("\n" + "=" * 60)
    print("CLASSIFICATION RESULTS")
    print("=" * 60)

    results = classifier.process_text(text)

    # Summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    class_counts = {}
    for result in results:
        class_name = result['class']
        class_counts[class_name] = class_counts.get(class_name, 0) + 1

    for class_name, count in class_counts.items():
        print(f"{class_name}: {count} sentence(s)")

    # Check for concerning content
    concerning = [r for r in results if r['class_id'] in [0, 1]]
    if concerning:
        print(f"\n⚠️  Found {len(concerning)} concerning sentence(s)")
        for r in concerning:
            print(f"  - Line {r['line_number']}: {r['class']}")
    else:
        print("\n✓ No concerning content detected")

if __name__ == "__main__":
    main()
