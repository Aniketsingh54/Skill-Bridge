from abc import ABC, abstractmethod


class AbstractProfileParser(ABC):
    @abstractmethod
    def parse(self, text: str) -> str:
        """Normalize incoming profile or job text."""
