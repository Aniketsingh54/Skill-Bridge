from app.ingestion.base import AbstractIngestor


class RawTextIngestor(AbstractIngestor):
    def ingest(self, source: str, file_bytes: bytes | None = None) -> str:
        # Collapse repeated whitespace so pasted resumes and job posts become consistent.
        return " ".join(source.split()).strip()
