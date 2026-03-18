from typing import Dict, List, Set

from app.models import GraphEdge, RoadmapNode
from app.roadmap_generator.base import RoadmapGenerationStrategy


SKILL_ALIASES: Dict[str, List[str]] = {
    "HTML": ["html"],
    "CSS": ["css"],
    "JavaScript": ["javascript", "js"],
    "TypeScript": ["typescript", "ts"],
    "React": ["react"],
    "Python": ["python"],
    "FastAPI": ["fastapi"],
    "SQL": ["sql"],
    "PostgreSQL": ["postgresql", "postgres"],
    "Docker": ["docker"],
    "Kubernetes": ["kubernetes", "k8s"],
    "CI/CD": ["ci/cd", "cicd", "continuous integration", "continuous deployment"],
    "AWS": ["aws", "amazon web services"],
    "Linux": ["linux"],
    "Git": ["git"],
}

SKILL_DEPENDENCIES: Dict[str, List[str]] = {
    "React": ["JavaScript", "HTML", "CSS"],
    "TypeScript": ["JavaScript"],
    "FastAPI": ["Python"],
    "PostgreSQL": ["SQL"],
    "Docker": ["Linux"],
    "Kubernetes": ["Docker", "Linux"],
    "CI/CD": ["Git"],
}


class DAGFallbackStrategy(RoadmapGenerationStrategy):
    def extract_skills(self, text: str) -> List[str]:
        lowered_text = text.lower()
        detected_skills: List[str] = []

        for skill, aliases in SKILL_ALIASES.items():
            if any(alias in lowered_text for alias in aliases):
                detected_skills.append(skill)

        return detected_skills

    def find_missing_skills(
        self,
        current_skills: List[str],
        required_skills: List[str],
    ) -> List[str]:
        current_skill_set = set(current_skills)
        return [skill for skill in required_skills if skill not in current_skill_set]

    def expand_and_sort_skills(
        self,
        skills: List[str],
        current_skills: List[str],
    ) -> List[str]:
        ordered_skills: List[str] = []
        visited: Set[str] = set()
        current_skill_set = set(current_skills)

        def visit(skill: str) -> None:
            if skill in visited:
                return

            visited.add(skill)

            for dependency in SKILL_DEPENDENCIES.get(skill, []):
                if dependency not in current_skill_set:
                    visit(dependency)

            ordered_skills.append(skill)

        for skill in skills:
            visit(skill)

        return ordered_skills

    def build_analysis_payload(
        self,
        ordered_skills: List[str],
        current_skills: List[str],
        time_budget_weeks: int,
    ) -> Dict[str, List]:
        if not ordered_skills:
            return {
                "nodes": [
                    RoadmapNode(
                        node_id="skill-gap-closed",
                        skill="Profile already matches core target skills",
                        resource="Review the role requirements and start applying to similar openings.",
                        estimated_weeks=1,
                        rationale="No missing skills were detected from the current fallback matcher.",
                    )
                ],
                "edges": [],
            }

        estimated_weeks = max(1, time_budget_weeks // len(ordered_skills))
        current_skill_set = set(current_skills)
        nodes: List[RoadmapNode] = []
        edges: List[GraphEdge] = []
        seen_edges: Set[tuple[str, str]] = set()

        for skill in ordered_skills:
            nodes.append(
                RoadmapNode(
                    node_id=self.to_node_id(skill),
                    skill=skill,
                    resource=f"Practice {skill} with one guided project and one interview-focused recap.",
                    estimated_weeks=estimated_weeks,
                    rationale="Scheduled by the fallback DAG engine based on prerequisite order.",
                )
            )

            for dependency in SKILL_DEPENDENCIES.get(skill, []):
                if dependency in current_skill_set:
                    continue

                edge = (self.to_node_id(dependency), self.to_node_id(skill))
                if edge in seen_edges:
                    continue

                seen_edges.add(edge)
                edges.append(GraphEdge(source=edge[0], target=edge[1]))

        return {
            "nodes": nodes,
            "edges": edges,
        }

    def to_node_id(self, skill: str) -> str:
        return skill.lower().replace("/", "-").replace(" ", "-")

    def generate(
        self,
        source_text: str,
        target_job: str,
        time_budget_weeks: int,
    ) -> Dict[str, List]:
        current_skills = self.extract_skills(source_text)
        required_skills = self.extract_skills(target_job)
        missing_skills = self.find_missing_skills(current_skills, required_skills)
        ordered_skills = self.expand_and_sort_skills(missing_skills, current_skills)
        return self.build_analysis_payload(
            ordered_skills=ordered_skills,
            current_skills=current_skills,
            time_budget_weeks=time_budget_weeks,
        )
