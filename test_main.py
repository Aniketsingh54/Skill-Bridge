from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_happy_path(monkeypatch):
    class StubAIStrategy:
        def generate(self, source_text, target_job, time_budget_weeks):
            return {
                "nodes": [
                    {
                        "node_id": "docker",
                        "skill": "Docker",
                        "resource": "Build and containerize one FastAPI project.",
                        "estimated_weeks": 2,
                        "rationale": "Containerization is required by the target role.",
                    }
                ],
                "edges": [],
            }

    monkeypatch.setattr("app.main.AIGenerationStrategy", StubAIStrategy)

    response = client.post(
        "/api/analyze",
        json={
            "source_type": "raw_text",
            "source_text": "I know Python, SQL, and FastAPI.",
            "target_job": "Need Docker, Kubernetes, and PostgreSQL experience.",
            "time_budget_weeks": 8,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["strategy_used"] == "StubAIStrategy"
    assert len(payload["nodes"]) == 1
    assert payload["nodes"][0]["skill"] == "Docker"


def test_fallback_triggers(monkeypatch):
    class FailingAIStrategy:
        def generate(self, source_text, target_job, time_budget_weeks):
            raise RuntimeError("Simulated Gemini failure")

    monkeypatch.setattr("app.main.AIGenerationStrategy", FailingAIStrategy)

    response = client.post(
        "/api/analyze",
        json={
            "source_type": "raw_text",
            "source_text": "I know Python and Git.",
            "target_job": "Need Docker, Kubernetes, and CI/CD experience.",
            "time_budget_weeks": 8,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["strategy_used"] == "DAGFallbackStrategy"
    assert len(payload["nodes"]) >= 1
