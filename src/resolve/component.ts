import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { extractJson } from "../compare/extract-json.js";

const execFileAsync = promisify(execFile);

export interface ResolvedComponent {
  url: string;
  selector?: string;
  filePath: string;
  componentName: string;
}

/**
 * Uses the Claude Code or Codex CLI as an agent to search the codebase,
 * find the described component, and determine how to render/screenshot it.
 */
export async function resolveComponent(
  description: string,
  devServerUrl: string,
  provider: "claude" | "openai",
  cwd: string
): Promise<ResolvedComponent> {
  const prompt = buildResolverPrompt(description, devServerUrl);

  const raw =
    provider === "claude"
      ? await resolveWithClaude(prompt, cwd)
      : await resolveWithCodex(prompt, cwd);

  return parseResolverResponse(raw);
}

function buildResolverPrompt(
  description: string,
  devServerUrl: string
): string {
  return `You are a codebase navigator. A user wants to find and screenshot a UI component in this project.

Their description: "${description}"
Dev server running at: ${devServerUrl}

Your job:
1. Search the project files to find the component matching this description
2. Determine the route/URL on the dev server where this component is visible
3. Determine the best CSS selector to isolate just this component for a screenshot

Think step by step:
- Look for component files, page files, route definitions, and Storybook stories
- Check the project's routing setup (Next.js pages/app dir, React Router, Vue Router, etc.)
- If it's a Storybook project, find the story ID for the component

Respond ONLY with valid JSON (no markdown fences, no commentary):
{
  "url": "the full URL on the dev server where this component is visible",
  "selector": "CSS selector to isolate the component (or null for full page)",
  "filePath": "path to the component source file",
  "componentName": "the resolved component name"
}`;
}

async function resolveWithClaude(prompt: string, cwd: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "claude",
    [
      "-p",
      prompt,
      "--output-format",
      "text",
      "--allowedTools",
      "Read",
      "Glob",
      "Grep",
      "--max-turns",
      "30",
    ],
    {
      cwd,
      timeout: 180_000,
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  return stdout;
}

async function resolveWithCodex(prompt: string, cwd: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "kiyas-resolve-"));
  const outFile = join(dir, "last-message.txt");

  try {
    await execFileAsync(
      "codex",
      [
        "exec",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--output-last-message",
        outFile,
        prompt,
      ],
      {
        cwd,
        timeout: 180_000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    return await readFile(outFile, "utf-8");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const resolvedComponentSchema = z.object({
  url: z.string().refine(
    (u) => {
      try {
        new URL(u);
        return true;
      } catch {
        return false;
      }
    },
    { message: "url must be an absolute URL including the scheme" }
  ),
  selector: z.string().nullish(),
  filePath: z.string().min(1),
  componentName: z.string().min(1),
});

function parseResolverResponse(raw: string): ResolvedComponent {
  const result = resolvedComponentSchema.safeParse(extractJson(raw, "object"));
  if (!result.success) {
    throw new Error(
      `AI returned an invalid component resolution: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}\nRaw response:\n${raw.slice(0, 500)}`
    );
  }

  return {
    url: result.data.url,
    selector: result.data.selector ?? undefined,
    filePath: result.data.filePath,
    componentName: result.data.componentName,
  };
}
