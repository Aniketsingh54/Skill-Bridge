import { ChangeEvent, useEffect, useState } from "react";

import RoadmapGraph from "./components/RoadmapGraph";
import { buildRoadmapEmail } from "./utils/emailReport";

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
  source_type: "raw_text" | "pdf_object";
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
type InputType = "raw_text" | "pdf_object";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const API_URL = `${API_BASE_URL}/api/analyze`;
const EMAIL_API_URL = `${API_BASE_URL}/api/send-email`;
const SAMPLE_DATA_URL = `${API_BASE_URL}/api/sample-data`;
const MAX_TIME_BUDGET_WEEKS = 104;
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
  const [sourceType, setSourceType] = useState<InputType>("raw_text");
  const [sourceText, setSourceText] = useState("");
  const [targetJob, setTargetJob] = useState("");
  const [targetType, setTargetType] = useState<InputType>("raw_text");
  const [jobId, setJobId] = useState("");
  const [timeBudgetWeeks, setTimeBudgetWeeks] = useState(8);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [targetPdfFile, setTargetPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [sampleData, setSampleData] = useState<SampleData | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [roadmapFilter, setRoadmapFilter] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "open" | "sending" | "sent" | "error">("idle");
  const [emailError, setEmailError] = useState("");

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

  const getTimeBudgetError = (weeks: number) => {
    if (!Number.isInteger(weeks) || weeks < 1) {
      return "Time budget must be at least 1 week.";
    }

    if (weeks > MAX_TIME_BUDGET_WEEKS) {
      return `Time budget cannot exceed ${MAX_TIME_BUDGET_WEEKS} weeks.`;
    }

    return "";
  };

  const handleSourceFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setPdfFile(nextFile);
    setResult(null);
    setError("");
  };

  const handleTargetFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setTargetPdfFile(nextFile);
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
    const timeBudgetError = getTimeBudgetError(timeBudgetWeeks);
    if (timeBudgetError) {
      setError(timeBudgetError);
      setScreen("profile");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const normalizedTargetJob =
        targetType === "raw_text"
          ? jobId.trim()
            ? `Job ID: ${jobId.trim()}\n\n${targetJob}`
            : targetJob
          : "";

      const payload: Record<string, unknown> = {
        source_type: sourceType,
        target_type: targetType,
        source_text: sourceType === "raw_text" ? sourceText : "",
        target_job: normalizedTargetJob,
        time_budget_weeks: timeBudgetWeeks,
      };

      if (sourceType === "pdf_object") {
        if (!pdfFile) {
          throw new Error("Please choose a PDF object before generating the roadmap.");
        }

        payload.source_file_base64 = await toBase64(pdfFile);
      } else if (!sourceText.trim()) {
        throw new Error("Please paste a source profile before generating the roadmap.");
      }

      if (!targetJob.trim()) {
        if (targetType === "raw_text") {
          throw new Error("Please paste a target job description.");
        }
      }

      if (targetType === "pdf_object") {
        if (!targetPdfFile) {
          throw new Error("Please choose a PDF job description before generating the roadmap.");
        }

        payload.target_file_base64 = await toBase64(targetPdfFile);
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

  const handleSendEmail = async () => {
    if (!emailInput.trim() || !result) return;
    setEmailStatus("sending");
    setEmailError("");
    try {
      const roleLabel = targetJob.slice(0, 120);
      const htmlBody = buildRoadmapEmail(result.nodes, result.edges, roleLabel);
      const res = await fetch(EMAIL_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput.trim(),
          subject: `Your Career Roadmap → ${roleLabel || "your target role"}`,
          html_body: htmlBody,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { detail?: string };
        throw new Error(data.detail ?? "Failed to send email.");
      }
      setEmailStatus("sent");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Something went wrong.");
      setEmailStatus("error");
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
    setTargetType("raw_text");
    setJobId(job.id);
    setTargetJob(job.job_text);
    setTargetPdfFile(null);
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
    const timeBudgetError = getTimeBudgetError(timeBudgetWeeks);
    if (timeBudgetError) {
      setError(timeBudgetError);
      return;
    }

    if (sourceType === "raw_text" && !sourceText.trim()) {
      setError("Add the user profile first so we know the current state.");
      return;
    }

    if (sourceType === "pdf_object" && !pdfFile) {
      setError("Upload a PDF object before moving to the target role.");
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
                    <p>Profile text or an uploaded PDF object.</p>
                  </div>
                </div>

                <div className="field-row">
                  <label className="field">
                    <span>Input Type</span>
                    <select value={sourceType} onChange={(event) => setSourceType(event.target.value as InputType)}>
                      <option value="raw_text">Paste profile text</option>
                      <option value="pdf_object">Attach PDF object</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Time Budget</span>
                    <input
                      min={1}
                      max={MAX_TIME_BUDGET_WEEKS}
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
                    <span className="upload-title">Attach PDF Object</span>
                    <span className="upload-copy">
                      Upload a PDF and let the ingestion layer pull out the meaningful text.
                    </span>
                    <input accept="application/pdf" onChange={handleSourceFileChange} type="file" />
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
                    <span>Target Input</span>
                    <select value={targetType} onChange={(event) => setTargetType(event.target.value as InputType)}>
                      <option value="raw_text">Paste job text</option>
                      <option value="pdf_object">Attach JD PDF</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Job ID</span>
                    <input
                      type="text"
                      value={jobId}
                      onChange={(event) => setJobId(event.target.value)}
                      placeholder="backend-engineer-01"
                    />
                  </label>

                </div>

                <div className="field-row">
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

                {targetType === "raw_text" ? (
                  <label className="field">
                    <span>Target Job Text</span>
                    <textarea
                      value={targetJob}
                      onChange={(event) => setTargetJob(event.target.value)}
                      placeholder="Paste the target job description or role brief."
                      rows={14}
                    />
                  </label>
                ) : (
                  <label className="upload-card">
                    <span className="upload-title">Attach Job Description</span>
                    <span className="upload-copy">
                      Upload a PDF job description and let the ingestion layer extract the role details.
                    </span>
                    <input accept="application/pdf" onChange={handleTargetFileChange} type="file" />
                    <strong>{targetPdfFile ? targetPdfFile.name : "No file chosen yet"}</strong>
                  </label>
                )}
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
                <button
                  className="secondary-button email-trigger-btn"
                  onClick={() => {
                    setEmailStatus(emailStatus === "open" ? "idle" : "open");
                    setEmailError("");
                  }}
                  type="button"
                >
                  {emailStatus === "sent" ? "✓ Sent!" : "📧 Send to my Email"}
                </button>
              </div>
            </div>

            {/* Inline email capture form */}
            {(emailStatus === "open" || emailStatus === "sending" || emailStatus === "error") && (
              <div className="email-form">
                <input
                  className="email-form__input"
                  type="email"
                  placeholder="your@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleSendEmail()}
                  disabled={emailStatus === "sending"}
                />
                <button
                  className="primary-button email-form__send"
                  type="button"
                  disabled={emailStatus === "sending" || !emailInput.trim()}
                  onClick={() => void handleSendEmail()}
                >
                  {emailStatus === "sending" ? "Sending…" : "Send Report"}
                </button>
                {emailError && <p className="error-banner email-form__error">{emailError}</p>}
              </div>
            )}

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

            {/* Responsible AI disclaimer */}
            <p className="ai-disclaimer">
              ⚠️ This roadmap is AI-generated and may reflect biases in training data. It is a
              starting point — not professional career advice. Review each node, verify resources,
              and consult a mentor before making major decisions.
            </p>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
