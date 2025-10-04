"""Base model class for all AI models"""

from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseModel(ABC):
    """Abstract base class for AI models"""

    def __init__(self, model_size: str = "medium", device: str = "cpu"):
        self.model_size = model_size
        self.device = device
        self.model = None

    @abstractmethod
    def load(self):
        """Load the model"""
        pass

    @abstractmethod
    def predict(self, input_data: Any) -> Dict[str, Any]:
        """Make predictions with the model"""
        pass

    @abstractmethod
    def unload(self):
        """Unload the model from memory"""
        pass

