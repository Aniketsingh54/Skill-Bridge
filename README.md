# Skill-Bridge Career Navigator

**Candidate:** Aniket Singh
**Scenario:** Skill-Bridge Career Navigator
**Estimated Time Spent:** ~5-6 hours

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

**Run tests:**
```bash
source .venv/bin/activate
pytest -v test_main.py
```

---

## AI Disclosure

- **Used AI assistant?** Yes (Gemini API for roadmap generation; AI tools for development assistance)
- **How suggestions were verified:** Generated roadmaps were checked against the backend response contract; the AI path and DAG fallback path were manually exercised; API-level tests cover the happy path and fallback behaviour.
- **Example of a rejected suggestion:** Rejected direct LinkedIn profile scraping; replaced with a cleaner ingestion approach using raw text and PDF resume parsing.

---

## Tradeoffs & Prioritization

**Cut to stay within time limit:**
- Authentication and per-user persistence
- Multi-job aggregation
- OCR for scanned PDFs
- Rich prerequisite ontology backed by a graph database

**Would build next:**
- Improved dependency quality and completeness
- Support for multiple job descriptions side-by-side
- Separation of inferred prerequisites from direct target skills
- Graph UX refinements (collapsible paths, estimated cost overlays)

**Known limitations:**
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
