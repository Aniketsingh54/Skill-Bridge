from app.parsers.base import AbstractProfileParser


class RawTextParser(AbstractProfileParser):
    def parse(self, text: str) -> str:
        # Collapse repeated whitespace so pasted resumes and job posts become consistent.
        return " ".join(text.split()).strip()
