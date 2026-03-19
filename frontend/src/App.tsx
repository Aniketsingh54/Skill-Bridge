import { ChangeEvent, useEffect, useState } from "react";

import RoadmapGraph from "./components/RoadmapGraph";

type Node = {
  node_id: string;
  skill: string;
  resource: string;
  estimated_weeks: number;
  rationale?: string | null;
};

type Edge = {
  source: string;
  target: string;
};

type AnalyzeResponse = {
  normalized_source_text: string;
  normalized_target_job: string;
  nodes: Node[];
  edges: Edge[];
  ingestor_used: string;
  strategy_used: string;
};

const demoProfile = `Aniket is a backend-focused developer with experience in Python, Git, SQL, and building APIs using FastAPI. Comfortable shipping small projects and collaborating through Git workflows.`;

const demoJob = `We need a backend engineer with Python, FastAPI, Docker, Kubernetes, CI/CD, AWS, and PostgreSQL experience.`;

const API_URL = "/api/analyze";
const loadingMessages = [
  "Parsing current profile...",
  "Understanding target role...",
  "Mapping skill gaps...",
  "Finding the cheapest path forward...",
  "Generating roadmap nodes...",
  "Connecting prerequisite edges...",
];

function App() {
  const [sourceType, setSourceType] = useState<"raw_text" | "pdf_resume">("raw_text");
  const [sourceText, setSourceText] = useState("");
  const [targetJob, setTargetJob] = useState("");
  const [jobId, setJobId] = useState("");
  const [timeBudgetWeeks, setTimeBudgetWeeks] = useState(8);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  useEffect(() => {
    if (!loading) {
      setLoadingIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingIndex((current) => (current + 1) % loadingMessages.length);
    }, 1200);

    return () => window.clearInterval(interval);
  }, [loading]);

  const loadDemoData = () => {
    setSourceType("raw_text");
    setSourceText(demoProfile);
    setTargetJob(demoJob);
    setJobId("backend-engineer-demo");
    setPdfFile(null);
    setResult(null);
    setError("");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setPdfFile(nextFile);
    setResult(null);
    setError("");
  };

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const resultValue = reader.result;
        if (typeof resultValue !== "string") {
          reject(new Error("Could not read file."));
          return;
        }
        resolve(resultValue.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const payload: Record<string, unknown> = {
        source_type: sourceType,
        source_text: sourceType === "raw_text" ? sourceText : "",
        target_job: jobId.trim()
          ? `Job ID: ${jobId.trim()}\n\n${targetJob}`
          : targetJob,
        time_budget_weeks: timeBudgetWeeks,
      };

      if (sourceType === "pdf_resume") {
        if (!pdfFile) {
          throw new Error("Please choose a PDF resume before generating the roadmap.");
        }

        payload.source_file_base64 = await toBase64(pdfFile);
      } else if (!sourceText.trim()) {
        throw new Error("Please paste a source profile before generating the roadmap.");
      }

      if (!targetJob.trim()) {
        throw new Error("Please paste a target job description.");
      }

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const failure = (await response.json()) as { detail?: string };
        throw new Error(failure.detail ?? "Failed to generate roadmap.");
      }

      const data = (await response.json()) as AnalyzeResponse;
      setResult(data);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-backdrop" />
      <main className="app-frame">
        <section className="hero-band">
          <p className="eyebrow">Skill-Bridge Career Navigator</p>
          <h1>Turn a profile into a skill graph with clear next steps.</h1>
          <p className="hero-copy">
            Compare where someone is now against where they want to go next, then turn
            that gap into a dependency-aware learning map.
          </p>
        </section>

        <section className="split-stage">
          <div className="state-panel from-panel">
            <div className="state-chip">From</div>
            <h2>Current State</h2>
            <p className="state-copy">
              Capture who the user is today with either pasted text or an uploaded resume.
            </p>

            <div className="field-row">
              <label className="field">
                <span>Input Type</span>
                <select
                  value={sourceType}
                  onChange={(event) =>
                    setSourceType(event.target.value as "raw_text" | "pdf_resume")
                  }
                >
                  <option value="raw_text">Paste profile text</option>
                  <option value="pdf_resume">Attach PDF resume</option>
                </select>
              </label>

              <label className="field">
                <span>Time Budget</span>
                <input
                  min={1}
                  max={52}
                  type="number"
                  value={timeBudgetWeeks}
                  onChange={(event) => setTimeBudgetWeeks(Number(event.target.value))}
                />
              </label>
            </div>

            {sourceType === "raw_text" ? (
              <label className="field">
                <span>Profile Text</span>
                <textarea
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  placeholder="Paste resume text, profile summary, achievements, skills, or project context."
                  rows={14}
                />
              </label>
            ) : (
              <label className="upload-card">
                <span className="upload-title">Attach Resume</span>
                <span className="upload-copy">
                  Drop in a PDF resume and let the ingestion layer extract the text.
                </span>
                <input accept="application/pdf" onChange={handleFileChange} type="file" />
                <strong>{pdfFile ? pdfFile.name : "No file chosen yet"}</strong>
              </label>
            )}
          </div>

          <div className="state-panel to-panel">
            <div className="state-chip state-chip-alt">To</div>
            <h2>Target State</h2>
            <p className="state-copy">
              Define the destination role with a job ID and the actual target job text.
            </p>

            <div className="field-row">
              <label className="field">
                <span>Job ID</span>
                <input
                  type="text"
                  value={jobId}
                  onChange={(event) => setJobId(event.target.value)}
                  placeholder="backend-engineer-01"
                />
              </label>

              <div className="action-stack">
                <button className="ghost-button" onClick={loadDemoData} type="button">
                  Load Demo Data
                </button>
                <button
                  className="primary-button"
                  disabled={loading}
                  onClick={handleGenerate}
                  type="button"
                >
                  {loading ? "Building Roadmap..." : "Submit"}
                </button>
              </div>
            </div>

            <label className="field">
              <span>Target Job Text</span>
              <textarea
                value={targetJob}
                onChange={(event) => setTargetJob(event.target.value)}
                placeholder="Paste the target job description or hiring brief."
                rows={14}
              />
            </label>

            {error ? <p className="error-banner">{error}</p> : null}
          </div>
        </section>

        {loading ? (
          <section className="loading-shell">
            <div className="loading-orbit">
              <div className="loading-ring loading-ring-a" />
              <div className="loading-ring loading-ring-b" />
              <div className="loading-core" />
            </div>
            <div className="loading-copy">
              <p className="loading-label">Pipeline Running</p>
              <h3>{loadingMessages[loadingIndex]}</h3>
              <p>
                Parsing things, generating roadmaps, and looking for the cleanest path
                from current state to target state.
              </p>
            </div>
          </section>
        ) : null}

        <section className="panel output-panel">
            <div className="panel-header">
              <h2>Roadmap</h2>
              {result ? (
                <div className="meta-pill-row">
                  <span className="meta-pill">{result.ingestor_used}</span>
                  <span className="meta-pill">{result.strategy_used}</span>
                </div>
              ) : null}
            </div>

            {!result ? (
              <div className="empty-state">
                <p>Generate a roadmap to see ordered nodes and dependency edges here.</p>
              </div>
            ) : (
              <div className="result-stack">
                <section>
                  <RoadmapGraph edges={result.edges} nodes={result.nodes} />
                </section>

              </div>
            )}
        </section>
      </main>
    </div>
  );
}

export default App;
