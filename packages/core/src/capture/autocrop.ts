import { cropImage, grayThumb, type RawImage } from "./image.js";

export interface ElementBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Mean absolute grayscale difference on 48×48 thumbnails, 0 = identical. */
export function visualDistance(a: RawImage, b: RawImage): number {
  const size = 48;
  const ta = grayThumb(a, size, size);
  const tb = grayThumb(b, size, size);
  let sum = 0;
  for (let i = 0; i < ta.length; i++) sum += Math.abs(ta[i] - tb[i]);
  return sum / ta.length;
}

/** Design-aspect crop of the full page starting at the element's top-left. */
export function anchoredCrop(
  fullPage: RawImage,
  design: RawImage,
  box: ElementBox
): RawImage | undefined {
  const x = Math.max(0, Math.round(box.x));
  const y = Math.max(0, Math.round(box.y));
  const width = Math.min(Math.round(box.width), fullPage.width - x);
  const height = Math.min(
    Math.round((width * design.height) / design.width),
    fullPage.height - y
  );
  if (width < 8 || height < 8) return undefined;
  return cropImage(fullPage, { x, y, width, height });
}

function scanBest(
  page: Uint8Array,
  pageW: number,
  pageH: number,
  tpl: Uint8Array,
  tplW: number,
  tplH: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  sample: number
): { x: number; y: number } {
  let best = Infinity;
  let bestX = Math.max(0, x0);
  let bestY = Math.max(0, y0);
  for (let y = Math.max(0, y0); y <= y1 && y + tplH <= pageH; y++) {
    for (let x = Math.max(0, x0); x <= x1 && x + tplW <= pageW; x++) {
      let sum = 0;
      for (let wy = 0; wy < tplH; wy += sample) {
        const pageRow = (y + wy) * pageW + x;
        const tplRow = wy * tplW;
        for (let wx = 0; wx < tplW; wx += sample) {
          sum += Math.abs(page[pageRow + wx] - tpl[tplRow + wx]);
        }
      }
      if (sum < best) {
        best = sum;
        bestX = x;
        bestY = y;
      }
    }
  }
  return { x: bestX, y: bestY };
}

interface PyramidLevel {
  factor: number;
  width: number;
  height: number;
  gray: Uint8Array;
}

/**
 * Grayscale thumbnails of the full page at the coarse-to-fine search stages.
 * Built once per capture — every width hypothesis reuses the same levels, and
 * a pure-JS resize of a retina full page is far too slow to repeat per stage.
 */
function buildPagePyramid(fullPage: RawImage): PyramidLevel[] {
  const levels: PyramidLevel[] = [];
  let prevFactor = 0;
  for (const stageWidth of [160, 640, fullPage.width]) {
    const factor = Math.min(1, stageWidth / fullPage.width);
    if (factor <= prevFactor) continue;
    const width = Math.max(1, Math.round(fullPage.width * factor));
    const height = Math.max(1, Math.round(fullPage.height * factor));
    levels.push({ factor, width, height, gray: grayThumb(fullPage, width, height) });
    prevFactor = factor;
  }
  return levels;
}

/**
 * Slide a design-shaped window over the full-page capture and crop the
 * best-matching region, refining coarse-to-fine (160px → 640px → full res) so
 * the final position is pixel-accurate. `targetW` is one hypothesis for the
 * design's rendered width in page pixels — callers try several (element
 * width, design width at 1x/2x) and let the visual check pick the winner.
 */
function templateMatchCrop(
  fullPage: RawImage,
  pyramid: PyramidLevel[],
  design: RawImage,
  targetW: number
): RawImage | undefined {
  const targetH = Math.round((targetW * design.height) / design.width);
  if (targetW < 8 || targetH < 8) return undefined;
  if (targetW > fullPage.width || targetH > fullPage.height) return undefined;

  let pos: { x: number; y: number } | undefined;
  let prevFactor = 0;
  for (const level of pyramid) {
    const { factor, width: pageW, height: pageH, gray: pageThumb } = level;
    const winW = Math.max(2, Math.round(targetW * factor));
    const winH = Math.max(2, Math.round(targetH * factor));
    if (winW > pageW || winH > pageH) return undefined;

    const designThumb = grayThumb(design, winW, winH);
    const sample = factor === 1 ? 4 : 2;

    if (!pos) {
      pos = scanBest(
        pageThumb, pageW, pageH, designThumb, winW, winH,
        0, pageW, 0, pageH, sample
      );
    } else {
      // map the previous stage's position up and search a small neighborhood
      const cx = Math.round((pos.x / prevFactor) * factor);
      const cy = Math.round((pos.y / prevFactor) * factor);
      const radius = Math.ceil(factor / prevFactor) + 2;
      pos = scanBest(
        pageThumb, pageW, pageH, designThumb, winW, winH,
        cx - radius, cx + radius, cy - radius, cy + radius, sample
      );
    }
    prevFactor = factor;
  }
  if (!pos) return undefined;

  return cropImage(fullPage, {
    x: Math.min(pos.x, fullPage.width - targetW),
    y: Math.min(pos.y, fullPage.height - targetH),
    width: targetW,
    height: targetH,
  });
}

/**
 * The element screenshot only matches the design when the design was cropped
 * exactly to the component. Build alternative crops of the full page — one
 * anchored at the element, plus template matches at a few scale hypotheses
 * (the design may cover more or less of the page, at 1x or retina pixels) —
 * and keep whichever looks most like the design.
 */
export function selectBestCrop(opts: {
  fullPage: RawImage;
  design: RawImage;
  element: RawImage;
  elementBox: ElementBox;
}): { image: RawImage; changed: boolean } {
  const { fullPage, design, element, elementBox } = opts;
  const pyramid = buildPagePyramid(fullPage);
  const widths = [
    ...new Set([
      Math.round(elementBox.width),
      design.width,
      design.width * 2,
      Math.round(design.width / 2),
    ]),
  ].filter((w) => w >= 8 && w <= fullPage.width);
  const candidates = [
    element,
    anchoredCrop(fullPage, design, elementBox),
    ...widths.map((w) => templateMatchCrop(fullPage, pyramid, design, w)),
  ].filter((c): c is RawImage => c !== undefined);

  let winner = element;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = visualDistance(design, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      winner = candidate;
    }
  }
  return { image: winner, changed: winner !== element };
}
