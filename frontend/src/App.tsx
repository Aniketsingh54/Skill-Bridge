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

type SampleProfile = {
  id: string;
  label: string;
  source_type: "raw_text" | "pdf_resume";
  source_text: string;
};

type SampleJob = {
  id: string;
  label: string;
  job_text: string;
};

type SampleData = {
  profiles: SampleProfile[];
  jobs: SampleJob[];
};

type Screen = "landing" | "profile" | "target" | "result";

const API_URL = "/api/analyze";
const SAMPLE_DATA_URL = "/api/sample-data";
const loadingMessages = [
  "Parsing current profile...",
  "Understanding target role...",
  "Mapping skill gaps...",
  "Finding the cheapest way forward...",
  "Generating roadmap nodes...",
  "Connecting prerequisite edges...",
];

function App() {
  const [screen, setScreen] = useState<Screen>("landing");
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
  const [sampleData, setSampleData] = useState<SampleData | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [roadmapFilter, setRoadmapFilter] = useState("");

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

  useEffect(() => {
    const loadSamples = async () => {
      try {
        const response = await fetch(SAMPLE_DATA_URL);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as SampleData;
        setSampleData(payload);
      } catch {
        // The UI can still function without remote sample loading.
      }
    };

    void loadSamples();
  }, []);

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
      setScreen("result");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Something went wrong.";
      setError(message);
      setScreen("target");
    } finally {
      setLoading(false);
    }
  };

  const applySelectedProfile = (profileId: string) => {
    const profile = sampleData?.profiles.find((item) => item.id === profileId);
    if (!profile) {
      return;
    }

    setSelectedProfileId(profile.id);
    setSourceType(profile.source_type);
    setSourceText(profile.source_text);
    setPdfFile(null);
    setResult(null);
  };

  const applySelectedJob = (jobValue: string) => {
    const job = sampleData?.jobs.find((item) => item.id === jobValue);
    if (!job) {
      return;
    }

    setSelectedJobId(job.id);
    setJobId(job.id);
    setTargetJob(job.job_text);
    setResult(null);
  };

  const filteredResult = (() => {
    if (!result || !roadmapFilter.trim()) {
      return result;
    }

    const query = roadmapFilter.trim().toLowerCase();
    const visibleNodes = result.nodes.filter(
      (node) =>
        node.skill.toLowerCase().includes(query) ||
        node.node_id.toLowerCase().includes(query) ||
        node.resource.toLowerCase().includes(query) ||
        (node.rationale ?? "").toLowerCase().includes(query),
    );
    const visibleIds = new Set(visibleNodes.map((node) => node.node_id));
    const visibleEdges = result.edges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    );

    return {
      ...result,
      nodes: visibleNodes,
      edges: visibleEdges,
    };
  })();

  const goToProfileStep = () => {
    setError("");
    setScreen("profile");
  };

  const goToTargetStep = () => {
    if (sourceType === "raw_text" && !sourceText.trim()) {
      setError("Add the user profile first so we know the current state.");
      return;
    }

    if (sourceType === "pdf_resume" && !pdfFile) {
      setError("Upload a PDF resume before moving to the target role.");
      return;
    }

    setError("");
    setScreen("target");
  };

  return (
    <div className="page-shell">
      <div className="page-backdrop" />
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />
      <div className="ambient-grid" />

      {loading ? (
        <section className="fullscreen-loader">
          <div className="fullscreen-loader__visual">
            <div className="loading-ring loading-ring-a" />
            <div className="loading-ring loading-ring-b" />
            <div className="loading-core" />
          </div>
          <p className="fullscreen-loader__eyebrow">Roadmap Engine</p>
          <h2>{loadingMessages[loadingIndex]}</h2>
          <p className="fullscreen-loader__copy">
            We&apos;re turning the current profile into a cleaner path toward the target role.
          </p>
          <div className="fullscreen-loader__steps">
            {loadingMessages.map((message, index) => (
              <span
                key={message}
                className={index <= loadingIndex ? "loader-step loader-step-active" : "loader-step"}
              >
                {message}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <main className="app-frame">
        {screen === "landing" ? (
          <section className="landing-shell">
            <div className="landing-copy">
              <p className="eyebrow">Career Roadmap Studio</p>
              <h1>Understand your next role and get a clearer path to reach it.</h1>
              <p className="landing-description">
                Share your profile, add the role you are aiming for, and get a roadmap that
                breaks the journey into practical next steps.
              </p>
              <div className="landing-actions">
                <button className="primary-button landing-button" onClick={goToProfileStep} type="button">
                  Get Started
                </button>
              </div>
            </div>

            <div className="landing-preview">
              <div className="landing-preview__card">
                <span>Your Background</span>
                <strong>Your experience, skills, resume, or profile</strong>
              </div>
              <div className="landing-preview__arrow">→</div>
              <div className="landing-preview__card">
                <span>Your Goal</span>
                <strong>The role you want, plus the job description</strong>
              </div>
              <div className="landing-preview__arrow">→</div>
              <div className="landing-preview__card landing-preview__card-accent">
                <span>Your Roadmap</span>
                <strong>A clear learning plan with prerequisites and next steps</strong>
              </div>
            </div>
          </section>
        ) : null}

        {screen === "profile" ? (
          <section className="flow-shell">
            <div className="flow-head">
              <div>
                <p className="eyebrow">Step 1</p>
                <h2>Tell us about your current background.</h2>
                <p className="flow-copy">
                  Start with where you are today so we can build the roadmap from the right place.
                </p>
              </div>
              <div className="flow-progress">
                <span className="flow-dot flow-dot-active" />
                <span className="flow-dot" />
                <span className="flow-dot" />
              </div>
            </div>

            <div className="form-shell">
              <div className="form-panel form-panel-warm">
                <div className="section-heading">
                  <div className="state-chip">From</div>
                  <div>
                    <h3>Your Starting Point</h3>
                    <p>Resume text, profile summary, or an uploaded PDF.</p>
                  </div>
                </div>

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

                {sampleData ? (
                  <label className="field">
                    <span>Sample Profile</span>
                    <select
                      value={selectedProfileId}
                      onChange={(event) => applySelectedProfile(event.target.value)}
                    >
                      <option value="">Choose sample profile</option>
                      {sampleData.profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {sourceType === "raw_text" ? (
                  <label className="field">
                    <span>Profile Text</span>
                    <textarea
                      value={sourceText}
                      onChange={(event) => setSourceText(event.target.value)}
                      placeholder="Paste your resume text, skills, projects, achievements, or profile summary."
                      rows={14}
                    />
                  </label>
                ) : (
                  <label className="upload-card">
                    <span className="upload-title">Attach Resume</span>
                    <span className="upload-copy">
                      Upload a PDF and let the ingestion layer pull out the meaningful text.
                    </span>
                    <input accept="application/pdf" onChange={handleFileChange} type="file" />
                    <strong>{pdfFile ? pdfFile.name : "No file chosen yet"}</strong>
                  </label>
                )}
              </div>

              <aside className="step-aside">
                <div className="step-aside__card">
                  <p className="eyebrow">Why this matters</p>
                  <h3>We start from what you already know.</h3>
                  <p>
                    This helps the roadmap focus on the gaps that matter instead of repeating
                    skills you already have.
                  </p>
                </div>

                <button className="arrow-button" onClick={goToTargetStep} type="button">
                  Continue To Your Goal <span>→</span>
                </button>

                {error ? <p className="error-banner">{error}</p> : null}
              </aside>
            </div>
          </section>
        ) : null}

        {screen === "target" ? (
          <section className="flow-shell">
            <div className="flow-head">
              <div>
                <p className="eyebrow">Step 2</p>
                <h2>Show us the role you want to grow into.</h2>
                <p className="flow-copy">
                  Add the target job so we can compare it against your current profile and map the gap.
                </p>
              </div>
              <div className="flow-progress">
                <span className="flow-dot flow-dot-active" />
                <span className="flow-dot flow-dot-active" />
                <span className="flow-dot" />
              </div>
            </div>

            <div className="form-shell">
              <div className="form-panel form-panel-cool">
                <div className="section-heading">
                  <div className="state-chip state-chip-alt">To</div>
                  <div>
                    <h3>Your Target Role</h3>
                    <p>Paste the destination job and the expectations for that role.</p>
                  </div>
                </div>

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

                  {sampleData ? (
                    <label className="field">
                      <span>Sample Job</span>
                      <select
                        value={selectedJobId}
                        onChange={(event) => applySelectedJob(event.target.value)}
                      >
                        <option value="">Choose sample job</option>
                        {sampleData.jobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div />
                  )}
                </div>

                <label className="field">
                  <span>Target Job Text</span>
                  <textarea
                    value={targetJob}
                    onChange={(event) => setTargetJob(event.target.value)}
                    placeholder="Paste the target job description or role brief."
                    rows={14}
                  />
                </label>
              </div>

              <aside className="step-aside">
                <div className="step-aside__card">
                  <p className="eyebrow">Ready To Build</p>
                  <h3>Now we can turn your goal into a plan.</h3>
                  <p>
                    We&apos;ll compare your current background against the target role, identify
                    the missing skills, and generate a visual path forward.
                  </p>
                </div>

                <div className="dual-actions">
                  <button className="secondary-button" onClick={() => setScreen("profile")} type="button">
                    ← Back To Background
                  </button>
                  <button className="primary-button" onClick={handleGenerate} type="button">
                    Build My Roadmap
                  </button>
                </div>

                {error ? <p className="error-banner">{error}</p> : null}
              </aside>
            </div>
          </section>
        ) : null}

        {screen === "result" ? (
          <section className="result-page">
            <div className="result-page__head">
              <div>
                <p className="eyebrow">Your Roadmap</p>
                <h2>Your learning path is ready.</h2>
              </div>
              <div className="result-page__actions">
                <button className="secondary-button" onClick={() => setScreen("profile")} type="button">
                  Edit Background
                </button>
                <button className="secondary-button" onClick={() => setScreen("target")} type="button">
                  Edit Goal
                </button>
              </div>
            </div>

            {result ? (
              <div className="meta-pill-row">
                <span className="meta-pill">{result.ingestor_used}</span>
                <span className="meta-pill">{result.strategy_used}</span>
              </div>
            ) : null}

            <div className="result-toolbar">
              <label className="field roadmap-filter">
                <span>Search / Filter Roadmap</span>
                <input
                  type="text"
                  value={roadmapFilter}
                  onChange={(event) => setRoadmapFilter(event.target.value)}
                  placeholder="Filter by skill, rationale, or resource"
                />
              </label>
              <div className="result-count">
                <span>Visible Nodes</span>
                <strong>{filteredResult?.nodes.length ?? 0}</strong>
              </div>
            </div>

            <RoadmapGraph edges={filteredResult?.edges ?? []} nodes={filteredResult?.nodes ?? []} />
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
