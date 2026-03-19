import { join } from "node:path";
import { tmpdir } from "node:os";

export interface PlaywrightCaptureOptions {
  url: string;
  viewport?: string;
  selector?: string;
  wait?: number;
}

export async function capturePlaywright(
  options: PlaywrightCaptureOptions
): Promise<string> {
  const { chromium } = await import("playwright");

  const [width, height] = parseViewport(options.viewport ?? "1280x720");
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({
      viewport: { width, height },
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
