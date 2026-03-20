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


def test_send_email_happy_path(monkeypatch):
    # 1. Setup creds
    monkeypatch.setenv("SMTP_USER", "test@gmail.com")
    monkeypatch.setenv("SMTP_PASSWORD", "testpass")

    # 2. Mock SMTP_SSL
    class MockSMTP:
        def __init__(self, *args, **kwargs):
            self.logged_in = False
            self.sent = False

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def login(self, user, password):
            assert user == "test@gmail.com"
            assert password == "testpass"
            self.logged_in = True

        def sendmail(self, from_addr, to_addr, msg):
            assert from_addr == "test@gmail.com"
            assert to_addr == "user@example.com"
            assert "Your Career Roadmap" in msg
            self.sent = True

    monkeypatch.setattr("smtplib.SMTP_SSL", MockSMTP)
    # Re-patch these in app.main since they are loaded at module level
    monkeypatch.setattr("app.main.SMTP_USER", "test@gmail.com")
    monkeypatch.setattr("app.main.SMTP_PASSWORD", "testpass")

    response = client.post(
        "/api/send-email",
        json={
            "email": "user@example.com",
            "subject": "Your Career Roadmap",
            "html_body": "<h1>Testing</h1>",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"status": "sent"}


def test_send_email_fails_without_config(monkeypatch):
    # Ensure creds are missing in the patched module
    monkeypatch.setattr("app.main.SMTP_USER", "")
    monkeypatch.setattr("app.main.SMTP_PASSWORD", "")

    response = client.post(
        "/api/send-email",
        json={
            "email": "user@example.com",
            "subject": "Test",
            "html_body": "test",
        },
    )

    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


def test_send_email_handles_smtp_exception(monkeypatch):
    monkeypatch.setattr("app.main.SMTP_USER", "test@gmail.com")
    monkeypatch.setattr("app.main.SMTP_PASSWORD", "testpass")

    import smtplib

    class BrokenSMTP:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def login(self, user, password):
            raise smtplib.SMTPException("Auth failed")

    monkeypatch.setattr("smtplib.SMTP_SSL", BrokenSMTP)

    response = client.post(
        "/api/send-email",
        json={
            "email": "user@example.com",
            "subject": "Test",
            "html_body": "test",
        },
    )

    assert response.status_code == 502
    assert "Auth failed" in response.json()["detail"]
