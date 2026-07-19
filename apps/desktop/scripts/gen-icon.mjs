import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "resources", "icon.png");
const logoPath = join(here, "..", "..", "..", "packages", "cli", "assets", "logo.png");
const logo = `data:image/png;base64,${(await readFile(logoPath)).toString("base64")}`;

// macOS icon grid: 824x824 rounded rect centered on a transparent 1024 canvas.
// The tile is filled with the logo's own background color (sampled at runtime)
// so the wordmark's bounding rectangle blends in invisibly.
const html = `<!doctype html>
<html><head><style>
  * { margin: 0; padding: 0; }
  body { width: 1024px; height: 1024px; background: transparent; }
  .tile {
    position: absolute;
    left: 100px; top: 100px;
    width: 824px; height: 824px;
    border-radius: 186px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tile::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 186px;
    border: 3px solid rgba(27, 27, 58, 0.12);
  }
  .tile img {
    width: 790px;
    display: block;
  }
</style></head>
<body>
  <div class="tile"><img id="logo" src="${logo}" /></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => {
  const img = document.getElementById("logo");
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const [r, g, b] = ctx.getImageData(2, 2, 1, 1).data;
  document.querySelector(".tile").style.background = `rgb(${r}, ${g}, ${b})`;
});
await page.screenshot({ path: outPath, omitBackground: true });
await browser.close();
console.log(`icon written to ${outPath}`);
