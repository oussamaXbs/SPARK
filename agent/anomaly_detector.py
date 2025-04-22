import os
import sys
import logging
from transformers import BertTokenizer, BertForSequenceClassification
import torch

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AnomalyDetector:
    def __init__(self, model_path=None):
        try:
            # Determine the correct model path
            if model_path is None:
                if getattr(sys, 'frozen', False):
                    # Running in PyInstaller bundle
                    base_path = sys._MEIPASS
                else:
                    # Running in normal Python
                    base_path = os.path.dirname(__file__)
                model_path = os.path.join(base_path, "bert_anomaly_detection")
            
            logger.info(f"Loading model from: {model_path}")
            
            # Verify model files exist
            required_files = [
                'config.json',
                'model.safetensors',
                'tokenizer_config.json',
                'vocab.txt'
            ]
            
            for file in required_files:
                if not os.path.exists(os.path.join(model_path, file)):
                    raise FileNotFoundError(f"Missing model file: {file}")
            
            # Load model and tokenizer
            self.tokenizer = BertTokenizer.from_pretrained(model_path)
            self.model = BertForSequenceClassification.from_pretrained(model_path)
            self.model.eval()
            
            logger.info("Model loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading BERT model: {str(e)}")
            raise

    def detect_single_event(self, log_message):
        try:
            inputs = self.tokenizer(
                log_message,
                return_tensors="pt",
                truncation=True,
                padding=True,
                max_length=128
            )
            
            with torch.no_grad():
                outputs = self.model(**inputs)
                probabilities = torch.softmax(outputs.logits, dim=1)
                anomaly_score = probabilities[0][1].item()
            
            return anomaly_score > 0.5, anomaly_score
            
        except Exception as e:
            logger.error(f"Detection error: {str(e)}")
            return False, 0.0