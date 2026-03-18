import json
from typing import Dict, List

from app.models import GraphEdge, RoadmapNode
from app.roadmap_generator.ai_models.base import AbstractAIModel
from app.roadmap_generator.ai_models.gemini_model import GeminiModel
from app.roadmap_generator.base import RoadmapGenerationStrategy


class AIGenerationStrategy(RoadmapGenerationStrategy):
    def __init__(self, model_client: AbstractAIModel | None = None) -> None:
        self.model_client = model_client or GeminiModel()

    def _build_prompt(self, source_text: str, target_job: str, time_budget_weeks: int) -> str:
        return f"""
You are a strict career counselor.
Read the Source Profile and Target Job.
Extract the missing technical skills, infer prerequisite relationships between them,
and return ONLY valid JSON.

Return a JSON object with this exact shape:
{{
  "nodes": [
    {{
      "node_id": "skill-id",
      "skill": "Skill Name",
      "resource": "Specific learning resource or project suggestion",
      "estimated_weeks": 1,
      "rationale": "Why this skill matters"
    }}
  ],
  "edges": []
}}

Rules:
- Return only JSON with no markdown fences.
- Focus on technical skills only.
- Keep node_id lowercase and hyphenated.
- Return nodes in learning order, where prerequisites come before dependent skills.
- Infer prerequisite relationships yourself. If one skill should be learned before another,
  add an edge for it.
- Each edge must use this shape:
  {{ "source": "prerequisite-node-id", "target": "dependent-node-id" }}
- Do not leave edges empty if there are clear dependencies.
- Examples of prerequisite thinking:
  - Docker before Kubernetes
  - JavaScript before React
  - SQL fundamentals before PostgreSQL optimization
  - Git before CI/CD workflows
- If no skills are missing, return one node explaining that the profile already matches the target.
- time_budget_weeks available: {time_budget_weeks}

Source Profile:
{source_text}

Target Job:
{target_job}
""".strip()

    def generate(
        self,
        source_text: str,
        target_job: str,
        time_budget_weeks: int,
    ) -> Dict[str, List]:
        ai_payload = json.loads(
            self.model_client.generate_text(
                self._build_prompt(source_text, target_job, time_budget_weeks)
            )
        )
        nodes = [RoadmapNode(**node) for node in ai_payload.get("nodes", [])]
        edges = [GraphEdge(**edge) for edge in ai_payload.get("edges", [])]

        return {
            "nodes": nodes,
            "edges": edges,
        }
