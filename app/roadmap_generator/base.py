from abc import ABC, abstractmethod
from typing import Dict, List


class RoadmapGenerationStrategy(ABC):
    @abstractmethod
    def generate(
        self,
        source_text: str,
        target_job: str,
        time_budget_weeks: int,
    ) -> Dict[str, List]:
        """Generate an ordered roadmap for the supplied profile and target job."""
