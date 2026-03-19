from io import BytesIO
import re
from typing import Optional

from pypdf import PdfReader

from app.ingestion.base import AbstractIngestor


class PDFObjectIngestor(AbstractIngestor):
    def ingest(self, source: str, file_bytes: Optional[bytes] = None) -> str:
        if not file_bytes:
            raise ValueError("A base64-encoded PDF file is required when PDF ingestion is selected.")

        reader = PdfReader(BytesIO(file_bytes))
        extracted_pages = []

        for page in reader.pages:
            extracted_pages.append(page.extract_text() or "")

        extracted_text = "\n".join(extracted_pages).strip()
        if not extracted_text:
            raise ValueError("Could not extract text from the uploaded PDF.")

        cleaned_text = extracted_text.replace("\r", "\n")
        cleaned_text = re.sub(r"\n{2,}", "\n", cleaned_text)
        cleaned_text = re.sub(r"[ \t]+", " ", cleaned_text)

        normalized_lines = []
        for line in cleaned_text.split("\n"):
            stripped_line = line.strip(" -*\t")
            if stripped_line:
                normalized_lines.append(stripped_line)

        # Extracted PDF text is often fragmented, so we flatten it into one
        # consistent string before downstream skill extraction.
        return " | ".join(normalized_lines)
