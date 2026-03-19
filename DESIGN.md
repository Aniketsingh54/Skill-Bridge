# Skill-Bridge Design Document

## Overview

Skill-Bridge is a two-component career navigation platform. It accepts a learner profile and a target job description, then produces a dependency-aware visual roadmap that highlights the most direct learning path to the target role.

---

## Scoring Pillar Alignment

### 1. Problem Understanding
The challenge is precise: hiring teams need to evaluate candidates' skill gaps quickly, and candidates need a concrete learning plan. Skill-Bridge takes **both sides of that gap** as inputs (current profile, target JD) and outputs a directed graph of actionable steps — ordered by dependency, not by arbitrary priority.

### 2. Technical Rigor
The system is built in two decoupled layers:

**Component 1 — Ingestion Layer**
Converts varied input formats into normalized text for the roadmap engine.
- `AbstractIngestor` defines the contract.
- `RawTextIngestor` normalizes pasted profile/JD text.
- `PDFObjectIngestor` extracts and cleans text from uploaded PDF files.

New input sources can be added as subclasses without touching any API route.

**Component 2 — Roadmap Generation (Strategy Pattern)**
The strategy pattern allows the app to switch algorithms transparently:
- `AIGenerationStrategy` — sends normalized source+target text to Gemini, which identifies missing skills and infers prerequisite dependency edges.
- `DAGFallbackStrategy` — a deterministic fallback using a curated in-memory skill dependency map, used when the AI call fails.

The API always returns the same `{ nodes, edges }` shape regardless of which strategy ran.

**Fallback Trapdoor**
`/api/analyze` attempts AI generation first. On any failure it silently falls back to the DAG strategy, keeping the experience stable.

**Zero-Retention**
The backend is stateless by design. No resumes, JDs, or profile text are persisted to a database. All processing happens in-memory within the request lifecycle.

### 3. Creativity
- **Hover tooltip graph** — nodes reveal rationale and resources on hover without cluttering the base view.
- **Email report** — users can send their roadmap to any email address as a formatted HTML report, built entirely on the frontend.
- **Dynamic Next Step banner** — the system identifies the true root node (first skill with no prerequisites) and surfaces it as the recommended next action, not just the first item in the list.
- **Dual ingestion** — raw text and PDF uploads let the same flow handle both structured resumes and pasted summaries.

### 4. Prototype Quality
- Full-stack: FastAPI backend + Vite/React frontend.
- Live API docs at `/docs` (Swagger UI).
- Sample profiles and job descriptions included for immediate demo use.
- Filter bar to search the graph by skill, resource, or rationale.
- Responsive layout with smooth animations.

### 5. Responsible AI
- **AI Disclosure** — documented in README; use of Gemini API is declared.
- **Human-verifiable output** — every generated node includes a `rationale` field explaining why that skill was included. Users can audit and challenge the roadmap.
- **Graceful degradation** — when AI output is unavailable or unreliable, a deterministic DAG provides a safe fallback. The user experience is never broken by an AI failure.
- **Zero-retention** — profile and JD text are not stored, reducing data exposure risk.
- **Input validation** — Pydantic models enforce strict types and ranges on all API inputs; base64 PDF payloads are validated before processing.

---

## Tradeoffs

| Decision | Rationale |
|---|---|
| In-memory DAG fallback instead of a graph DB | Avoids infra dependency; sufficient for a demo scope |
| No authentication | Out of scope for a prototype; would be first addition in production |
| Text-only PDF extraction (no OCR) | PyPDF covers text-layer PDFs; OCR adds significant complexity |
| AI edges can be incomplete | Documented limitation; mitigated by the rationale field and human review |
