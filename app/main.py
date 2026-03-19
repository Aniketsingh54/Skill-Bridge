import base64
import binascii
import json
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.ingestion.pdf_resume_ingestor import PDFResumeIngestor
from app.ingestion.raw_text_ingestor import RawTextIngestor
from app.models import AnalyzeResponse, GenerationRequest
from app.roadmap_generator.ai_generation_strategy import AIGenerationStrategy
from app.roadmap_generator.dag_fallback_strategy import DAGFallbackStrategy

BASE_DIR = Path(__file__).resolve().parent.parent
SAMPLE_DATA_PATH = BASE_DIR / "sample_data.json"

# The API surface stays stable while the underlying generation strategy evolves.
app = FastAPI(
    title="Skill-Bridge Career Navigator API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/sample-data")
def get_sample_data() -> Dict[str, object]:
    with SAMPLE_DATA_PATH.open("r", encoding="utf-8") as sample_file:
        return json.load(sample_file)


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_profile(request: GenerationRequest) -> AnalyzeResponse:
    # Component 1 converts varied inputs into normalized text for the roadmap engine.
    ingestors = {
        "raw_text": RawTextIngestor(),
        "pdf_resume": PDFResumeIngestor(),
    }
    source_ingestor = ingestors[request.source_type]
    target_ingestor = RawTextIngestor()
    source_file_bytes = None

    if request.source_type == "pdf_resume":
        if not request.source_file_base64:
            raise HTTPException(
                status_code=400,
                detail="source_file_base64 is required when source_type is pdf_resume.",
            )

        try:
            source_file_bytes = base64.b64decode(request.source_file_base64, validate=True)
        except (binascii.Error, ValueError) as error:
            raise HTTPException(
                status_code=400,
                detail="source_file_base64 must be valid base64-encoded PDF content.",
            ) from error

    try:
        normalized_source_text = source_ingestor.ingest(
            request.source_text,
            file_bytes=source_file_bytes,
        )
        normalized_target_job = target_ingestor.ingest(request.target_job)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    strategy = AIGenerationStrategy()

    try:
        analysis = strategy.generate(
            source_text=normalized_source_text,
            target_job=normalized_target_job,
            time_budget_weeks=request.time_budget_weeks,
        )
    except Exception as error:
        print(f"AI generation failed ({error}) - falling back to DAG strategy.")
        strategy = DAGFallbackStrategy()
        analysis = strategy.generate(
            source_text=normalized_source_text,
            target_job=normalized_target_job,
            time_budget_weeks=request.time_budget_weeks,
        )

    return AnalyzeResponse(
        normalized_source_text=normalized_source_text,
        normalized_target_job=normalized_target_job,
        nodes=analysis["nodes"],
        edges=analysis["edges"],
        ingestor_used=source_ingestor.__class__.__name__,
        strategy_used=strategy.__class__.__name__,
    )
