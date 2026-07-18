import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseDiscrepancies, type Discrepancy } from "./index.js";
import { extractJson } from "./extract-json.js";

const execFileAsync = promisify(execFile);

export async function compareWithOpenAI(
  designPath: string,
  implPath: string,
  prompt: string
): Promise<Discrepancy[]> {
  const absDesign = resolve(designPath);
  const absImpl = resolve(implPath);

  const fullPrompt = [
    "The first attached image is the Figma design (expected state).",
    "The second attached image is the implementation screenshot (actual state).",
    prompt,
  ].join("\n\n");

  const dir = await mkdtemp(join(tmpdir(), "kiyas-compare-"));
  const outFile = join(dir, "last-message.txt");

  let text: string;
  try {
    await execFileAsync(
      "codex",
      [
        "exec",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--image",
        absDesign,
        "--image",
        absImpl,
        "--output-last-message",
        outFile,
        fullPrompt,
      ],
      {
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    text = (await readFile(outFile, "utf-8")).trim();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  return parseDiscrepancies(extractJson(text, "array"));
}
