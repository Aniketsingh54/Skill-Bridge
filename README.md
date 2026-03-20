# Skill-Bridge Career Navigator

**Candidate Name:** Aniket Singh
**Scenario Chosen:** Skill-Bridge Career Navigator
**Estimated Time Spent:** Approximately 5-6 hours

---

## Key Features

- **AI-Powered Learning Path** — Leverages Gemini to analyze your current profile vs. a target job description and generate a dependency-aware skill roadmap.
- **Interactive Roadmap Graph** — A visual SVG-based graph showing prerequisites and milestones. Hover over any node for a detailed popup with rationale and learning resources.
- **Deterministic Fallback** — Built-in graceful degradation; if the AI generation fails, the system automatically falls back to a mathematical Directed Acyclic Graph (DAG) strategy for stability.
- **Professional Email Reports** — Send a polished HTML version of your roadmap to any email address via the "Send to my Email" feature.
- **Dual Ingestion** — Support for both raw text input and PDF object uploads (resumes/JDs).

---

## Quick Start

**Prerequisites:** Python 3.12+, Node.js 20+, npm

```bash
# Backend
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

```bash
# Frontend (separate terminal)
cd frontend
npm install
npm run dev -- --host
```

> **Note:** If the frontend calls the backend directly instead of through the Vite `/api` proxy, set `VITE_API_BASE_URL` in the frontend `.env` and add that origin to `FRONTEND_ORIGINS` on the backend.

**Run Tests:**
```bash
source .venv/bin/activate
pytest -v test_main.py
```

---

## Design & Architecture

For a deep dive into the technical details, scoring pillar alignment, and trade-offs, see [DESIGN.md](DESIGN.md).

---

## AI Disclosure

- **Used AI assistant?** Yes (Gemini API for roadmap generation; AI tools for development assistance)
- **How suggestions were verified:** Generated roadmaps were checked against the backend response contract; the AI path and DAG fallback path were manually exercised; API-level tests cover the happy path and fallback behavior.
- **Example of a rejected suggestion:** Rejected direct LinkedIn profile scraping; replaced with a cleaner ingestion approach using raw text and PDF resume parsing.

---

## Tradeoffs & Prioritization

**Cut to stay within time limit:**
- Authentication and per-user persistence
- Multi-job aggregation
- OCR for scanned PDFs
- Rich prerequisite ontology backed by a graph database

**Known Limitations:**
- AI-generated edges can still be incomplete or overly opinionated
- DAG fallback covers only a limited in-memory skill map
- PDF support assumes text-extractable resumes (not scanned images)

---

## Project Notes

- Synthetic dataset: [sample_data.json](sample_data.json)
- Backend API docs: `http://localhost:8080/docs`
- Frontend proxies `/api` calls through Vite during development

---

## Video

<!-- Replace this line with your YouTube/Vimeo link before submitting -->
Add your unlisted demo recording link here.
