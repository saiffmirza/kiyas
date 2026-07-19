import { test } from "node:test";
import assert from "node:assert";
import {
  cropImage,
  meanLuma,
  resizeImage,
  type RawImage,
} from "../packages/core/src/capture/image.js";
import {
  selectBestCrop,
  visualDistance,
} from "../packages/core/src/capture/autocrop.js";

function makeImage(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number]
): RawImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

// Busy deterministic texture so template matching has structure to lock onto.
const texture = (x: number, y: number): [number, number, number] => [
  (x * 37 + y * 11) % 256,
  (x * 13 + y * 71) % 256,
  (x * 5 + y * 29 + 128) % 256,
];

function paste(page: RawImage, src: RawImage, ox: number, oy: number): void {
  for (let y = 0; y < src.height; y++) {
    const from = y * src.width * 4;
    const to = ((oy + y) * page.width + ox) * 4;
    page.data.set(src.data.subarray(from, from + src.width * 4), to);
  }
}

test("selectBestCrop finds the design pasted at an offset (1x)", () => {
  const design = makeImage(96, 64, texture);
  const fullPage = makeImage(400, 600, (x, y) => [
    240,
    240,
    (x + y) % 40 > 20 ? 235 : 245,
  ]);
  paste(fullPage, design, 137, 211);
  // Element shot misses the design region — off by 40px each way.
  const elementBox = { x: 97, y: 171, width: 96, height: 64 };
  const element = cropImage(fullPage, elementBox);

  const { image: winner, changed } = selectBestCrop({
    fullPage,
    design,
    element,
    elementBox,
  });
  assert.ok(changed, "should replace the misaligned element shot");
  assert.strictEqual(visualDistance(design, winner), 0);
  assert.deepStrictEqual(
    [winner.width, winner.height],
    [design.width, design.height]
  );
});

test("selectBestCrop finds a 2x rendering of a 1x design", () => {
  // Smooth texture: per-pixel noise doesn't survive a 2x resample round-trip,
  // but real designs are smooth at this scale.
  const smooth = (x: number, y: number): [number, number, number] => [
    128 + Math.round(120 * Math.sin(x / 9)),
    128 + Math.round(120 * Math.sin(y / 7)),
    128 + Math.round(120 * Math.sin((x + y) / 12)),
  ];
  const design = makeImage(80, 60, smooth);
  const rendered = resizeImage(design, 160, 120);
  const fullPage = makeImage(500, 700, () => [250, 250, 250]);
  paste(fullPage, rendered, 260, 340);
  const elementBox = { x: 20, y: 30, width: 160, height: 120 };
  const element = cropImage(fullPage, elementBox);

  const { image: winner, changed } = selectBestCrop({
    fullPage,
    design,
    element,
    elementBox,
  });
  assert.ok(changed);
  const winnerDistance = visualDistance(design, winner);
  assert.ok(
    winnerDistance < visualDistance(design, element),
    "winner must beat the element shot"
  );
  assert.ok(winnerDistance < 10, `winner too far from design: ${winnerDistance}`);
  assert.deepStrictEqual([winner.width, winner.height], [160, 120]);
});

test("selectBestCrop keeps a matching element shot", () => {
  const design = makeImage(96, 64, texture);
  const fullPage = makeImage(300, 300, () => [250, 250, 250]);
  paste(fullPage, design, 50, 60);
  const elementBox = { x: 50, y: 60, width: 96, height: 64 };
  const element = cropImage(fullPage, elementBox);

  const { changed } = selectBestCrop({ fullPage, design, element, elementBox });
  assert.strictEqual(changed, false);
});

test("meanLuma separates dark and light images", () => {
  const dark = makeImage(200, 100, () => [20, 22, 25]);
  const light = makeImage(200, 100, () => [245, 244, 240]);
  assert.ok(meanLuma(dark) < 0.4, `dark luma: ${meanLuma(dark)}`);
  assert.ok(meanLuma(light) > 0.6, `light luma: ${meanLuma(light)}`);
});

test("resizeImage averages on downscale and preserves solids", () => {
  const solid = makeImage(64, 64, () => [90, 140, 200]);
  const shrunk = resizeImage(solid, 16, 16);
  assert.deepStrictEqual(
    [shrunk.data[0], shrunk.data[1], shrunk.data[2]],
    [90, 140, 200]
  );

  const checker = makeImage(64, 64, (x, y) =>
    (x + y) % 2 === 0 ? [0, 0, 0] : [255, 255, 255]
  );
  const gray = resizeImage(checker, 8, 8);
  assert.ok(
    Math.abs(gray.data[0] - 127) <= 2,
    `checkerboard should average to mid-gray, got ${gray.data[0]}`
  );

  const grown = resizeImage(solid, 128, 96);
  assert.deepStrictEqual(
    [grown.width, grown.height, grown.data[0]],
    [128, 96, 90]
  );
});
