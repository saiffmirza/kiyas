import { ipcMain, dialog, shell, type BrowserWindow } from "electron";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  captureFigma,
  captureImplementation,
  captureMismatchWarning,
  cropImage,
  defaultCaptureScale,
  loadPng,
  loadReport,
  loadSettings,
  normalizeToSrgb,
  readPngSize,
  resolveComponent,
  resolveFigmaToken,
  runComparison,
  savePng,
  type FigmaNodeMetadata,
} from "@kiyas/core";
import { runDoctor } from "./doctor.js";
import { loadState, saveState } from "./store.js";
import type {
  CaptureResponse,
  CompareRequest,
  CompareResponse,
  CropResponse,
  DesktopProgressEvent,
  OpenPort,
  ReportListItem,
  RepoState,
} from "../shared/types.js";

interface PendingCapture {
  params: CompareRequest;
  designPath: string;
  implPath: string;
  tempFiles: string[];
  metadata?: FigmaNodeMetadata;
  targetUrl: string;
  selector?: string;
  resolved?: { filePath: string; url: string; selector?: string };
}

let pending: PendingCapture | undefined;

async function discardPending(): Promise<void> {
  if (!pending) return;
  for (const file of pending.tempFiles) {
    await unlink(file).catch(() => {});
  }
  pending = undefined;
}

async function toDataUrl(path: string): Promise<string> {
  return `data:image/png;base64,${(await readFile(path)).toString("base64")}`;
}

const execFileAsync = promisify(execFile);

// Pinned to the bundled Playwright: a bare `npx playwright` resolves the
// latest release, whose Chromium revision won't match what executablePath()
// expects here.
const playwrightVersion: string = createRequire(import.meta.url)(
  "playwright/package.json"
).version;

const PROVIDER_SETUP = {
  claude:
    "command -v claude >/dev/null 2>&1 || npm install -g @anthropic-ai/claude-code; claude",
  codex:
    "command -v codex >/dev/null 2>&1 || npm install -g @openai/codex; codex",
  browsers: `npx playwright@${playwrightVersion} install chromium`,
} as const;

async function listOpenPorts(): Promise<OpenPort[]> {
  try {
    const { stdout } = await execFileAsync(
      "lsof",
      ["-iTCP", "-sTCP:LISTEN", "-P", "-n", "+c0"],
      { timeout: 5000, maxBuffer: 4 * 1024 * 1024 }
    );
    const byPort = new Map<number, string>();
    for (const line of stdout.split("\n").slice(1)) {
      const match = line.match(/:(\d+)\s+\(LISTEN\)\s*$/);
      if (!match) continue;
      const cols = line.trim().split(/\s+/);
      const port = parseInt(match[1], 10);
      // dev servers live in the registered-port range; skip system + ephemeral
      if (port < 1024 || port >= 49152) continue;
      // only JS dev-server runtimes — hides system listeners like ControlCenter
      if (!/^(node|bun|deno)$/i.test(cols[0])) continue;
      if (!byPort.has(port)) byPort.set(port, cols[0]);
    }
    return [...byPort.entries()]
      .map(([port, process]) => ({ port, process }))
      .sort((a, b) => a.port - b.port);
  } catch {
    return [];
  }
}

