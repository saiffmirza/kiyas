import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface PlaywrightCaptureOptions {
  url: string;
  /** Where to write the screenshot PNG. */
  outputPath: string;
  viewport?: string;
  selector?: string;
  wait?: number;
  /** Device scale factor for the screenshot. Match this to the Figma export scale. */
  scale?: number;
  /** Capture the full scrollable page instead of just the viewport. Default true when no selector is given. */
  fullPage?: boolean;
  /** Emulated prefers-color-scheme for the capture. */
  colorScheme?: "light" | "dark";
  /**
   * Path to a Playwright storageState JSON file (cookies + localStorage).
   * Lets kiyas screenshot authenticated views the same way your tests do.
   * Generate one with `playwright codegen --save-storage=auth.json` or via
   * a global-setup test that calls `context.storageState({ path })`.
   */
  authState?: string;
  /**
   * With `selector`: also capture the full scrollable page to this path and
   * report the element's bounding box in full-page image coordinates.
   */
  fullPagePath?: string;
}

export interface PlaywrightCaptureResult {
  imagePath: string;
  fullPagePath?: string;
  /** Element position in full-page image pixels (already multiplied by scale). */
  elementBox?: { x: number; y: number; width: number; height: number };
}

export async function capturePlaywright(
  options: PlaywrightCaptureOptions
): Promise<string> {
  return (await capturePlaywrightDetailed(options)).imagePath;
}

export async function capturePlaywrightDetailed(
  options: PlaywrightCaptureOptions
): Promise<PlaywrightCaptureResult> {
  const { chromium } = await import("playwright");

  const [width, height] = parseViewport(options.viewport ?? "1280x720");
  const browser = await chromium.launch();

  try {
    let storageState: string | undefined;
    if (options.authState) {
      storageState = resolve(options.authState);
      if (!existsSync(storageState)) {
        throw new Error(
          `Auth state file not found at ${storageState}. ` +
            `Generate one with \`npx playwright codegen --save-storage=${options.authState}\`.`
        );
      }
    }

    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: options.scale ?? 1,
      reducedMotion: "reduce",
      timezoneId: "UTC",
      locale: "en-US",
      colorScheme: options.colorScheme,
      storageState,
    });
    const page = await context.newPage();

    try {
      await page.goto(options.url, { waitUntil: "load" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("ERR_CONNECTION_REFUSED") ||
        message.includes("ECONNREFUSED")
      ) {
        throw new Error(
          `Could not reach ${options.url} — is the dev server running? ` +
            `If it's on a different port, pass \`devServer\` (MCP) / \`--dev-server\` (CLI), or a full \`target\` URL.`
        );
      }
      throw err;
    }
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content:
        "*, *::before, *::after { animation: none !important; transition: none !important; }",
    });

    if (options.wait) {
      await page.waitForTimeout(options.wait);
    }

    // The style tag above only kills CSS animations. JS-driven entrance
    // animations (Framer Motion et al.) still run, and capturing mid-flight
    // reports phantom offsets. Sample element geometry until two consecutive
    // reads match, so the screenshot sees the settled layout.
    const snapshot = () =>
      page.evaluate(() => {
        const els = document.querySelectorAll("body *");
        const step = Math.max(1, Math.floor(els.length / 200));
        let sig = "";
        for (let i = 0; i < els.length; i += step) {
          const el = els[i] as HTMLElement;
          const r = el.getBoundingClientRect();
          sig += `${Math.round(r.top * 4)},${Math.round(r.left * 4)},${getComputedStyle(el).opacity};`;
        }
        return sig;
      });
    let prev = await snapshot();
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(250);
      const next = await snapshot();
      if (next === prev) break;
      prev = next;
    }

    const imagePath = options.outputPath;
    const screenshotOptions = {
      path: imagePath,
      animations: "disabled",
      caret: "hide",
    } as const;

    if (options.selector) {
      const element = await page.$(options.selector);
      if (!element) {
        throw new Error(
          `Selector "${options.selector}" not found on page ${options.url}`
        );
      }
      let fullPagePath: string | undefined;
      let elementBox: PlaywrightCaptureResult["elementBox"];
      if (options.fullPagePath) {
        // Full-page shot and bounding box must come before element.screenshot,
        // which scrolls the element into view.
        await page.screenshot({
          ...screenshotOptions,
          path: options.fullPagePath,
          fullPage: true,
        });
        const box = await element.boundingBox();
        if (box) {
          const scroll = await page.evaluate(() => ({
            x: window.scrollX,
            y: window.scrollY,
          }));
          const scale = options.scale ?? 1;
          elementBox = {
            x: (box.x + scroll.x) * scale,
            y: (box.y + scroll.y) * scale,
            width: box.width * scale,
            height: box.height * scale,
          };
          fullPagePath = options.fullPagePath;
        }
      }
      await element.screenshot(screenshotOptions);
      return { imagePath, fullPagePath, elementBox };
    }

    await page.screenshot({
      ...screenshotOptions,
      fullPage: options.fullPage ?? true,
    });

    return { imagePath };
  } finally {
    await browser.close();
  }
}

function parseViewport(viewport: string): [number, number] {
  const match = viewport.match(/^(\d+)x(\d+)$/);
  if (!match) {
    throw new Error(
      `Invalid viewport format: "${viewport}". Expected format: WIDTHxHEIGHT (e.g., 1280x720)`
    );
  }
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}
