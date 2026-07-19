import { copyFile, mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { captureFigma, type FigmaNodeMetadata } from "../capture/figma.js";
import { capturePlaywright } from "../capture/playwright.js";
import { generateHtmlReport } from "../report/html.js";
import { compareImages, parseDiscrepancies, type Discrepancy } from "./index.js";
import { voteOnFindings } from "./ensemble.js";
import { buildComparisonPrompt } from "./prompt.js";
import { generateComparisonName } from "./name.js";
import { readPngSize } from "../utils/png-size.js";
import { VERSION } from "../version.js";

const execFileAsync = promisify(execFile);

export interface ProgressEvent {
  step: "figma" | "screenshot" | "compare" | "report";
  status: "start" | "done" | "fail";
  message?: string;
}

export interface RunComparisonParams {
  /** Figma frame URL. Provide either this or `designImage`. */
  figmaUrl?: string;
  /** Local path, http(s) URL, or base64 data: URI of a design image. Skips the Figma export. */
  designImage?: string;
  /** Path to an already-captured implementation screenshot. Skips the Playwright capture. */
  implImage?: string;
  /** Figma node metadata to include in the comparison prompt when `designImage` came from a prior Figma export. */
  figmaMetadata?: FigmaNodeMetadata;
  targetUrl: string;
  model: "claude" | "openai";
  /** Model ID/alias to pin the provider CLI to. */
  aiModel?: string;
  /** Number of independent comparison runs; findings surviving a majority vote are kept. Default 1. */
  runs?: number;
  /** How --component resolution mapped the description, for the manifest. */
  resolved?: { filePath: string; url: string; selector?: string };
  figmaToken?: string;
  viewport: string;
  selector?: string;
  wait?: number;
  /**
   * Export/render scale applied to BOTH the Figma export and the screenshot.
   * Default is adaptive: 2 for component-sized captures (selector given, or
   * viewport long side ≤ 1000px), 1 otherwise — 2x recovers subtle-detail
   * recall but large captures get downscaled by the vision model anyway.
   */
  scale?: number;
  /** Full-page screenshot when no selector (default true). */
  fullPage?: boolean;
  /** Emulated prefers-color-scheme for the implementation capture. */
  colorScheme?: "light" | "dark";
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
  /** Findings at or above the run's severity threshold. */
  aboveThreshold: number;
}

export interface RunManifest {
  viewport: string;
  selector?: string;
  wait?: number;
  scale: number;
  fullPage: boolean;
  threshold: string;
  colorScheme?: "light" | "dark";
  provider: "claude" | "openai";
  aiModel?: string;
  runs: number;
  kiyasVersion: string;
  cliVersion?: string;
  promptVersion: string;
  metadataIncluded: boolean;
  designSource: "figma" | "image";
  resolved?: { filePath: string; url: string; selector?: string };
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
  /** Set when the design/implementation captures look like different regions. */
  captureWarning?: string;
}

export interface PersistedReport extends ComparisonResult {
  name?: string;
  figmaUrl?: string;
  designImage?: string;
  targetUrl: string;
  manifest: RunManifest;
}

function defaultScale(viewport: string, selector?: string): number {
  if (selector) return 2;
  const match = viewport.match(/^(\d+)x(\d+)$/);
  if (!match) return 1;
  const longSide = Math.max(parseInt(match[1], 10), parseInt(match[2], 10));
  return longSide <= 1000 ? 2 : 1;
}

/**
 * macOS screenshots are tagged Display P3; the comparison model reads raw
 * pixel values, so the same color decodes differently between a P3 design and
 * an sRGB browser capture. Convert to sRGB where the OS tooling exists.
 */
async function normalizeToSrgb(
  path: string,
  outDir: string,
  tempFiles: string[]
): Promise<string> {
  if (process.platform !== "darwin") return path;
  try {
    const { stdout } = await execFileAsync("sips", ["-g", "profile", path], {
      timeout: 5000,
    });
    if (/sRGB/i.test(stdout)) return path;
    const out = join(outDir, "design-srgb.png");
    await execFileAsync(
      "sips",
      [
        "--matchTo",
        "/System/Library/ColorSync/Profiles/sRGB Profile.icc",
        path,
        "--out",
        out,
      ],
      { timeout: 15000 }
    );
    tempFiles.push(out);
    return out;
  } catch {
    return path;
  }
}

async function cliVersion(
  provider: "claude" | "openai"
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      provider === "claude" ? "claude" : "codex",
      ["--version"],
      { timeout: 5000 }
    );
    return stdout.trim();
  } catch {
    return undefined;
  }
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

