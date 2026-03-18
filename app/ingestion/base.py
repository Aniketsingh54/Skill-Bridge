from abc import ABC, abstractmethod
from typing import Optional


class AbstractIngestor(ABC):
    @abstractmethod
    def ingest(self, source: str, file_bytes: Optional[bytes] = None) -> str:
        """Convert an incoming source into normalized text."""
