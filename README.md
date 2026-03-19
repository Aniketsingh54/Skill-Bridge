# Skill-Bridge Career Navigator

Candidate Name:
Aniket Singh

Scenario Chosen:
Skill-Bridge Career Navigator

Estimated Time Spent:
Approximately 5-6 hours

Quick Start:
- Prerequisites:
  Python 3.12+, Node.js 20+, npm
- Run Commands:
  ```bash
  source venv/bin/activate
  pip install -r requirements.txt
  python main.py
  ```
  ```bash
  cd frontend
  npm install
  npm run dev -- --host
  ```
- Test Commands:
  ```bash
  source venv/bin/activate
  pytest -v test_main.py
  ```

AI Disclosure:
- Did you use an AI assistant (Copilot, ChatGPT, etc.)? (Yes/No)
  Yes
- How did you verify the suggestions?
  I checked the generated roadmap against the backend response contract, manually exercised the AI path and DAG fallback path, and added API-level tests for the happy path and fallback behavior.
- Give one example of a suggestion you rejected or changed:
  I rejected the idea of scraping LinkedIn profiles directly and replaced it with a cleaner ingestion approach using raw text and PDF resume parsing.

Tradeoffs & Prioritization:
- What did you cut to stay within the 4-6 hour limit?
  I skipped authentication, persistence, multi-job aggregation, OCR for scanned PDFs, and a richer prerequisite ontology backed by a graph database.
- What would you build next if you had more time?
  I would improve dependency quality, add support for multiple job descriptions, separate inferred prerequisites from direct target skills, and refine the graph UX further.
- Known limitations:
  AI-generated edges can still be incomplete or overly opinionated, the DAG fallback covers only a limited in-memory skill map, and PDF support assumes text-extractable resumes rather than scanned images.

Project Notes:
- Synthetic dataset is included in [sample_data.json](sample_data.json).
- Backend docs are available at `http://localhost:8080/docs`.
- The frontend calls the backend through the Vite `/api` proxy during development.

Video:
Add your unlisted demo recording link here.
