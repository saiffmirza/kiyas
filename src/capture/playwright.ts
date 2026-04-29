import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

export interface PlaywrightCaptureOptions {
  url: string;
  viewport?: string;
  selector?: string;
  wait?: number;
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
      storageState,
    });
    const page = await context.newPage();

    await page.goto(options.url, { waitUntil: "networkidle" });

    if (options.wait) {
      await page.waitForTimeout(options.wait);
    }

    const imagePath = join(tmpdir(), `kiyas-target-${Date.now()}.png`);

    if (options.selector) {
      const element = await page.$(options.selector);
      if (!element) {
        throw new Error(
          `Selector "${options.selector}" not found on page ${options.url}`
        );
      }
      await element.screenshot({ path: imagePath });
    } else {
      await page.screenshot({ path: imagePath });
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
