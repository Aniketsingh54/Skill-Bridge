from abc import ABC, abstractmethod


class AbstractAIModel(ABC):
    @abstractmethod
    def generate_text(self, prompt: str) -> str:
        """Return raw model output text for a prompt."""
