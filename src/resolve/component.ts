import { readFile } from "node:fs/promises";
import { log } from "../utils/logger.js";

export interface ResolvedComponent {
  url: string;
  selector?: string;
  filePath: string;
  componentName: string;
}

/**
 * Uses Claude or OpenAI as an agent to search the codebase,
 * find the described component, and determine how to render/screenshot it.
 */
export async function resolveComponent(
  description: string,
  devServerUrl: string,
  provider: "claude" | "openai",
  token: string,
  cwd: string
): Promise<ResolvedComponent> {
  const prompt = buildResolverPrompt(description, devServerUrl, cwd);

  if (provider === "claude") {
    return resolveWithClaude(prompt, token);
  } else {
    return resolveWithOpenAI(prompt, token);
  }
}

function buildResolverPrompt(
  description: string,
  devServerUrl: string,
  cwd: string
): string {
  return `You are a codebase navigator. A user wants to find and screenshot a UI component.

Their description: "${description}"
Dev server running at: ${devServerUrl}
Project root: ${cwd}

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

async function resolveWithClaude(
  prompt: string,
  token: string
): Promise<ResolvedComponent> {
  // First, gather codebase context by reading common structure files
  const cwd = process.cwd();
  const contextFiles = await gatherCodebaseContext(cwd);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": token,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 4096,
      system:
        "You are an expert at navigating codebases. You find components and determine how to render them in a browser. Always respond with valid JSON only.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Here is the project structure and relevant files:\n\n${contextFiles}`,
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API error during component resolution (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content.find((b) => b.type === "text");
  if (!textBlock?.text) {
    throw new Error("Claude returned no response when resolving component");
  }

  return parseResolverResponse(textBlock.text);
}

async function resolveWithOpenAI(
  prompt: string,
  token: string
): Promise<ResolvedComponent> {
  const cwd = process.cwd();
  const contextFiles = await gatherCodebaseContext(cwd);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content:
            "You are an expert at navigating codebases. You find components and determine how to render them in a browser. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Here is the project structure and relevant files:\n\n${contextFiles}\n\n${prompt}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error during component resolution (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned no response when resolving component");
  }

  return parseResolverResponse(content);
}

function parseResolverResponse(raw: string): ResolvedComponent {
  // Strip markdown fences if present
  const cleaned = raw.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.url || !parsed.filePath || !parsed.componentName) {
      throw new Error(
        `AI response missing required fields. Got: ${JSON.stringify(parsed)}`
      );
    }
    return {
      url: parsed.url,
      selector: parsed.selector ?? undefined,
      filePath: parsed.filePath,
      componentName: parsed.componentName,
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `AI returned invalid JSON when resolving component:\n${raw}`
      );
    }
    throw err;
  }
}

/**
 * Gathers a snapshot of the project structure and key config files
 * to give the AI enough context to find components.
 */
async function gatherCodebaseContext(cwd: string): Promise<string> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);

  const sections: string[] = [];

  // 1. File tree (limited depth)
  try {
    const { stdout } = await exec("find", [
      cwd,
      "-maxdepth",
      "4",
      "-type",
      "f",
      "-not",
      "-path",
      "*/node_modules/*",
      "-not",
      "-path",
      "*/.git/*",
      "-not",
      "-path",
      "*/dist/*",
      "-not",
      "-path",
      "*/.next/*",
    ]);
    const files = stdout
      .split("\n")
      .filter(Boolean)
      .map((f) => f.replace(cwd + "/", ""));
    sections.push(`## File tree\n${files.join("\n")}`);
  } catch {
    // ignore
  }

  // 2. Package.json (for framework detection)
  try {
    const pkg = await readFile(`${cwd}/package.json`, "utf-8");
    sections.push(`## package.json\n${pkg}`);
  } catch {
    // ignore
  }

  // 3. Route/page files (look for common patterns)
  const routePatterns = [
    "src/App.tsx",
    "src/App.jsx",
    "src/app/layout.tsx",
    "src/pages/_app.tsx",
    "src/router.tsx",
    "src/routes.tsx",
    "app/layout.tsx",
    "pages/_app.tsx",
    ".storybook/main.ts",
    ".storybook/main.js",
  ];

  for (const pattern of routePatterns) {
    try {
      const content = await readFile(`${cwd}/${pattern}`, "utf-8");
      sections.push(`## ${pattern}\n${content.slice(0, 3000)}`);
    } catch {
      // file doesn't exist — skip
    }
  }

  // 4. Grep for the component patterns in src/
  try {
    const { stdout } = await exec("grep", [
      "-rl",
      "--include=*.tsx",
      "--include=*.jsx",
      "--include=*.vue",
      "--include=*.svelte",
      "-m",
      "1",
      "export",
      `${cwd}/src`,
    ]);
    const componentFiles = stdout.split("\n").filter(Boolean).slice(0, 50);
    sections.push(
      `## Component files found\n${componentFiles.map((f) => f.replace(cwd + "/", "")).join("\n")}`
    );
  } catch {
    // ignore
  }

  return sections.join("\n\n");
}