export function registerIpc(getWin: () => BrowserWindow): void {
  const sendProgress = (event: DesktopProgressEvent) => {
    const win = getWin();
    if (!win.isDestroyed()) win.webContents.send("compare-progress", event);
  };

  ipcMain.handle("doctor", () => runDoctor());

  ipcMain.handle("repos-load", (): RepoState => loadState());

  ipcMain.handle("repos-add", async (): Promise<RepoState> => {
    const result = await dialog.showOpenDialog(getWin(), {
      title: "Add a project folder",
      properties: ["openDirectory"],
    });
    const state = loadState();
    const picked = result.filePaths[0];
    if (picked) {
      if (!state.repos.includes(picked)) state.repos.push(picked);
      state.selectedRepo = picked;
      saveState(state);
    }
    return state;
  });

  ipcMain.handle("repos-remove", (_event, path: string): RepoState => {
    const state = loadState();
    state.repos = state.repos.filter((r) => r !== path);
    if (state.selectedRepo === path) state.selectedRepo = state.repos[0];
    saveState(state);
    return state;
  });

  ipcMain.handle("repos-select", (_event, path: string): RepoState => {
    const state = loadState();
    if (state.repos.includes(path)) {
      state.selectedRepo = path;
      saveState(state);
    }
    return state;
  });

  ipcMain.handle("ports-list", () => listOpenPorts());

  ipcMain.handle(
    "reports-list",
    async (_event, repo: string): Promise<ReportListItem[]> => {
      const reportsDir = join(repo, ".kiyas", "reports");
      let ids: string[];
      try {
        ids = await readdir(reportsDir);
      } catch {
        return [];
      }
      const items = await Promise.all(
        ids.map(async (id): Promise<ReportListItem | null> => {
          try {
            const r = await loadReport(id, reportsDir);
            let rerun: ReportListItem["rerun"];
            if (r.targetUrl && (r.figmaUrl || r.designImage)) {
              // The original design file may be gone (or was a temp copy);
              // fall back to the design.png persisted alongside the report.
              const designCopy = join(reportsDir, id, "design.png");
              const designImage = r.figmaUrl
                ? undefined
                : r.designImage && existsSync(r.designImage)
                  ? r.designImage
                  : existsSync(designCopy)
                    ? designCopy
                    : undefined;
              if (r.figmaUrl || designImage) {
                const threshold = r.manifest?.threshold;
                rerun = {
                  figmaUrl: r.figmaUrl,
                  designImage,
                  targetUrl: r.targetUrl,
                  selector: r.manifest?.selector,
                  viewport: r.manifest?.viewport ?? "1440x900",
                  threshold:
                    threshold === "medium" || threshold === "high"
                      ? threshold
                      : "all",
                };
              }
            }
            return {
              reportId: r.reportId,
              name: r.name,
              date: r.date,
              summary: r.summary,
              rerun,
            };
          } catch {
            return null;
          }
        })
      );
      return items
        .filter((r): r is ReportListItem => r !== null)
        .sort((a, b) => b.reportId.localeCompare(a.reportId))
        .slice(0, 20);
    }
  );

  ipcMain.handle(
    "reports-open",
    async (_event, repo: string, reportId: string): Promise<CompareResponse> => {
      try {
        const reportsDir = join(repo, ".kiyas", "reports");
        const r = await loadReport(reportId, reportsDir);
        return {
          ok: true,
          summary: r.summary,
          discrepancies: r.discrepancies,
          reportPath: r.reportPath,
          reportHtml: await readFile(r.reportPath, "utf-8"),
          modelLabel: r.model,
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  ipcMain.handle(
    "setup-provider",
    async (_event, provider: "claude" | "codex" | "browsers") => {
      const command = PROVIDER_SETUP[provider];
      if (!command) return { ok: false, error: "Unknown provider" };
      if (process.platform !== "darwin") {
        return {
          ok: false,
          error: `Open a terminal and run: ${command}`,
        };
      }
      try {
        const escaped = command.replace(/"/g, '\\"');
        await execFileAsync("osascript", [
          "-e",
          `tell application "Terminal" to do script "${escaped}"`,
          "-e",
          'tell application "Terminal" to activate',
        ]);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  ipcMain.handle("save-figma-token", async (_event, token: string) => {
    const trimmed = token.trim();
    if (!trimmed) return { ok: false, error: "Paste a token first." };
    try {
      const response = await fetch("https://api.figma.com/v1/me", {
        headers: { "X-Figma-Token": trimmed },
      });
      if (!response.ok) {
        return {
          ok: false,
          error: `Figma rejected the token (HTTP ${response.status}). Check it and try again.`,
        };
      }
      const rcPath = join(homedir(), ".kiyasrc");
      let rc: Record<string, unknown> = {};
      try {
        rc = JSON.parse(await readFile(rcPath, "utf-8"));
      } catch {
        // no existing rc file, start fresh
      }
      rc.figmaAccessToken = trimmed;
      await writeFile(rcPath, JSON.stringify(rc, null, 2) + "\n", "utf-8");
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("open-figma-settings", async () => {
    await shell.openExternal("https://www.figma.com/settings");
  });

  ipcMain.handle("pick-repo", async () => {
    const result = await dialog.showOpenDialog(getWin(), {
      title: "Choose the project folder",
      properties: ["openDirectory"],
    });
    return result.filePaths[0];
  });

  ipcMain.handle("pick-image", async () => {
    const result = await dialog.showOpenDialog(getWin(), {
      title: "Choose a design screenshot",
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
    });
    return result.filePaths[0];
  });

  ipcMain.handle("open-report", async (_event, reportPath: string) => {
    await shell.openPath(reportPath);
  });

  ipcMain.handle(
    "capture",
    async (_event, params: CompareRequest): Promise<CaptureResponse> => {
      const send = sendProgress;
      await discardPending();

      const tempFiles: string[] = [];
      try {
        const settings = loadSettings();
        const provider = settings.model === "openai" ? "openai" : "claude";
        const aiModel =
          provider === "claude" ? settings.claudeModel : settings.codexModel;

        let designPath: string;
        let metadata: FigmaNodeMetadata | undefined;
        const scale = defaultCaptureScale(
          params.viewport,
          Boolean(params.selector || params.component)
        );

        if (params.designImage) {
          designPath = await normalizeToSrgb(
            resolve(params.designImage),
            tmpdir(),
            tempFiles
          );
        } else {
          if (!params.figmaUrl) {
            throw new Error("Provide a Figma URL or a design screenshot.");
          }
          const token = resolveFigmaToken();
          if (!token) {
            throw new Error(
              "No Figma token found. Set FIGMA_TOKEN or run `kiyas setup`."
            );
          }
          send({ step: "figma", status: "start" });
          const figma = await captureFigma(params.figmaUrl, token, scale);
          designPath = figma.imagePath;
          metadata = figma.metadata;
          tempFiles.push(figma.imagePath);
          send({ step: "figma", status: "done" });
        }

        let targetUrl = params.targetUrl;
        let selector = params.selector;
        let resolved:
          | { filePath: string; url: string; selector?: string }
          | undefined;

        if (params.component) {
          send({ step: "resolve", status: "start" });
          const r = await resolveComponent(
            params.component,
            params.targetUrl,
            provider,
            params.repo,
            aiModel,
            designPath
          );
          targetUrl = r.url;
          selector = r.selector ?? selector;
          resolved = { filePath: r.filePath, url: r.url, selector: r.selector };
          send({ step: "resolve", status: "done", message: r.filePath });
        }

        const cap = await captureImplementation({
          targetUrl,
          viewport: params.viewport,
          selector,
          scale,
          designPath,
          outputDir: tmpdir(),
          tempFiles,
          onProgress: send,
        });
        const implPath = cap.implPath;
        const warning = cap.warning;

        pending = {
          params,
          designPath,
          implPath,
          tempFiles,
          metadata,
          targetUrl,
          selector,
          resolved,
        };

        return {
          ok: true,
          designPng: await toDataUrl(designPath),
          implPng: await toDataUrl(implPath),
          targetUrl,
          selector,
          resolved,
          warning,
          designSize: await readPngSize(designPath),
          implSize: (await readPngSize(implPath)) ?? { width: 0, height: 0 },
        };
      } catch (err) {
        for (const file of tempFiles) {
          await unlink(file).catch(() => {});
        }
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  ipcMain.handle("capture-discard", () => discardPending());

  ipcMain.handle("crop-impl", async (): Promise<CropResponse> => {
    if (!pending) {
      return { ok: false, error: "Nothing captured to crop." };
    }
    try {
      const design = await readPngSize(pending.designPath);
      if (!design) {
        return {
          ok: false,
          error: "Cropping needs a PNG design image.",
        };
      }
      const impl = await loadPng(pending.implPath);
      const cropHeight = Math.min(
        impl.height,
        Math.round((impl.width * design.height) / design.width)
      );
      const cropped = cropImage(impl, {
        x: 0,
        y: 0,
        width: impl.width,
        height: cropHeight,
      });
      const cropPath = join(tmpdir(), `kiyas-crop-${Date.now()}.png`);
      await savePng(cropped, cropPath);
      pending.tempFiles.push(cropPath);
      pending.implPath = cropPath;

      const warning = await captureMismatchWarning(
        pending.designPath,
        cropPath
      );
      return {
        ok: true,
        implPng: await toDataUrl(cropPath),
        implSize: { width: cropped.width, height: cropped.height },
        warning,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("compare-confirmed", async (): Promise<CompareResponse> => {
    if (!pending) {
      return { ok: false, error: "No captured pair to compare. Capture first." };
    }
    const send = sendProgress;

    try {
      const settings = loadSettings();
      const provider = settings.model === "openai" ? "openai" : "claude";

      const result = await runComparison({
        designImage: pending.designPath,
        implImage: pending.implPath,
        figmaUrl: pending.params.figmaUrl,
        figmaMetadata: pending.metadata,
        targetUrl: pending.targetUrl,
        selector: pending.selector,
        resolved: pending.resolved,
        model: provider,
        aiModel:
          provider === "claude" ? settings.claudeModel : settings.codexModel,
        viewport: pending.params.viewport,
        threshold: pending.params.threshold,
        format: "html",
        reportsDir: join(pending.params.repo, ".kiyas", "reports"),
        onProgress: send,
      });

      const reportHtml = await readFile(result.reportPath, "utf-8");
      return {
        ok: true,
        summary: result.summary,
        discrepancies: result.discrepancies,
        reportPath: result.reportPath,
        reportHtml,
        modelLabel: result.modelLabel,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      await discardPending();
    }
  });
}
