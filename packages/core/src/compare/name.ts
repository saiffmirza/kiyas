import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { Discrepancy } from "./index.js";

const execFileAsync = promisify(execFile);

export interface NameContext {
  figmaUrl?: string;
  designImage?: string;
  targetUrl: string;
  selector?: string;
  componentFile?: string;
  discrepancies: Discrepancy[];
}

/**
 * Ask the provider CLI for a short human name describing what was compared
 * ("Resume header", "Pricing page hero"). Text-only, so it costs a few
 * seconds, not a full image pass. Returns undefined on any failure — callers
 * fall back to their existing naming.
 */
export async function generateComparisonName(
  provider: "claude" | "openai",
  context: NameContext,
  modelId?: string
): Promise<string | undefined> {
  const facts = [
    context.componentFile && `component file: ${context.componentFile}`,
    context.selector && `CSS selector: ${context.selector}`,
    `page URL: ${context.targetUrl}`,
    context.figmaUrl && `Figma link: ${context.figmaUrl}`,
    context.designImage && `design file name: ${basename(context.designImage)}`,
    context.discrepancies.length > 0 &&
      `elements with findings: ${[
        ...new Set(context.discrepancies.slice(0, 6).map((d) => d.element)),
      ].join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `A design-vs-implementation UI comparison just ran with these inputs:
${facts}

Write a short, memorable name for this comparison naming the UI that was compared — 2 to 5 words, like "Resume header", "Checkout button states", or "Pricing page hero". Do not use the words "comparison", "design", or "implementation". No quotes, no trailing punctuation. Respond with the name only.`;

  const cwd = await mkdtemp(join(tmpdir(), "kiyas-name-"));
  try {
    const timeout = 30_000;
    let text: string;
    if (provider === "claude") {
      const args = ["-p", prompt, "--output-format", "text", "--max-turns", "1"];
      if (modelId) args.push("--model", modelId);
      const promise = execFileAsync("claude", args, { cwd, timeout });
      promise.child.stdin?.end();
      ({ stdout: text } = await promise);
    } else {
      const outFile = join(cwd, "name.txt");
      const args = [
        "exec",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--output-last-message",
        outFile,
      ];
      if (modelId) args.push("-m", modelId);
      args.push(prompt);
      await execFileAsync("codex", args, { cwd, timeout });
      text = await readFile(outFile, "utf-8");
    }
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const name = lines[lines.length - 1]
      ?.replace(/^["'`]+|["'`.]+$/g, "")
      .slice(0, 60);
    return name || undefined;
  } catch {
    return undefined;
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
