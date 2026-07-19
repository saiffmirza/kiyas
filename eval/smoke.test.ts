import { test, before, after } from "node:test";
import assert from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { capturePlaywright } from "../packages/core/src/capture/playwright.js";
import { readPngSize } from "../packages/core/src/utils/png-size.js";

// Capture smoke: screenshots the eval fixtures through the real Playwright
// path — no AI involved. Requires Chromium (npx playwright install chromium).

// This file runs bundled from eval/dist (see the test:smoke script), so
// fixtures live one level up — same convention as run.ts.
const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures"
);

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url!, "http://localhost").pathname;
  try {
    const data = await readFile(join(FIXTURES_DIR, pathname));
    res.setHeader(
      "content-type",
      pathname.endsWith(".js") ? "text/javascript" : "text/html"
    );
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end();
  }
});

let base: string;
let outDir: string;

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
  outDir = await mkdtemp(join(tmpdir(), "kiyas-smoke-"));
});

after(async () => {
  server.close();
  await rm(outDir, { recursive: true, force: true });
});

test("viewport capture matches the requested size", async () => {
  const path = await capturePlaywright({
    url: `${base}/card.html`,
    outputPath: join(outDir, "viewport.png"),
    viewport: "900x700",
    fullPage: false,
  });
  assert.deepStrictEqual(await readPngSize(path), { width: 900, height: 700 });
});

test("selector capture isolates the element", async () => {
  const path = await capturePlaywright({
    url: `${base}/badges.html`,
    outputPath: join(outDir, "selector.png"),
    viewport: "900x700",
    selector: ".row",
  });
  const size = await readPngSize(path);
  assert.ok(size);
  assert.ok(size.width > 0 && size.width < 900);
  assert.ok(size.height > 0 && size.height < 700);
});

test("scale doubles the pixel dimensions", async () => {
  const capture = (scale: number) =>
    capturePlaywright({
      url: `${base}/badges.html`,
      outputPath: join(outDir, `scale-${scale}.png`),
      viewport: "900x700",
      selector: ".row",
      scale,
    });
  const at1 = await readPngSize(await capture(1));
  const at2 = await readPngSize(await capture(2));
  assert.ok(at1 && at2);
  assert.ok(Math.abs(at2.width - at1.width * 2) <= 2);
  assert.ok(Math.abs(at2.height - at1.height * 2) <= 2);
});
