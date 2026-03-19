# Skill-Bridge Design

## Overview
Skill-Bridge is a two-component career navigation platform. The system accepts a learner profile and a target job description, then produces a dependency-aware roadmap that highlights what to learn next.

## Component 1: Ingestion Layer
The ingestion layer converts different input forms into normalized text that the rest of the system can analyze.

- `AbstractIngestor` defines the ingestion contract.
- `RawTextIngestor` normalizes pasted text.
- `PDFResumeIngestor` extracts and cleans text from uploaded PDF resumes.

This keeps source-specific cleanup isolated from roadmap generation. New sources can be added as subclasses without rewriting the API route.

## Component 2: Roadmap Generation
The roadmap layer uses a strategy pattern so the app can switch between AI generation and deterministic fallback logic.

- `AIGenerationStrategy` asks Gemini to identify missing skills and infer dependency edges.
- `DAGFallbackStrategy` provides a mathematical fallback based on a known dependency map.

The API always returns the same response shape: `nodes` and `edges`.

## Fallback Trapdoor
External AI calls are unreliable by nature. The `/api/analyze` route attempts AI generation first, then catches any failure and falls back to the DAG strategy. This keeps the user experience stable and satisfies the requirement for graceful degradation.

## Zero-Retention
The backend is zero-retention by design. It does not persist resumes, job descriptions, or profile text to a database. Requests are processed in memory and returned as responses only.

## Tradeoffs
- The DAG fallback uses a small in-memory dependency map instead of a graph database.
- The AI-generated graph can still be incomplete if the model omits prerequisites.
- PDF handling currently supports text extraction but not scanned OCR resumes.
- No authentication or per-user persistence is implemented in this version.
