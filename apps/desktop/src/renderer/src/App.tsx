import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CaptureResponse,
  CompareResponse,
  DesktopProgressEvent,
  DoctorReport,
  OpenPort,
  RepoState,
} from "../../shared/types";

type StepId = "figma" | "resolve" | "screenshot" | "compare" | "report";
type StepState = "pending" | "active" | "done" | "fail";

const STEP_LABELS: Record<StepId, string> = {
  figma: "Exporting the design from Figma",
  resolve: "Finding the component in the codebase",
  screenshot: "Screenshotting the rendered component",
  compare: "Comparing design vs implementation",
  report: "Writing the report",
};

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

export function App() {
  // --- sidebar state ---
  const [repoState, setRepoState] = useState<RepoState>({ repos: [] });
  const [ports, setPorts] = useState<OpenPort[]>([]);
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [doctor, setDoctor] = useState<DoctorReport | null>(null);
  const [setupHint, setSetupHint] = useState("");
  const [tokenPanelOpen, setTokenPanelOpen] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [tokenSaving, setTokenSaving] = useState(false);

  // --- compare state ---
  const [designTab, setDesignTab] = useState<"figma" | "image">("figma");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [designImage, setDesignImage] = useState("");
  const [component, setComponent] = useState("");
  const [phase, setPhase] = useState<
    "idle" | "capturing" | "preview" | "comparing" | "done" | "error"
  >("idle");
  const [preview, setPreview] = useState<
    (CaptureResponse & { ok: true }) | null
  >(null);
  const [previewError, setPreviewError] = useState("");
  const [steps, setSteps] = useState<Partial<Record<StepId, StepState>>>({});
  const [stepMsgs, setStepMsgs] = useState<Partial<Record<StepId, string>>>({});
  const [result, setResult] = useState<
    (CompareResponse & { ok: true }) | null
  >(null);
  const [error, setError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  const repo = repoState.selectedRepo ?? "";
  const targetUrl = selectedPort ? `http://localhost:${selectedPort}` : "";

  useEffect(() => {
    window.kiyas.reposLoad().then(setRepoState);
    const refresh = () => {
      window.kiyas.doctor().then(setDoctor);
      window.kiyas.portsList().then(setPorts);
    };
    refresh();
    window.addEventListener("focus", refresh);
    const interval = setInterval(
      () => window.kiyas.portsList().then(setPorts),
      10_000
    );
    return () => {
      window.removeEventListener("focus", refresh);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // keep the selection valid as ports come and go
    if (selectedPort && !ports.some((p) => p.port === selectedPort)) {
      setSelectedPort(null);
    } else if (!selectedPort && ports.length === 1) {
      setSelectedPort(ports[0].port);
    }
  }, [ports, selectedPort]);

  useEffect(() => {
    return window.kiyas.onProgress((event: DesktopProgressEvent) => {
      const state: StepState =
        event.status === "start"
          ? "active"
          : event.status === "done"
            ? "done"
            : "fail";
      setSteps((s) => ({ ...s, [event.step]: state }));
      if (event.message) {
        setStepMsgs((m) => ({ ...m, [event.step]: event.message }));
      }
    });
  }, []);

  useEffect(() => {
    if (phase === "done" || phase === "error") {
      resultRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [phase]);

  async function setupProvider(provider: "claude" | "codex") {
    const label = provider === "claude" ? "Claude Code" : "Codex";
    const r = await window.kiyas.setupProvider(provider);
    setSetupHint(
      r.ok
        ? `Finish the ${label} sign-in in Terminal — this updates when you come back.`
        : r.error ?? "Setup failed."
    );
  }

  async function saveToken() {
    setTokenSaving(true);
    setTokenError("");
    const r = await window.kiyas.saveFigmaToken(tokenValue);
    setTokenSaving(false);
    if (r.ok) {
      setTokenPanelOpen(false);
      setTokenValue("");
      window.kiyas.doctor().then(setDoctor);
    } else {
      setTokenError(r.error ?? "Could not save the token.");
    }
  }

  const visibleSteps = useMemo(() => {
    const ids: StepId[] = [];
    if (designTab === "figma") ids.push("figma");
    if (component.trim()) ids.push("resolve");
    ids.push("screenshot", "compare", "report");
    return ids;
  }, [component, designTab]);

  const busy = phase === "capturing" || phase === "comparing";
  const canRun =
    !busy &&
    repo &&
    targetUrl &&
    (designTab === "figma" ? figmaUrl.trim() : designImage);

  async function run() {
    setPhase("capturing");
    setResult(null);
    setPreview(null);
    setError("");
    setPreviewError("");
    setSteps({});
    setStepMsgs({});

    const response = await window.kiyas.capture({
      repo,
      figmaUrl: designTab === "figma" ? figmaUrl.trim() : undefined,
      designImage: designTab === "image" ? designImage : undefined,
      targetUrl,
      component: component.trim() || undefined,
      viewport: "1440x900",
      threshold: "all",
    });

    if (response.ok) {
      setPreview(response);
      setPhase("preview");
    } else {
      setError(response.error);
      setPhase("error");
    }
  }

  async function confirmCompare() {
    setPhase("comparing");
    const response = await window.kiyas.compareConfirmed();
    if (response.ok) {
      setResult(response);
      setPhase("done");
    } else {
      setError(response.error);
      setPhase("error");
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-word">kiyas</span>
          <span className="brand-arabic">كياس</span>
        </div>

        <div className="side-section">
          <div className="side-heading">
            <span>Repos</span>
            <button
              className="side-add"
              title="Add a project folder"
              onClick={async () => setRepoState(await window.kiyas.reposAdd())}
            >
              +
            </button>
          </div>
          {repoState.repos.length === 0 && (
            <p className="side-empty">Add the repo that renders your UI.</p>
          )}
          <ul className="repo-list">
            {repoState.repos.map((path) => (
              <li
                key={path}
                className={path === repo ? "selected" : ""}
                title={path}
                onClick={async () =>
                  setRepoState(await window.kiyas.reposSelect(path))
                }
              >
                <span className="repo-name">{basename(path)}</span>
                <button
                  className="repo-remove"
                  title="Remove from list"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setRepoState(await window.kiyas.reposRemove(path));
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="side-section">
          <div className="side-heading">
            <span>Open ports</span>
          </div>
          {ports.length === 0 && (
            <p className="side-empty">
              No dev servers detected. Start one, e.g. npm run dev.
            </p>
          )}
          <ul className="port-list">
            {ports.map((p) => (
              <li
                key={p.port}
                className={p.port === selectedPort ? "selected" : ""}
                onClick={() => setSelectedPort(p.port)}
              >
                <span className="port-dot" />
                <span className="port-num">:{p.port}</span>
                <span className="port-proc">{p.process}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-footer">
          {doctor && (
            <ul className="env-list">
              <li>
                <span className={`env-dot ${doctor.claude.ok ? "ok" : ""}`} />
                Claude Code
                {!doctor.claude.ok && (
                  <button
                    className="env-cta"
                    onClick={() => setupProvider("claude")}
                  >
                    Set up
                  </button>
                )}
              </li>
              <li>
                <span className={`env-dot ${doctor.codex.ok ? "ok" : ""}`} />
                Codex
                {!doctor.codex.ok && (
                  <button
                    className="env-cta"
                    onClick={() => setupProvider("codex")}
                  >
                    Set up
                  </button>
                )}
              </li>
              <li>
                <span
                  className={`env-dot ${doctor.figmaToken.ok ? "ok" : ""}`}
                />
                Figma token
                {!doctor.figmaToken.ok && (
                  <button
                    className="env-cta"
                    onClick={() => {
                      setTokenPanelOpen((open) => !open);
                      setSetupHint("");
                    }}
                  >
                    Add
                  </button>
                )}
              </li>
            </ul>
          )}
          {setupHint && <p className="side-hint">{setupHint}</p>}
          <button
            className="terminal-btn"
            onClick={() => window.kiyas.openTerminal(repo || undefined)}
          >
            ⌘ Open Terminal{repo ? ` · ${basename(repo)}` : ""}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="main-drag" />
        <div className="main-inner">
          {tokenPanelOpen && (
            <div className="card">
              <h2>Add your Figma token</h2>
              <p className="preview-meta" style={{ marginTop: 0, marginBottom: 12 }}>
                In Figma: avatar → Settings → Security → Personal access
                tokens. Read-only File content scope is enough — kiyas never
                modifies your designs.
              </p>
              <div className="row">
                <div className="grow">
                  <input
                    type="text"
                    value={tokenValue}
                    placeholder="figd_…"
                    onChange={(e) => setTokenValue(e.target.value)}
                  />
                </div>
                <button
                  className="btn"
                  onClick={() => window.kiyas.openFigmaSettings()}
                >
                  Open Figma settings
                </button>
                <button
                  className="btn primary"
                  disabled={tokenSaving || !tokenValue.trim()}
                  onClick={saveToken}
                >
                  {tokenSaving ? "Checking…" : "Save"}
                </button>
              </div>
              {tokenError && (
                <div className="error-box" style={{ marginTop: 12 }}>
                  {tokenError}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <h2>Compare</h2>
              <span className="context-line">
                {repo ? basename(repo) : "no repo"}
                {" · "}
                {targetUrl || "no dev server selected"}
              </span>
            </div>

            <div className="tabs">
              <button
                className={designTab === "figma" ? "active" : ""}
                onClick={() => setDesignTab("figma")}
              >
                Figma link
              </button>
              <button
                className={designTab === "image" ? "active" : ""}
                onClick={() => setDesignTab("image")}
              >
                Screenshot
              </button>
            </div>
            {designTab === "figma" ? (
              <div className="field">
                <input
                  type="text"
                  value={figmaUrl}
                  placeholder="https://www.figma.com/design/…?node-id=…"
                  onChange={(e) => setFigmaUrl(e.target.value)}
                />
              </div>
            ) : (
              <div className="row" style={{ marginBottom: 16 }}>
                <button
                  className="btn"
                  onClick={async () => {
                    const picked = await window.kiyas.pickImage();
                    if (picked) setDesignImage(picked);
                  }}
                >
                  Choose image…
                </button>
                <span className="pathpill grow">
                  {designImage || "No image selected"}
                </span>
              </div>
            )}

            <div className="field">
              <input
                type="text"
                value={component}
                placeholder='Which component? e.g. "the event header on the redemption screen" (optional — AI finds it)'
                onChange={(e) => setComponent(e.target.value)}
              />
            </div>

            <button className="btn primary" disabled={!canRun} onClick={run}>
              {phase === "capturing"
                ? "Capturing…"
                : phase === "comparing"
                  ? "Comparing…"
                  : "Compare"}
            </button>
          </div>

          {phase !== "idle" && (
            <div className="card">
              <h2>Progress</h2>
              <ul className="progress">
                {visibleSteps.map((id) => {
                  const state = steps[id] ?? "pending";
                  return (
                    <li key={id} className={state}>
                      <span className="icon">
                        {state === "done" ? "✓" : state === "fail" ? "✕" : "•"}
                      </span>
                      <span>{STEP_LABELS[id]}</span>
                      {stepMsgs[id] && (
                        <span className="msg">{stepMsgs[id]}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {(phase === "preview" || phase === "comparing") && preview && (
            <div className="card">
              <h2>Check the captures before comparing</h2>
              {preview.warning && (
                <div className="warning-box">{preview.warning}</div>
              )}
              {previewError && (
                <div className="error-box">{previewError}</div>
              )}
              <div className="preview-grid">
                <div className="preview-col">
                  <div className="preview-label">
                    Design · {preview.designSize.width}×
                    {preview.designSize.height}
                  </div>
                  <img src={preview.designPng} alt="Design capture" />
                </div>
                <div className="preview-col">
                  <div className="preview-label">
                    Implementation · {preview.implSize.width}×
                    {preview.implSize.height}
                  </div>
                  <img src={preview.implPng} alt="Implementation capture" />
                </div>
              </div>
              {preview.resolved && (
                <p className="preview-meta">
                  Matched {preview.resolved.filePath}
                  {preview.selector ? ` · selector ${preview.selector}` : ""}
                </p>
              )}
              <div className="actions">
                <button
                  className="btn primary"
                  disabled={phase === "comparing"}
                  onClick={confirmCompare}
                >
                  {phase === "comparing"
                    ? "Comparing…"
                    : "These match — compare"}
                </button>
                <button
                  className="btn"
                  disabled={phase === "comparing"}
                  onClick={async () => {
                    setPreviewError("");
                    try {
                      const r = await window.kiyas.cropImpl();
                      if (r.ok) {
                        setPreview((p) =>
                          p
                            ? {
                                ...p,
                                implPng: r.implPng,
                                implSize: r.implSize,
                                warning: r.warning,
                              }
                            : p
                        );
                      } else {
                        setPreviewError(`Crop failed: ${r.error}`);
                      }
                    } catch (err) {
                      setPreviewError(
                        `Crop failed: ${err instanceof Error ? err.message : String(err)}`
                      );
                    }
                  }}
                >
                  Crop to design shape
                </button>
                <button
                  className="btn"
                  disabled={phase === "comparing"}
                  onClick={() => setPhase("idle")}
                >
                  Start over
                </button>
              </div>
            </div>
          )}

          <div ref={resultRef}>
            {phase === "error" && (
              <div className="card">
                <h2>Something went wrong</h2>
                <div className="error-box">{error}</div>
              </div>
            )}

            {phase === "done" && result && (
              <div className="card">
                <h2>Result · {result.modelLabel}</h2>
                <div className="summary">
                  <div className="stat">
                    <div className="num">{result.summary.total}</div>
                    <div className="label">Findings</div>
                  </div>
                  <div className="stat high">
                    <div className="num">{result.summary.high}</div>
                    <div className="label">High</div>
                  </div>
                  <div className="stat medium">
                    <div className="num">{result.summary.medium}</div>
                    <div className="label">Medium</div>
                  </div>
                  <div className="stat low">
                    <div className="num">{result.summary.low}</div>
                    <div className="label">Low</div>
                  </div>
                </div>
                <iframe
                  className="report-frame"
                  title="Kiyas report"
                  srcDoc={result.reportHtml}
                />
                <div className="actions">
                  <button
                    className="btn"
                    onClick={() => window.kiyas.openReport(result.reportPath)}
                  >
                    Open in browser
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
