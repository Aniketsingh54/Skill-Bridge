import os

from dotenv import load_dotenv

from app.roadmap_generator.ai_models.base import AbstractAIModel

load_dotenv()


class GeminiModel(AbstractAIModel):
    def __init__(self) -> None:
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model = os.getenv("GEMINI_MODEL")

    def generate_text(self, prompt: str) -> str:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not set.")
        if not self.model:
            raise ValueError("GEMINI_MODEL is not set.")

        try:
            from google import genai
        except ImportError as error:
            raise ValueError("The google-genai package is not installed.") from error

        client = genai.Client(api_key=self.api_key)
        response = client.models.generate_content(
            model=self.model,
            contents=prompt,
        )
        return response.text
