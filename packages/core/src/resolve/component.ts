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
  cwd: string,
  modelId?: string,
  designImage?: string
): Promise<ResolvedComponent> {
  const prompt = buildResolverPrompt(description, devServerUrl, designImage);

  const raw =
    provider === "claude"
      ? await resolveWithClaude(prompt, cwd, modelId)
      : await resolveWithCodex(prompt, cwd, modelId);

  return parseResolverResponse(raw);
}

function buildResolverPrompt(
  description: string,
  devServerUrl: string,
  designImage?: string
): string {
  const designBlock = designImage
    ? `\nA screenshot of the DESIGN being compared is at: ${designImage}
Read this image FIRST. The selector you return must isolate a DOM region that
visually covers everything shown in that design — every heading, button, badge,
and decoration in the image must fall inside the selected element.\n`
    : "";

  return `You are a codebase navigator. A user wants to find and screenshot a UI component in this project.

Their description: "${description}"
Dev server running at: ${devServerUrl}
${designBlock}
Your job:
1. Search the project files to find the component matching this description
2. Determine the route/URL on the dev server where this component is visible
3. Determine the best CSS selector to isolate just this component for a screenshot

Think step by step:
- Look for component files, page files, route definitions, and Storybook stories
- Check the project's routing setup (Next.js pages/app dir, React Router, Vue Router, etc.)
- If it's a Storybook project, find the story ID for the component

Selector rules (important):
- Return the SMALLEST stable container that encloses the ENTIRE component — its
  wrapper <section>/<article>/<div>, not an element inside it.
- NEVER return a bare text-bearing tag (h1, h2, p, span, a, button) unless the
  described component is literally just that one element. Matching the
  component's title text is not the same as matching the component.
- Prefer, in order: an id (#hero), a data attribute ([data-testid=…]), a
  distinctive class from the source, a semantic landmark (main > section:first-child).
- If unsure between two candidates, pick the larger container.

Respond ONLY with valid JSON (no markdown fences, no commentary):
{
  "url": "the full URL on the dev server where this component is visible",
  "selector": "CSS selector to isolate the component (or null for full page)",
  "filePath": "path to the component source file",
  "componentName": "the resolved component name"
}`;
}

async function resolveWithClaude(
  prompt: string,
  cwd: string,
  modelId?: string
): Promise<string> {
  const args = [
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
  ];
  if (modelId) {
    args.push("--model", modelId);
  }

  const promise = execFileAsync("claude", args, {
    cwd,
    timeout: 180_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  promise.child.stdin?.end();
  const { stdout } = await promise;

  return stdout;
}

async function resolveWithCodex(
  prompt: string,
  cwd: string,
  modelId?: string
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "kiyas-resolve-"));
  const outFile = join(dir, "last-message.txt");

  const args = [
    "exec",
    "--sandbox",
    "read-only",
    "--skip-git-repo-check",
    "--output-last-message",
    outFile,
  ];
  if (modelId) {
    args.push("-m", modelId);
  }
  args.push(prompt);

  try {
    await execFileAsync(
      "codex",
      args,
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
