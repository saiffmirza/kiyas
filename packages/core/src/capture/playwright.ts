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
}

export async function capturePlaywright(
  options: PlaywrightCaptureOptions
): Promise<string> {
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
      await element.screenshot(screenshotOptions);
    } else {
      await page.screenshot({
        ...screenshotOptions,
        fullPage: options.fullPage ?? true,
      });
    }

    return imagePath;
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
