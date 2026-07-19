import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Produces a transparent-background version of the wordmark by keying out the
// cream paper color, so the ink can sit directly on any app surface.
const here = dirname(fileURLToPath(import.meta.url));
const logoPath = join(here, "..", "..", "..", "packages", "cli", "assets", "logo.png");
const outDir = join(here, "..", "src", "renderer", "src", "assets");
const outPath = join(outDir, "wordmark.png");

const src = `data:image/png;base64,${(await readFile(logoPath)).toString("base64")}`;
const browser = await chromium.launch();
const page = await browser.newPage();
const dataUrl = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  const [br, bg, bb] = [px[0], px[1], px[2]]; // top-left pixel = paper color
  for (let i = 0; i < px.length; i += 4) {
    const dist = Math.hypot(px[i] - br, px[i + 1] - bg, px[i + 2] - bb);
    // fully transparent near the paper color (kills the halo), soft ramp to ink
    px[i + 3] = Math.min(255, Math.max(0, Math.round(((dist - 24) / 46) * 255)));
  }
  ctx.putImageData(d, 0, 0);

  // trim to the ink's bounding box so the mark carries no built-in margins
  let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (px[(y * c.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  const octx = out.getContext("2d");
  octx.drawImage(c, -minX, -minY);

  // dark-mode variant: recolor the navy ink to cream, keep the gold strokes
  const od = octx.getImageData(0, 0, out.width, out.height);
  const op = od.data;
  for (let i = 0; i < op.length; i += 4) {
    if (op[i + 3] === 0) continue;
    const luma = 0.299 * op[i] + 0.587 * op[i + 1] + 0.114 * op[i + 2];
    const isGold = op[i] > 120 && op[i + 1] > 90 && op[i + 2] < 120;
    if (luma < 128 && !isGold) {
      op[i] = 239;
      op[i + 1] = 232;
      op[i + 2] = 216;
    }
  }
  const dark = document.createElement("canvas");
  dark.width = out.width;
  dark.height = out.height;
  dark.getContext("2d").putImageData(od, 0, 0);

  return { light: out.toDataURL("image/png"), dark: dark.toDataURL("image/png") };
}, src);
await browser.close();

await mkdir(outDir, { recursive: true });
await writeFile(outPath, Buffer.from(dataUrl.light.split(",")[1], "base64"));
const darkPath = outPath.replace("wordmark.png", "wordmark-dark.png");
await writeFile(darkPath, Buffer.from(dataUrl.dark.split(",")[1], "base64"));
console.log(`wordmarks written to ${outPath} and ${darkPath}`);
