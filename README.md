# Skill-Bridge Career Navigator

**Candidate Name:** Aniket Singh

**Scenario Chosen:** Skill-Bridge Career Navigator

**Estimated Time Spent:** Approximately 5-6 hours

---

## Key Features

- **AI-Powered Skill Gap Analysis**,  Gemini analyses your current profile vs. a target job description and generates a dependency-aware roadmap ordered by prerequisite logic, not arbitrary priority.
- **Cybersecurity-Focused Sample Data**,  Ships with profiles for transitioning into **Cloud Security Engineer** and **AI Security Operations** roles, directly mirroring the FY26 IT hiring context.
- **Interactive Roadmap Graph**,  SVG-based directed graph with hover popups showing rationale and learning resources per node.
- **Deterministic Fallback**,  If AI generation fails, a mathematical DAG provides a stable, bias-free result automatically.
- **Professional Email Reports**,  Send a polished HTML roadmap to any email address via the "Send to my Email" feature.
- **Dual Ingestion**,  Raw text input and PDF uploads supported for both profile and job description.

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

Here's the [Demo Link](https://youtu.be/dWHGzhcW1Xw)