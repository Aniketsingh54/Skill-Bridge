from abc import ABC, abstractmethod


class AbstractProfileParser(ABC):
    @abstractmethod
    def parse(self, text: str) -> str:
        """Normalize incoming profile or job text."""


class RawTextParser(AbstractProfileParser):
    def parse(self, text: str) -> str:
        # Collapse repeated whitespace so pasted resumes and job posts become consistent.
        return " ".join(text.split()).strip()
