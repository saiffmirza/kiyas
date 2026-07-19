import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";

/** Decoded RGBA pixels. All pixel math in core runs on this shape. */
export interface RawImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export async function loadPng(path: string): Promise<RawImage> {
  const png = PNG.sync.read(await readFile(path));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

export async function savePng(image: RawImage, path: string): Promise<void> {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  await writeFile(path, PNG.sync.write(png));
}

export function cropImage(
  image: RawImage,
  box: { x: number; y: number; width: number; height: number }
): RawImage {
  const x = Math.max(0, Math.min(Math.round(box.x), image.width - 1));
  const y = Math.max(0, Math.min(Math.round(box.y), image.height - 1));
  const width = Math.min(Math.round(box.width), image.width - x);
  const height = Math.min(Math.round(box.height), image.height - y);
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const src = ((y + row) * image.width + x) * 4;
    data.set(image.data.subarray(src, src + width * 4), row * width * 4);
  }
  return { width, height, data };
}

/**
 * Box-filter average when shrinking, bilinear when enlarging. A naive bilinear
 * downscale aliases badly enough to flip template-match winners.
 */
export function resizeImage(src: RawImage, width: number, height: number): RawImage {
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  if (width === src.width && height === src.height) {
    return { width, height, data: src.data.slice() };
  }
  const data = new Uint8Array(width * height * 4);
  if (width <= src.width && height <= src.height) {
    for (let oy = 0; oy < height; oy++) {
      const y0 = Math.floor((oy * src.height) / height);
      const y1 = Math.max(y0 + 1, Math.floor(((oy + 1) * src.height) / height));
      for (let ox = 0; ox < width; ox++) {
        const x0 = Math.floor((ox * src.width) / width);
        const x1 = Math.max(x0 + 1, Math.floor(((ox + 1) * src.width) / width));
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let sy = y0; sy < y1; sy++) {
          for (let sx = x0; sx < x1; sx++) {
            const i = (sy * src.width + sx) * 4;
            r += src.data[i];
            g += src.data[i + 1];
            b += src.data[i + 2];
            a += src.data[i + 3];
          }
        }
        const n = (y1 - y0) * (x1 - x0);
        const o = (oy * width + ox) * 4;
        data[o] = r / n;
        data[o + 1] = g / n;
        data[o + 2] = b / n;
        data[o + 3] = a / n;
      }
    }
  } else {
    for (let oy = 0; oy < height; oy++) {
      const fy = height === 1 ? 0 : (oy * (src.height - 1)) / (height - 1);
      const sy = Math.floor(fy);
      const dy = fy - sy;
      const sy1 = Math.min(sy + 1, src.height - 1);
      for (let ox = 0; ox < width; ox++) {
        const fx = width === 1 ? 0 : (ox * (src.width - 1)) / (width - 1);
        const sx = Math.floor(fx);
        const dx = fx - sx;
        const sx1 = Math.min(sx + 1, src.width - 1);
        const o = (oy * width + ox) * 4;
        for (let c = 0; c < 4; c++) {
          const tl = src.data[(sy * src.width + sx) * 4 + c];
          const tr = src.data[(sy * src.width + sx1) * 4 + c];
          const bl = src.data[(sy1 * src.width + sx) * 4 + c];
          const br = src.data[(sy1 * src.width + sx1) * 4 + c];
          data[o + c] =
            tl * (1 - dx) * (1 - dy) +
            tr * dx * (1 - dy) +
            bl * (1 - dx) * dy +
            br * dx * dy;
        }
      }
    }
  }
  return { width, height, data };
}

export function grayThumb(image: RawImage, w: number, h: number): Uint8Array {
  const resized = w === image.width && h === image.height ? image : resizeImage(image, w, h);
  const out = new Uint8Array(resized.width * resized.height);
  for (let i = 0; i < out.length; i++) {
    const j = i * 4;
    out[i] =
      0.299 * resized.data[j] +
      0.587 * resized.data[j + 1] +
      0.114 * resized.data[j + 2];
  }
  return out;
}

/** Mean luminance of an image, 0 (black) to 1 (white). */
export function meanLuma(image: RawImage): number {
  const sample = image.width > 64 ? resizeImage(image, 64, Math.max(1, Math.round((64 * image.height) / image.width))) : image;
  let sum = 0;
  const count = sample.width * sample.height;
  for (let i = 0; i < count; i++) {
    const j = i * 4;
    sum +=
      0.299 * sample.data[j] +
      0.587 * sample.data[j + 1] +
      0.114 * sample.data[j + 2];
  }
  return sum / count / 255;
}
