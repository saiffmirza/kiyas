import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import wordmark from "./assets/wordmark.png";
import wordmarkDark from "./assets/wordmark-dark.png";
import { TerminalPanel } from "./TerminalPanel";
import type {
  CaptureResponse,
  CompareResponse,
  DesktopProgressEvent,
  DoctorReport,
  OpenPort,
  ReportListItem,
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
  const [termOpen, setTermOpen] = useState(false);
  // pinned when the drawer opens — the shell's cwd doesn't follow repo selection
  const [termCwd, setTermCwd] = useState<string | undefined>(undefined);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const stored = localStorage.getItem("kiyas.theme");
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      // fall through to system preference
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("kiyas.theme", theme);
    } catch {
      // non-persistent storage — theme still applies for this session
    }
  }, [theme]);
  const [connectionsOpen, setConnectionsOpen] = useState(() => {
    try {
      return localStorage.getItem("kiyas.connectionsOpen") !== "0";
    } catch {
      return true;
    }
  });

  function toggleConnections() {
    setConnectionsOpen((open) => {
      try {
        localStorage.setItem("kiyas.connectionsOpen", open ? "0" : "1");
      } catch {
        // non-persistent storage (file:// page) — the toggle still works
      }
      return !open;
    });
  }

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
  const [history, setHistory] = useState<ReportListItem[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);

  const repo = repoState.selectedRepo ?? "";
  const targetUrl = selectedPort ? `http://localhost:${selectedPort}` : "";

  const refreshHistory = useCallback((repoPath: string) => {
    if (repoPath) window.kiyas.reportsList(repoPath).then(setHistory);
    else setHistory([]);
  }, []);

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
    refreshHistory(repo);
  }, [repo, refreshHistory]);

  useEffect(() => {
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
    if (phase === "error") {
      resultRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    if (phase === "done") refreshHistory(repo);
  }, [phase, repo, refreshHistory]);

  async function setupProvider(provider: "claude" | "codex" | "browsers") {
    const r = await window.kiyas.setupProvider(provider);
    const hint =
      provider === "browsers"
        ? "Chromium is downloading in Terminal — this updates when it finishes."
        : `Finish the ${provider === "claude" ? "Claude Code" : "Codex"} sign-in in Terminal — this updates when you come back.`;
    setSetupHint(r.ok ? hint : r.error ?? "Setup failed.");
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
  const hasDesign = designTab === "figma" ? Boolean(figmaUrl.trim()) : Boolean(designImage);
  const missingStep = !repo
    ? "add a project in the sidebar"
    : !targetUrl
      ? "pick a dev server port in the sidebar"
      : !hasDesign
        ? designTab === "figma"
          ? "paste a Figma link"
          : "choose a screenshot"
        : "";
  const canRun = !busy && !missingStep;

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

  function resetForNew() {
    setFigmaUrl("");
    setDesignImage("");
    setComponent("");
    setResult(null);
    setPreview(null);
    setSteps({});
    setStepMsgs({});
    setError("");
    setPreviewError("");
    setPhase("idle");
  }

  async function openPastReport(reportId: string) {
    const response = await window.kiyas.reportsOpen(repo, reportId);
    if (response.ok) {
      setResult(response);
      setPreview(null);
      setSteps({});
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
          <img
            src={theme === "dark" ? wordmarkDark : wordmark}
            alt="kiyas"
            className="brand-mark"
          />
        </div>

        <div className="side-section">
          <div className="side-heading">
            <span>Projects</span>
            <button
              className="side-add"
              title="Add a project folder"
              onClick={async () => setRepoState(await window.kiyas.reposAdd())}
            >
              +
            </button>
          </div>
          {repoState.repos.length === 0 && (
            <p className="side-empty">
              Add the repo that renders your UI — comparisons and reports live
              with it.
            </p>
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

        <div className="sidebar-bottom">
          <div className="side-section">
            <div className="side-heading">
              <span>Dev servers</span>
            </div>
            {ports.length === 0 && (
              <p className="side-empty">
                None running. Start one in your project, e.g. npm run dev.
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
            <div className="side-heading">
              <button className="side-toggle" onClick={toggleConnections}>
                <span>Connections</span>
                <span className={`caret${connectionsOpen ? " open" : ""}`}>
                  ▸
                </span>
              </button>
            </div>
            {connectionsOpen && doctor && (
              <ul className="env-list">
                <li>
                  Claude Code
                  {doctor.claude.ok ? (
                    <span className="env-tag">Connected</span>
                  ) : (
                    <button
                      className="env-cta"
                      onClick={() => setupProvider("claude")}
                    >
                      Set up
                    </button>
                  )}
                </li>
                <li>
                  Codex
                  {doctor.codex.ok ? (
                    <span className="env-tag">Connected</span>
                  ) : (
                    <button
                      className="env-cta"
                      onClick={() => setupProvider("codex")}
                    >
                      Set up
                    </button>
                  )}
                </li>
                <li>
                  Screenshot browser
                  {doctor.browsers.ok ? (
                    <span className="env-tag">Installed</span>
                  ) : (
                    <button
                      className="env-cta"
                      onClick={() => setupProvider("browsers")}
                    >
                      Install
                    </button>
                  )}
                </li>
                <li>
                  Figma token
                  {doctor.figmaToken.ok ? (
                    <span className="env-tag">Connected</span>
                  ) : (
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
            {connectionsOpen && setupHint && (
              <p className="side-hint">{setupHint}</p>
            )}
            <button
              className="terminal-btn"
              onClick={() =>
                setTermOpen((open) => {
                  if (!open) setTermCwd(repo || undefined);
                  return !open;
                })
              }
            >
              {termOpen
                ? "Close Terminal"
                : `Terminal${repo ? ` · ${basename(repo)}` : ""}`}
            </button>
          </div>
        </div>
      </aside>

      <main className={`main${termOpen ? " with-term" : ""}`}>
        <div className="main-scroll">
        <div className="main-drag">
          <div className="theme-switch">
            <button
              className={theme === "light" ? "active" : ""}
              title="Light mode"
              onClick={() => setTheme("light")}
            >
              ☀
            </button>
            <button
              className={theme === "dark" ? "active" : ""}
              title="Dark mode"
              onClick={() => setTheme("dark")}
            >
              ☾
            </button>
          </div>
        </div>
        {phase === "done" && result ? (
          <div className="main-inner focus">
            <section className="result-focus">
              <div className="result-head">
                <h2>Result</h2>
                <span className="context-chip">{result.modelLabel}</span>
                <p className="verdict-inline">
                  <strong>{result.summary.total}</strong>
                  {result.summary.total === 1
                    ? " discrepancy"
                    : " discrepancies"}
                  {result.summary.high > 0 && (
                    <em className="c-high">{result.summary.high} high</em>
                  )}
                  {result.summary.medium > 0 && (
                    <em className="c-medium">{result.summary.medium} medium</em>
                  )}
                  {result.summary.low > 0 && (
                    <em className="c-low">{result.summary.low} low</em>
                  )}
                </p>
                <span className="result-spacer" />
                <button
                  className="btn"
                  onClick={() => window.kiyas.openReport(result.reportPath)}
                >
                  Open in browser
                </button>
                <button className="btn primary" onClick={resetForNew}>
                  New comparison
                </button>
              </div>
              <iframe
                className="report-fill"
                title="Kiyas report"
                sandbox="allow-scripts allow-popups"
                srcDoc={result.reportHtml}
              />
            </section>
          </div>
        ) : (
        <div className="main-inner">
          {tokenPanelOpen && (
            <section className="card">
              <h2>Add your Figma token</h2>
              <p className="soft-note">
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
            </section>
          )}

          <section className="card compare-card">
            <div className="card-head">
              <h2>New comparison</h2>
              <span className="context-chips">
                {repo && <span className="context-chip">{basename(repo)}</span>}
                {targetUrl && (
                  <span className="context-chip mono">{targetUrl}</span>
                )}
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
              <label>
                Which component? <span className="hint">optional — AI finds it in the code</span>
              </label>
              <input
                type="text"
                value={component}
                placeholder='e.g. "the event header on the redemption screen"'
                onChange={(e) => setComponent(e.target.value)}
              />
            </div>

            <div className="run-row">
              <button className="btn primary" disabled={!canRun} onClick={run}>
                {phase === "capturing"
                  ? "Capturing…"
                  : phase === "comparing"
                    ? "Comparing…"
                    : "Compare"}
              </button>
              {!busy && missingStep && (
                <span className="run-hint">First, {missingStep}.</span>
              )}
            </div>
          </section>

          {phase === "idle" && (
            <section className="how-it-works">
              <h3>How it works</h3>
              <ol className="steps">
                <li className={repo && targetUrl ? "done" : "current"}>
                  <span className="diamond" />
                  Pick your project and its running dev server in the sidebar
                </li>
                <li
                  className={
                    !repo || !targetUrl
                      ? ""
                      : hasDesign
                        ? "done"
                        : "current"
                  }
                >
                  <span className="diamond" />
                  Paste a Figma frame link, or use a screenshot of the design
                </li>
                <li
                  className={repo && targetUrl && hasDesign ? "current" : ""}
                >
                  <span className="diamond" />
                  Compare — you approve the captured pair before any AI runs
                </li>
              </ol>
            </section>
          )}

          {phase === "idle" && history.length > 0 && (
            <section className="history">
              <h3>Recent comparisons · {basename(repo)}</h3>
              <ul className="history-list">
                {history.map((h) => (
                  <li key={h.reportId} onClick={() => openPastReport(h.reportId)}>
                    <span className="history-name">
                      {h.name || h.reportId.slice(0, 10).replace("_", " ")}
                    </span>
                    <span className="history-date">{h.date}</span>
                    <span className="history-counts">
                      {h.summary.high > 0 && (
                        <em className="c-high">{h.summary.high} high</em>
                      )}
                      {h.summary.medium > 0 && (
                        <em className="c-medium">{h.summary.medium} med</em>
                      )}
                      {h.summary.low > 0 && (
                        <em className="c-low">{h.summary.low} low</em>
                      )}
                      {h.summary.total === 0 && (
                        <em className="c-clean">clean</em>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(phase === "preview" || phase === "comparing") && preview && (
            <section className="card">
              <h2>Check the captures before comparing</h2>
              {preview.warning && (
                <div className="warning-box">{preview.warning}</div>
              )}
              {previewError && <div className="error-box">{previewError}</div>}
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
                <p className="soft-note">
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
                  onClick={() => {
                    window.kiyas.discardCapture();
                    setPhase("idle");
                  }}
                >
                  Start over
                </button>
              </div>
            </section>
          )}

          {phase !== "idle" && phase !== "error" && (
            <section className={`card progress-card${busy ? " busy" : ""}`}>
              <h2>{busy ? "Working…" : "Progress"}</h2>
              {busy && <div className="workbar" />}
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
            </section>
          )}

          <div ref={resultRef}>
            {phase === "error" && (
              <section className="card">
                <h2>Something went wrong</h2>
                <div className="error-box">{error}</div>
                <div className="actions">
                  <button className="btn" onClick={() => setPhase("idle")}>
                    Back
                  </button>
                </div>
              </section>
            )}

          </div>
        </div>
        )}
        </div>
        {termOpen && (
          <div className="term-drawer">
            <div className="term-bar">
              <span>Terminal{termCwd ? ` · ${basename(termCwd)}` : ""}</span>
              <button title="Close" onClick={() => setTermOpen(false)}>
                ×
              </button>
            </div>
            <TerminalPanel cwd={termCwd} dark={theme === "dark"} />
          </div>
        )}
      </main>
    </div>
  );
}
