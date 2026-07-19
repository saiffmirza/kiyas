import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const resourcesDir = join(here, "..", "resources");
const layersDir = join(here, "..", "build", "icon-layers");
await mkdir(layersDir, { recursive: true });

// The mark is the Arabic kāf (ك) set in Farisi — the font is the vector
// source, so every variant renders crisply at any size. The glyph's ink box
// (not its em box) is measured on a canvas and optically centered.
const FONT = "Farisi";
const CHAR = "ك";
const CANVAS = 1024;
const TILE = 824; // Apple icon grid: 824px rounded rect on a 1024 canvas
const RADIUS = 186;
const GLYPH_FRACTION = 0.8;
// Farisi has a single weight; stroking the outline at 3% of the font size
// thickens the glyph without flattening its calligraphic contrast.
const STROKE_FRACTION = 0.03;

const NAVY = "#1b1b3a";
const CREAM = "#faf6ee";
const CREAM_GLYPH = "#efe8d8";

const html = `<!doctype html>
<html><head><style>
  * { margin: 0; padding: 0; }
  body { width: ${CANVAS}px; height: ${CANVAS}px; background: transparent; }
  canvas { display: block; }
</style></head>
<body><canvas id="c" width="${CANVAS}" height="${CANVAS}"></canvas></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: CANVAS, height: CANVAS } });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);

async function render(variant) {
  await page.evaluate(
    ({ variant, FONT, CHAR, CANVAS, TILE, RADIUS, GLYPH_FRACTION, STROKE_FRACTION, NAVY, CREAM, CREAM_GLYPH }) => {
      const ctx = document.getElementById("c").getContext("2d");
      ctx.clearRect(0, 0, CANVAS, CANVAS);

      const inset = (CANVAS - TILE) / 2;
      if (variant === "tile") {
        ctx.beginPath();
        ctx.roundRect(inset, inset, TILE, TILE, RADIUS);
        ctx.fillStyle = CREAM;
        ctx.fill();
        ctx.strokeStyle = "rgba(27, 27, 58, 0.12)";
        ctx.lineWidth = 6;
        ctx.stroke();
      }

      ctx.font = `100px '${FONT}'`;
      const m = ctx.measureText(CHAR);
      const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const target = TILE * GLYPH_FRACTION;
      const fontSize = (100 * target) / Math.max(w, h);
      ctx.font = `${fontSize}px '${FONT}'`;
      const box = ctx.measureText(CHAR);
      const bw = box.actualBoundingBoxLeft + box.actualBoundingBoxRight;
      const bh = box.actualBoundingBoxAscent + box.actualBoundingBoxDescent;
      const x = (CANVAS - bw) / 2 + box.actualBoundingBoxLeft;
      const y = (CANVAS - bh) / 2 + box.actualBoundingBoxAscent;
      const color =
        variant === "dark" ? CREAM_GLYPH : variant === "mono" ? "#000000" : NAVY;
      ctx.fillStyle = color;
      ctx.fillText(CHAR, x, y);
      if (STROKE_FRACTION > 0) {
        ctx.strokeStyle = color;
        ctx.lineWidth = fontSize * STROKE_FRACTION;
        ctx.lineJoin = "round";
        ctx.strokeText(CHAR, x, y);
      }
    },
    { variant, FONT, CHAR, CANVAS, TILE, RADIUS, GLYPH_FRACTION, STROKE_FRACTION, NAVY, CREAM, CREAM_GLYPH },
  );
}

const outputs = [
  ["tile", join(resourcesDir, "icon.png")], // dock/window icon + Win/Linux base
  ["glyph", join(layersDir, "glyph-navy.png")], // Icon Composer: light appearance
  ["dark", join(layersDir, "glyph-cream.png")], // Icon Composer: dark appearance
  ["mono", join(layersDir, "glyph-mono.png")], // Icon Composer: clear/tinted template
];

for (const [variant, path] of outputs) {
  await render(variant);
  await page.screenshot({ path, omitBackground: true });
  console.log(`${variant} → ${path}`);
}

await browser.close();