/**
 * Sanity check that two captures plausibly show the same component.
 * Returns a human-readable warning when the implementation capture is a tiny
 * sliver or its aspect ratio is wildly different from the design's — the
 * classic symptom of a wrong selector (e.g. a bare `h1` instead of the card
 * that contains it).
 */
export async function captureMismatchWarning(
  designPath: string,
  implPath: string
): Promise<string | undefined> {
  const [design, impl] = await Promise.all([
    readPngSize(designPath),
    readPngSize(implPath),
  ]);
  if (!design || !impl) return undefined;

  if (impl.width < 80 || impl.height < 80) {
    return `Implementation capture is only ${impl.width}×${impl.height}px — the selector likely matched a single element inside the component instead of the component itself.`;
  }

  const ratio =
    design.width / design.height / (impl.width / impl.height);
  if (ratio > 2.5 || ratio < 0.4) {
    return `Capture shapes differ a lot (design ${design.width}×${design.height}, implementation ${impl.width}×${impl.height}) — the screenshot may not cover the same region as the design.`;
  }

  return undefined;
}

export function defaultReportsDir(cwd: string = process.cwd()): string {
  return join(cwd, ".kiyas", "reports");
}

// AI CLI subprocesses fail transiently (rate limits, API blips); one retry
// absorbs most of those without redoing the capture work. A missing CLI
// can't succeed on retry, so fail fast there.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found on PATH/.test(message)) {
      throw err;
    }
    await new Promise((r) => setTimeout(r, 2000));
    return fn();
  }
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
  const scale =
    params.scale ?? defaultScale(params.viewport, params.selector);

  try {
    let designPath: string;
    let metadata: FigmaNodeMetadata | undefined = params.figmaMetadata;

    if (params.designImage) {
      if (params.designImage.startsWith("data:")) {
        const match = params.designImage.match(
          /^data:image\/[\w.+-]+;base64,(.+)$/s
        );
        if (!match) {
          throw new Error(
            "Unsupported data: URI for design image — expected base64-encoded image data (data:image/...;base64,...)."
          );
        }
        designPath = join(reportDir, "design-source.png");
        await writeFile(designPath, Buffer.from(match[1], "base64"));
        tempFiles.push(designPath);
      } else if (/^https?:\/\//i.test(params.designImage)) {
        const res = await fetch(params.designImage);
        if (!res.ok) {
          throw new Error(
            `Failed to download design image (HTTP ${res.status}): ${params.designImage}`
          );
        }
        designPath = join(reportDir, "design-source.png");
        await writeFile(designPath, Buffer.from(await res.arrayBuffer()));
        tempFiles.push(designPath);
      } else {
        designPath = resolve(params.designImage);
        if (!existsSync(designPath)) {
          throw new Error(`Design image not found: ${designPath}`);
        }
      }
    } else {
      if (!params.figmaUrl || !params.figmaToken) {
        throw new Error("Provide either `figmaUrl` (with a Figma token) or `designImage`.");
      }
      progress({ step: "figma", status: "start" });
      const figmaCapture = await captureFigma(
        params.figmaUrl,
        params.figmaToken,
        scale
      );
      tempFiles.push(figmaCapture.imagePath);
      designPath = figmaCapture.imagePath;
      metadata = figmaCapture.metadata;
      progress({ step: "figma", status: "done" });
    }

    designPath = await normalizeToSrgb(designPath, reportDir, tempFiles);

    let implPath: string;
    if (params.implImage) {
      const source = resolve(params.implImage);
      if (!existsSync(source)) {
        throw new Error(`Implementation image not found: ${source}`);
      }
      implPath = join(reportDir, "impl.png");
      await copyFile(source, implPath);
    } else {
      progress({
        step: "screenshot",
        status: "start",
        message: params.targetUrl,
      });
      implPath = await capturePlaywright({
        url: params.targetUrl,
        outputPath: join(reportDir, "impl.png"),
        viewport: params.viewport,
        selector: params.selector,
        wait: params.wait,
        scale,
        fullPage: params.fullPage,
        colorScheme: params.colorScheme,
        authState: params.authState,
      });
      progress({ step: "screenshot", status: "done" });
    }

    const captureWarning = await captureMismatchWarning(designPath, implPath);
    if (captureWarning) {
      progress({ step: "screenshot", status: "done", message: captureWarning });
    }

    const modelLabel =
      (params.model === "claude" ? "Claude Code" : "Codex") +
      (params.aiModel ? ` (${params.aiModel})` : "");

    progress({ step: "compare", status: "start", message: modelLabel });
    const runCount = Math.max(1, params.runs ?? 1);
    let discrepancies: Discrepancy[];
    try {
      const compareOptions = {
        designPath,
        implPath,
        provider: params.model,
        modelId: params.aiModel,
        metadata,
      };
      if (runCount === 1) {
        discrepancies = await withRetry(() => compareImages(compareOptions));
      } else {
        const results = await Promise.all(
          Array.from({ length: runCount }, () =>
            withRetry(() => compareImages(compareOptions))
          )
        );
        discrepancies = voteOnFindings(results);
      }
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
    const implDest = implPath;
    await copyFile(designPath, designDest);

    const reportPath = join(reportDir, "report.html");
    const jsonPath = join(reportDir, "discrepancies.json");
    const date = new Date().toISOString().split("T")[0];

    progress({ step: "report", status: "start" });
    const name =
      params.name ??
      (await generateComparisonName(
        params.model,
        {
          figmaUrl: params.figmaUrl,
          designImage: params.designImage,
          targetUrl: params.targetUrl,
          selector: params.selector,
          componentFile: params.resolved?.filePath,
          discrepancies,
        },
        params.aiModel
      ));
    const html = await generateHtmlReport({
      name,
      designSource: params.figmaUrl ?? designPath,
      targetUrl: params.targetUrl,
      model: modelLabel,
      discrepancies,
      threshold: params.threshold,
      designImagePath: designDest,
      implImagePath: implDest,
    });
    await writeFile(reportPath, html, "utf-8");

    const high = discrepancies.filter((d) => d.severity === "HIGH").length;
    const medium = discrepancies.filter((d) => d.severity === "MEDIUM").length;
    const low = discrepancies.filter((d) => d.severity === "LOW").length;
    const summary: ComparisonSummary = {
      total: discrepancies.length,
      high,
      medium,
      low,
      aboveThreshold:
        params.threshold === "high"
          ? high
          : params.threshold === "medium"
            ? high + medium
            : discrepancies.length,
    };

    const manifest: RunManifest = {
      viewport: params.viewport,
      selector: params.selector,
      wait: params.wait,
      scale,
      fullPage: params.fullPage ?? !params.selector,
      threshold: params.threshold,
      colorScheme: params.colorScheme,
      provider: params.model,
      aiModel: params.aiModel,
      runs: runCount,
      kiyasVersion: VERSION,
      cliVersion: await cliVersion(params.model),
      promptVersion: createHash("sha256")
        .update(buildComparisonPrompt())
        .digest("hex")
        .slice(0, 12),
      metadataIncluded: metadata !== undefined,
      designSource: params.figmaUrl ? "figma" : "image",
      resolved: params.resolved,
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
      captureWarning,
      name,
      figmaUrl: params.figmaUrl,
      designImage: params.designImage?.startsWith("data:")
        ? designDest
        : params.designImage,
      targetUrl: params.targetUrl,
      manifest,
    };

    await writeFile(
      jsonPath,
      JSON.stringify(
        {
          reportId,
          name,
          figmaUrl: params.figmaUrl,
          designImage: params.designImage,
          targetUrl: params.targetUrl,
          model: modelLabel,
          date,
          summary,
          manifest,
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
                name,
                figmaUrl: params.figmaUrl,
                designImage: params.designImage,
                targetUrl: params.targetUrl,
                model: modelLabel,
                date,
                summary,
                manifest,
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
  } catch (err) {
    const detail =
      err instanceof Error ? (err.stack ?? err.message) : String(err);
    try {
      await writeFile(join(reportDir, "error.log"), `${detail}\n`, "utf-8");
    } catch {
      // best-effort diagnostics
    }
    throw err;
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
  figmaUrl?: string;
  designImage?: string;
  targetUrl: string;
  model: string;
  date: string;
  summary: ComparisonSummary;
  discrepancies: Discrepancy[];
  manifest?: RunManifest;
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
    figmaUrl?: string;
    designImage?: string;
    targetUrl: string;
    model: string;
    date: string;
    summary: ComparisonSummary;
    discrepancies: Discrepancy[];
    manifest?: RunManifest;
  };

  return {
    ...parsed,
    discrepancies: parseDiscrepancies(parsed.discrepancies),
    reportDir,
    reportPath,
    jsonPath,
  };
}
