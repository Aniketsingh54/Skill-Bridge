import base64

from fastapi.testclient import TestClient

from app.main import app
from app.roadmap_generator.dag_fallback_strategy import DAGFallbackStrategy


client = TestClient(app)


def test_analyze_raw_text_happy_path(monkeypatch):
    class StubAIStrategy:
        def generate(self, source_text, target_job, time_budget_weeks):
            assert source_text == "I know Python and FastAPI."
            assert "Docker" in target_job
            assert time_budget_weeks == 8
            return {
                "nodes": [
                    {
                        "node_id": "docker",
                        "skill": "Docker",
                        "resource": "Containerize one FastAPI project.",
                        "estimated_weeks": 2,
                        "rationale": "Containerization is required for the target role.",
                    }
                ],
                "edges": [],
            }

    monkeypatch.setattr("app.main.AIGenerationStrategy", StubAIStrategy)

    response = client.post(
        "/api/analyze",
        json={
            "source_type": "raw_text",
            "source_text": "I know Python and FastAPI.",
            "target_job": "Need Docker and Kubernetes experience.",
            "time_budget_weeks": 8,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ingestor_used"] == "RawTextIngestor"
    assert payload["strategy_used"] == "StubAIStrategy"
    assert payload["nodes"][0]["skill"] == "Docker"


def test_analyze_falls_back_to_dag_when_ai_fails(monkeypatch):
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
    returned_skills = [node["skill"] for node in payload["nodes"]]
    assert "Docker" in returned_skills
    assert "Kubernetes" in returned_skills


def test_analyze_pdf_object_path_uses_pdf_ingestion(monkeypatch):
    class StubPDFObjectIngestor:
        def ingest(self, source, file_bytes=None):
            assert file_bytes == b"fake-pdf-binary"
            return "Extracted PDF resume text with Python and SQL."

    class StubAIStrategy:
        def generate(self, source_text, target_job, time_budget_weeks):
            assert "Extracted PDF resume text" in source_text
            return {
                "nodes": [
                    {
                        "node_id": "postgresql",
                        "skill": "PostgreSQL",
                        "resource": "Use PostgreSQL in an existing project.",
                        "estimated_weeks": 2,
                        "rationale": "The role expects production database depth.",
                    }
                ],
                "edges": [],
            }

    monkeypatch.setattr("app.main.PDFObjectIngestor", StubPDFObjectIngestor)
    monkeypatch.setattr("app.main.AIGenerationStrategy", StubAIStrategy)

    response = client.post(
        "/api/analyze",
        json={
            "source_type": "pdf_object",
            "source_file_base64": base64.b64encode(b"fake-pdf-binary").decode("utf-8"),
            "target_job": "Need PostgreSQL and Docker experience.",
            "time_budget_weeks": 8,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ingestor_used"] == "StubPDFObjectIngestor"
    assert payload["nodes"][0]["skill"] == "PostgreSQL"


def test_analyze_target_pdf_path_uses_pdf_ingestion(monkeypatch):
    class StubPDFObjectIngestor:
        def ingest(self, source, file_bytes=None):
            if file_bytes == b"fake-job-pdf-binary":
                return "Extracted job description text mentioning Docker and Kubernetes."
            return "I know Python and Git."

    class StubAIStrategy:
        def generate(self, source_text, target_job, time_budget_weeks):
            assert source_text == "I know Python and Git."
            assert "Extracted job description text" in target_job
            assert time_budget_weeks == 8
            return {
                "nodes": [
                    {
                        "node_id": "docker",
                        "skill": "Docker",
                        "resource": "Containerize a sample service.",
                        "estimated_weeks": 2,
                        "rationale": "The uploaded JD expects container experience.",
                    }
                ],
                "edges": [],
            }

    monkeypatch.setattr("app.main.PDFObjectIngestor", StubPDFObjectIngestor)
    monkeypatch.setattr("app.main.AIGenerationStrategy", StubAIStrategy)

    response = client.post(
        "/api/analyze",
        json={
            "source_type": "raw_text",
            "source_text": "I know Python and Git.",
            "target_type": "pdf_object",
            "target_file_base64": base64.b64encode(b"fake-job-pdf-binary").decode("utf-8"),
            "time_budget_weeks": 8,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["normalized_target_job"].startswith("Extracted job description text")
    assert payload["nodes"][0]["skill"] == "Docker"


def test_dag_fallback_respects_dependency_order():
    strategy = DAGFallbackStrategy()

    analysis = strategy.generate(
        source_text="I know Python and Git.",
        target_job="Need Docker, Kubernetes, and CI/CD experience.",
        time_budget_weeks=8,
    )

    ordered_skills = [node.skill for node in analysis["nodes"]]

    assert ordered_skills.index("Linux") < ordered_skills.index("Docker")
    assert ordered_skills.index("Docker") < ordered_skills.index("Kubernetes")


def test_invalid_pdf_payload_returns_clear_error():
    response = client.post(
        "/api/analyze",
        json={
            "source_type": "pdf_object",
            "source_file_base64": "not-valid-base64",
            "target_job": "Need Docker experience.",
            "time_budget_weeks": 8,
        },
    )

    assert response.status_code == 400
    assert "valid base64-encoded PDF content" in response.json()["detail"]


def test_invalid_target_pdf_payload_returns_clear_error():
    response = client.post(
        "/api/analyze",
        json={
            "source_type": "raw_text",
            "source_text": "I know Docker.",
            "target_type": "pdf_object",
            "target_file_base64": "not-valid-base64",
            "time_budget_weeks": 8,
        },
    )

    assert response.status_code == 400
    assert "target_file_base64 must be valid base64-encoded PDF content" in response.json()["detail"]
