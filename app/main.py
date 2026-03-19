import base64
import binascii
import json
import os
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.ingestion.pdf_object_ingestor import PDFObjectIngestor
from app.ingestion.raw_text_ingestor import RawTextIngestor
from app.models import AnalyzeResponse, GenerationRequest
from app.roadmap_generator.ai_generation_strategy import AIGenerationStrategy
from app.roadmap_generator.dag_fallback_strategy import DAGFallbackStrategy

BASE_DIR = Path(__file__).resolve().parent.parent
SAMPLE_DATA_PATH = BASE_DIR / "sample_data.json"


def get_allowed_origins() -> list[str]:
    configured_origins = os.getenv("FRONTEND_ORIGINS", "")
    parsed_origins = [origin.strip() for origin in configured_origins.split(",") if origin.strip()]

    default_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://0.0.0.0:3000",
        "http://0.0.0.0:5173",
    ]
    return default_origins + parsed_origins

# The API surface stays stable while the underlying generation strategy evolves.
app = FastAPI(
    title="Skill-Bridge Career Navigator API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$",
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


def decode_pdf_payload(field_name: str, encoded_value: str) -> bytes:
    try:
        return base64.b64decode(encoded_value, validate=True)
    except (binascii.Error, ValueError) as error:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be valid base64-encoded PDF content.",
        ) from error


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_profile(request: GenerationRequest) -> AnalyzeResponse:
    # Component 1 converts varied inputs into normalized text for the roadmap engine.
    ingestors = {
        "raw_text": RawTextIngestor(),
        "pdf_object": PDFObjectIngestor(),
    }
    source_ingestor = ingestors[request.source_type]
    target_ingestor = ingestors[request.target_type]
    source_file_bytes = None
    target_file_bytes = None

    if request.source_type == "pdf_object":
        if not request.source_file_base64:
            raise HTTPException(
                status_code=400,
                detail="source_file_base64 is required when source_type is pdf_object.",
            )
        source_file_bytes = decode_pdf_payload("source_file_base64", request.source_file_base64)

    if request.target_type == "pdf_object":
        if not request.target_file_base64:
            raise HTTPException(
                status_code=400,
                detail="target_file_base64 is required when target_type is pdf_object.",
            )
        target_file_bytes = decode_pdf_payload("target_file_base64", request.target_file_base64)

    try:
        normalized_source_text = source_ingestor.ingest(
            request.source_text,
            file_bytes=source_file_bytes,
        )
        normalized_target_job = target_ingestor.ingest(
            request.target_job,
            file_bytes=target_file_bytes,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if request.source_type == "raw_text" and not normalized_source_text:
        raise HTTPException(status_code=400, detail="source_text is required when source_type is raw_text.")

    if request.target_type == "raw_text" and not normalized_target_job:
        raise HTTPException(status_code=400, detail="target_job is required when target_type is raw_text.")

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
