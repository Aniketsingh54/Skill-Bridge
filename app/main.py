from typing import Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import AnalyzeResponse, GenerationRequest
from app.parsers.raw_text_parser import RawTextParser
from app.roadmap_generator.dag_fallback_strategy import DAGFallbackStrategy

# The API surface stays stable while the underlying generation strategy evolves.
app = FastAPI(
    title="Skill-Bridge Career Navigator API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_profile(request: GenerationRequest) -> AnalyzeResponse:
    # Component 1 normalizes the raw text before the roadmap engine inspects it.
    parser = RawTextParser()
    normalized_source_text = parser.parse(request.source_text)
    normalized_target_job = parser.parse(request.target_job)

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
        parser_used=parser.__class__.__name__,
        strategy_used=strategy.__class__.__name__,
    )
