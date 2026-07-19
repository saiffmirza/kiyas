import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { readPngSize } from "../utils/png-size.js";

const execFileAsync = promisify(execFile);

/**
 * macOS screenshots are tagged Display P3; the comparison model (and our own
 * pixel math) reads raw values, so the same color decodes differently between
 * a P3 design and an sRGB browser capture. Convert to sRGB where the OS
 * tooling exists. Non-PNG inputs (JPEG designs) are transcoded to PNG in the
 * same pass so the pixel-math features (luma retry, autocrop) can run on them.
 */
export async function normalizeToSrgb(
  path: string,
  outDir: string,
  tempFiles: string[]
): Promise<string> {
  if (process.platform !== "darwin") return path;
  try {
    const isPng = (await readPngSize(path)) !== undefined;
    const { stdout } = await execFileAsync("sips", ["-g", "profile", path], {
      timeout: 5000,
    });
    const isSrgb = /sRGB/i.test(stdout);
    if (isPng && isSrgb) return path;
    const out = join(
      outDir,
      `design-srgb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
    );
    const args = ["-s", "format", "png"];
    if (!isSrgb) {
      args.push("--matchTo", "/System/Library/ColorSync/Profiles/sRGB Profile.icc");
    }
    args.push(path, "--out", out);
    await execFileAsync("sips", args, { timeout: 15000 });
    tempFiles.push(out);
    return out;
  } catch {
    return path;
  }
}
