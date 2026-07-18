import { open } from "node:fs/promises";

export interface PngSize {
  width: number;
  height: number;
}

/** Reads width/height from a PNG's IHDR header without decoding the image. */
export async function readPngSize(path: string): Promise<PngSize | undefined> {
  const fh = await open(path, "r");
  try {
    const buf = Buffer.alloc(24);
    await fh.read(buf, 0, 24, 0);
    if (buf.readUInt32BE(0) !== 0x89504e47) return undefined;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } finally {
    await fh.close();
  }
}
