# Skill-Bridge Career Navigator

Skill-Bridge compares a learner's current profile against a target role and generates a roadmap of skills to learn next.

## Stack
- FastAPI backend
- React + Vite frontend
- Gemini-powered roadmap generation with DAG fallback

## Run The Backend
```bash
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

Backend docs:
`http://localhost:8080/docs`

## Run The Frontend
```bash
cd frontend
npm install
npm run dev -- --host
```

Frontend dev server:
`http://localhost:5173`

## Environment Variables
Create `.env` in the project root:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.1-flash-lite-preview
```

## Testing
Install the extra test dependencies if needed:

```bash
source venv/bin/activate
pip install pytest httpx
pytest
```

## Architecture
- Component 1: ingestion layer
  - raw text ingestion
  - PDF resume ingestion
- Component 2: roadmap generation
  - Gemini AI strategy
  - DAG fallback strategy

## Tradeoffs
- To stay within the project timebox, the fallback dependency model is an in-memory DAG instead of a graph database like Neo4j.
- AI-generated edges can still vary in quality depending on model output.
- LinkedIn scraping was intentionally avoided because it is brittle and policy-sensitive.
- Authentication, persistence, and user accounts were not implemented.

## Demo Flow
1. Paste profile text or upload a PDF resume.
2. Paste the target job description.
3. Generate the roadmap and inspect the graph.
4. Break the Gemini config in `.env` and generate again to show the DAG fallback still works.

## Video
Add your unlisted demo video link here.
