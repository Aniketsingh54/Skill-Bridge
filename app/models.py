from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class GenerationRequest(BaseModel):
    source_text: str = Field(
        default="",
        max_length=25_000,
        description="Profile text for raw_text ingestion. Capped at 25 000 chars (~5 000 tokens) to prevent runaway AI calls.",
    )
    source_type: Literal["raw_text", "pdf_object"] = Field(
        default="raw_text",
        description="How the source profile is being provided to the ingestion layer.",
    )
    source_file_base64: Optional[str] = Field(
        default=None,
        description="Base64-encoded PDF file content when source_type is pdf_object.",
    )
    target_type: Literal["raw_text", "pdf_object"] = Field(
        default="raw_text",
        description="How the target job is being provided to the ingestion layer.",
    )
    target_file_base64: Optional[str] = Field(
        default=None,
        description="Base64-encoded PDF file content when target_type is pdf_object.",
    )
    target_job: str = Field(
        default="",
        max_length=10_000,
        description="Target job description when target_type is raw_text. Capped at 10 000 chars.",
    )
    time_budget_weeks: int = Field(
        default=8,
        ge=1,
        le=104,
        description="Time budget available to complete the roadmap.",
    )
    target_role: Optional[str] = Field(
        default=None,
        description="Optional role label such as Backend Engineer or Cloud Engineer.",
    )
    include_mock_interview: bool = Field(
        default=False,
        description="Whether interview question generation should be included later.",
    )


class RoadmapNode(BaseModel):
    node_id: str = Field(..., description="Unique identifier for the roadmap node.")
    skill: str = Field(..., min_length=1, description="Skill or milestone name.")
    resource: str = Field(..., min_length=1, description="Suggested learning resource.")
    estimated_weeks: int = Field(
        default=1,
        ge=1,
        description="Estimated time to complete this node.",
    )
    rationale: Optional[str] = Field(
        default=None,
        description="Short explanation of why the node is recommended.",
    )


class GraphEdge(BaseModel):
    source: str = Field(..., description="Prerequisite node identifier.")
    target: str = Field(..., description="Dependent node identifier.")


class AnalyzeResponse(BaseModel):
    normalized_source_text: str
    normalized_target_job: str
    nodes: List[RoadmapNode]
    edges: List[GraphEdge]
    ingestor_used: str
    strategy_used: str


class SendEmailRequest(BaseModel):
    email: str = Field(..., description="Recipient email address.")
    subject: str = Field(default="Your Career Roadmap", max_length=200, description="Email subject line.")
    html_body: str = Field(..., max_length=500_000, description="Pre-rendered HTML email body from the frontend.")
