from typing import Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import AnalyzeResponse, GenerationRequest, RoadmapNode
from app.parsers import RawTextParser

# PR1 keeps the API surface stable while the roadmap engine is still a stub.
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
    # Component 1 hands normalized text to Component 2 in later PRs.
    parser = RawTextParser()
    normalized_source_text = parser.parse(request.source_text)
    normalized_target_job = parser.parse(request.target_job)

    # Placeholder output preserves the response contract until the engine lands.
    placeholder_roadmap = [
        RoadmapNode(
            node_id="foundation-review",
            skill="Roadmap generation pending PR2 engine integration",
            resource="DAGFallbackStrategy will populate this in the next PR.",
            estimated_weeks=1,
            rationale="PR1 validates request handling, parsing, and API wiring.",
        )
    ]

    return AnalyzeResponse(
        normalized_source_text=normalized_source_text,
        normalized_target_job=normalized_target_job,
        roadmap=placeholder_roadmap,
        parser_used=parser.__class__.__name__,
    )
