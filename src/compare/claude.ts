import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import type { Discrepancy } from "./index.js";

const execFileAsync = promisify(execFile);

export async function compareWithClaude(
  designPath: string,
  implPath: string,
  prompt: string,
  _token: string
): Promise<Discrepancy[]> {
  const absDesign = resolve(designPath);
  const absImpl = resolve(implPath);

  const fullPrompt = [
    `Read the image at "${absDesign}". This is the Figma design (expected state).`,
    `Read the image at "${absImpl}". This is the implementation screenshot (actual state).`,
    prompt,
  ].join("\n\n");

  const { stdout } = await execFileAsync(
    "claude",
    [
      "-p",
      fullPrompt,
      "--output-format",
      "text",
      "--allowedTools",
      "Read",
      "--max-turns",
      "5",
    ],
    {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  const text = stdout.trim();

  // Extract JSON from response (handle possible markdown fences)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    if (text.includes("[]") || text.toLowerCase().includes("matches")) {
      return [];
    }
    throw new Error(`Could not parse Claude response as JSON:\n${text.slice(0, 500)}`);
  }

  return JSON.parse(jsonMatch[0]) as Discrepancy[];
}
