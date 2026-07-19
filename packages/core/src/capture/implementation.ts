import { join } from "node:path";
import { capturePlaywrightDetailed } from "./playwright.js";
import { loadPng, meanLuma, savePng, type RawImage } from "./image.js";
import { selectBestCrop, type ElementBox } from "./autocrop.js";
import { captureMismatchWarning } from "./warning.js";
import { readPngSize } from "../utils/png-size.js";

export interface CaptureImplementationParams {
  targetUrl: string;
  viewport: string;
  selector?: string;
  scale: number;
  wait?: number;
  fullPage?: boolean;
  authState?: string;
  /** Explicit prefers-color-scheme. When set, the luma auto-retry is skipped. */
  colorScheme?: "light" | "dark";
  /** Design image the capture is matched against (luma retry + autocrop). */
  designPath: string;
  /** Where intermediate PNGs are written. */
  outputDir: string;
  /** Caller-owned list; every file written is appended so the caller's cleanup catches a mid-capture throw. */
  tempFiles: string[];
  onProgress?: (event: {
    step: "screenshot";
    status: "start" | "done";
    message?: string;
  }) => void;
}

export interface CaptureImplementationResult {
  /** Winning capture (or crop). Also present in `tempFiles` — copy before cleanup. */
  implPath: string;
  warning?: string;
  /** Set when a color scheme was emulated (explicitly or via the luma retry). */
  usedColorScheme?: "light" | "dark";
  autoCropped: boolean;
  fullPagePath?: string;
  elementBox?: ElementBox;
}

/**
 * Shared implementation-capture orchestrator: Playwright screenshot, then
 * dark/light-theme matching against the design, then full-page candidate
 * crops when a selector is present. Desktop, CLI, and MCP all run captures
 * through here so accuracy features can't drift between surfaces again.
 */
export async function captureImplementation(
  p: CaptureImplementationParams
): Promise<CaptureImplementationResult> {
  const progress = p.onProgress ?? (() => {});
  progress({ step: "screenshot", status: "start", message: p.targetUrl });

  const captureOnce = (colorScheme?: "light" | "dark") => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return capturePlaywrightDetailed({
      url: p.targetUrl,
      outputPath: join(p.outputDir, `kiyas-capture-${stamp}.png`),
      fullPagePath: p.selector
        ? join(p.outputDir, `kiyas-fullpage-${stamp}.png`)
        : undefined,
      viewport: p.viewport,
      selector: p.selector,
      wait: p.wait,
      scale: p.scale,
      fullPage: p.fullPage,
      colorScheme,
      authState: p.authState,
    });
  };
  const trackTemps = (cap: { imagePath: string; fullPagePath?: string }) => {
    p.tempFiles.push(cap.imagePath);
    if (cap.fullPagePath) p.tempFiles.push(cap.fullPagePath);
  };

  let capture = await captureOnce(p.colorScheme);
  trackTemps(capture);
  let usedColorScheme = p.colorScheme;

  // The pixel-math features need a decodable design; JPEG designs (valid
  // inputs on non-macOS, where normalizeToSrgb can't transcode) skip them.
  const designIsPng = (await readPngSize(p.designPath)) !== undefined;
  let design: RawImage | undefined;

  // Silently match the design's theme: if the design is clearly dark but the
  // capture came back light (or vice versa), retry with the emulated scheme
  // flipped and keep whichever capture is closer in brightness.
  if (p.colorScheme === undefined && designIsPng) {
    design = await loadPng(p.designPath);
    const designLuma = meanLuma(design);
    const implLuma = meanLuma(await loadPng(capture.imagePath));
    const wantsDark = designLuma < 0.4 && implLuma > 0.55;
    const wantsLight = designLuma > 0.6 && implLuma < 0.45;
    if (wantsDark || wantsLight) {
      const retry = await captureOnce(wantsDark ? "dark" : "light");
      trackTemps(retry);
      const retryLuma = meanLuma(await loadPng(retry.imagePath));
      if (Math.abs(retryLuma - designLuma) < Math.abs(implLuma - designLuma)) {
        capture = retry;
        usedColorScheme = wantsDark ? "dark" : "light";
      }
    }
  }
  progress({ step: "screenshot", status: "done" });

  let implPath = capture.imagePath;
  let autoCropped = false;

  if (designIsPng && capture.fullPagePath && capture.elementBox) {
    design ??= await loadPng(p.designPath);
    const fullPage = await loadPng(capture.fullPagePath);
    const element = await loadPng(implPath);
    const { image: winner, changed } = selectBestCrop({
      fullPage,
      design,
      element,
      elementBox: capture.elementBox,
    });
    if (changed) {
      const cropPath = join(p.outputDir, `kiyas-autocrop-${Date.now()}.png`);
      await savePng(winner, cropPath);
      p.tempFiles.push(cropPath);
      implPath = cropPath;
      autoCropped = true;
    }
  }

  const warning = await captureMismatchWarning(p.designPath, implPath);
  return {
    implPath,
    warning,
    usedColorScheme,
    autoCropped,
    fullPagePath: capture.fullPagePath,
    elementBox: capture.elementBox,
  };
}
