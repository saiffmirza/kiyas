import { copyFile, mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { captureFigma } from "../capture/figma.js";
import { capturePlaywright } from "../capture/playwright.js";
import { generateHtmlReport } from "../report/html.js";
import { compareImages, type Discrepancy } from "./index.js";

export interface ProgressEvent {
  step: "figma" | "screenshot" | "compare" | "report";
  status: "start" | "done" | "fail";
  message?: string;
}

export interface RunComparisonParams {
  figmaUrl: string;
  targetUrl: string;
  model: "claude" | "openai";
  token: string;
  figmaToken: string;
  viewport: string;
  selector?: string;
  wait?: number;
  authState?: string;
  threshold: "all" | "medium" | "high";
  format: "html" | "json";
  name?: string;
  /** Where to persist the canonical report. Defaults to <cwd>/.kiyas/reports/<reportId>/. */
  reportsDir?: string;
  /** Optional explicit output path for a copy of the report (CLI uses this). */
  output?: string;
  onProgress?: (event: ProgressEvent) => void;
}

export interface ComparisonSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
}

export interface ComparisonResult {
  reportId: string;
  reportDir: string;
  reportPath: string;
  jsonPath: string;
  designImagePath: string;
  implImagePath: string;
  discrepancies: Discrepancy[];
  summary: ComparisonSummary;
  modelLabel: string;
  date: string;
}

export interface PersistedReport extends ComparisonResult {
  name?: string;
  figmaUrl: string;
  targetUrl: string;
}

function newReportId(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const rand = randomBytes(3).toString("hex");
  return `${ts}_${rand}`;
}

export function defaultReportsDir(cwd: string = process.cwd()): string {
  return join(cwd, ".kiyas", "reports");
}

export async function runComparison(
  params: RunComparisonParams
): Promise<PersistedReport> {
  const tempFiles: string[] = [];
  const progress = params.onProgress ?? (() => {});
  const reportId = newReportId();
  const reportsDir = params.reportsDir ?? defaultReportsDir();
  const reportDir = join(reportsDir, reportId);
  await mkdir(reportDir, { recursive: true });

  try {
    progress({ step: "figma", status: "start" });
    const figmaCapture = await captureFigma(params.figmaUrl, params.figmaToken);
    tempFiles.push(figmaCapture.imagePath);
    progress({ step: "figma", status: "done" });

    progress({
      step: "screenshot",
      status: "start",
      message: params.targetUrl,
    });
    const implPath = await capturePlaywright({
      url: params.targetUrl,
      viewport: params.viewport,
      selector: params.selector,
      wait: params.wait,
      authState: params.authState,
    });
    tempFiles.push(implPath);
    progress({ step: "screenshot", status: "done" });

    const modelLabel =
      params.model === "claude" ? "Claude Sonnet 4.6" : "GPT-4o";

    progress({ step: "compare", status: "start", message: modelLabel });
    let discrepancies: Discrepancy[];
    try {
      discrepancies = await compareImages({
        designPath: figmaCapture.imagePath,
        implPath,
        provider: params.model,
        token: params.token,
        metadata: figmaCapture.metadata,
      });
      progress({ step: "compare", status: "done", message: modelLabel });
    } catch (err) {
      progress({
        step: "compare",
        status: "fail",
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    const designDest = join(reportDir, "design.png");
    const implDest = join(reportDir, "impl.png");
    await copyFile(figmaCapture.imagePath, designDest);
    await copyFile(implPath, implDest);

    const reportPath = join(reportDir, "report.html");
    const jsonPath = join(reportDir, "discrepancies.json");
    const date = new Date().toISOString().split("T")[0];

    progress({ step: "report", status: "start" });
    const html = await generateHtmlReport({
      name: params.name,
      figmaUrl: params.figmaUrl,
      targetUrl: params.targetUrl,
      model: modelLabel,
      discrepancies,
      threshold: params.threshold,
      designImagePath: designDest,
      implImagePath: implDest,
    });
    await writeFile(reportPath, html, "utf-8");

    const summary: ComparisonSummary = {
      total: discrepancies.length,
      high: discrepancies.filter((d) => d.severity === "HIGH").length,
      medium: discrepancies.filter((d) => d.severity === "MEDIUM").length,
      low: discrepancies.filter((d) => d.severity === "LOW").length,
    };

    const persisted: PersistedReport = {
      reportId,
      reportDir,
      reportPath,
      jsonPath,
      designImagePath: designDest,
      implImagePath: implDest,
      discrepancies,
      summary,
      modelLabel,
      date,
      name: params.name,
      figmaUrl: params.figmaUrl,
      targetUrl: params.targetUrl,
    };

    await writeFile(
      jsonPath,
      JSON.stringify(
        {
          reportId,
          name: params.name,
          figmaUrl: params.figmaUrl,
          targetUrl: params.targetUrl,
          model: modelLabel,
          date,
          summary,
          discrepancies,
        },
        null,
        2
      ),
      "utf-8"
    );
    progress({ step: "report", status: "done" });

    if (params.output) {
      const ext = params.format === "json" ? "json" : "html";
      const outAbs = resolve(params.output);
      const content =
        params.format === "json"
          ? JSON.stringify(
              {
                reportId,
                name: params.name,
                figmaUrl: params.figmaUrl,
                targetUrl: params.targetUrl,
                model: modelLabel,
                date,
                summary,
                discrepancies,
              },
              null,
              2
            )
          : html;
      await writeFile(outAbs, content, "utf-8");
      void ext;
    }

    return persisted;
  } finally {
    for (const f of tempFiles) {
      try {
        await unlink(f);
      } catch {
        // ignore
      }
    }
  }
}

export interface LoadedReport {
  reportId: string;
  name?: string;
  figmaUrl: string;
  targetUrl: string;
  model: string;
  date: string;
  summary: ComparisonSummary;
  discrepancies: Discrepancy[];
  reportDir: string;
  reportPath: string;
  jsonPath: string;
}

export async function loadReport(
  reportId: string,
  reportsDir: string = defaultReportsDir()
): Promise<LoadedReport> {
  const reportDir = join(reportsDir, reportId);
  const jsonPath = join(reportDir, "discrepancies.json");
  const reportPath = join(reportDir, "report.html");

  if (!existsSync(jsonPath)) {
    throw new Error(
      `Report "${reportId}" not found at ${jsonPath}. Run \`compare\` first.`
    );
  }

  const raw = await readFile(jsonPath, "utf-8");
  const parsed = JSON.parse(raw) as {
    reportId: string;
    name?: string;
    figmaUrl: string;
    targetUrl: string;
    model: string;
    date: string;
    summary: ComparisonSummary;
    discrepancies: Discrepancy[];
  };

  return {
    ...parsed,
    reportDir,
    reportPath,
    jsonPath,
  };
}
