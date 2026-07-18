import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseDiscrepancies, type Discrepancy } from "./index.js";
import { extractJson } from "./extract-json.js";

const execFileAsync = promisify(execFile);

export async function compareWithClaude(
  designPath: string,
  implPath: string,
  prompt: string,
  modelId?: string
): Promise<Discrepancy[]> {
  const absDesign = resolve(designPath);
  const absImpl = resolve(implPath);

  const fullPrompt = [
    `Read the image at "${absDesign}". This is the Figma design (expected state).`,
    `Read the image at "${absImpl}". This is the implementation screenshot (actual state).`,
    prompt,
  ].join("\n\n");

  // Run in an empty temp cwd so the host project's CLAUDE.md, hooks, and
  // MCP servers cannot contaminate the comparison output.
  const cwd = await mkdtemp(join(tmpdir(), "kiyas-compare-"));

  try {
    const args = [
      "-p",
      fullPrompt,
      "--output-format",
      "text",
      "--allowedTools",
      "Read",
      "--max-turns",
      "6",
    ];
    if (modelId) {
      args.push("--model", modelId);
    }

    const promise = execFileAsync("claude", args, {
      cwd,
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    // Close stdin so the CLI doesn't wait 3s for piped input
    promise.child.stdin?.end();
    const { stdout } = await promise;

    return parseDiscrepancies(extractJson(stdout, "array"));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
