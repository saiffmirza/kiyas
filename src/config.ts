import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

export interface ComparisonConfig {
  name?: string;
  figma: string;
  target: string; // URL or component description (e.g. "eventHeader on redemption screen")
  selector?: string;
  viewport?: string;
  wait?: number;
  threshold?: "all" | "medium" | "high";
}

export interface KiyasConfig {
  figmaAccessToken?: string;
  model?: "claude" | "openai";
  viewport?: string;
  comparisons: ComparisonConfig[];
}

export async function loadConfigFile(path: string): Promise<KiyasConfig> {
  const resolved = resolve(path);
  const raw = await readFile(resolved, "utf-8");
  const config = JSON.parse(raw) as KiyasConfig;

  if (!config.comparisons || !Array.isArray(config.comparisons)) {
    throw new Error("Config file must contain a 'comparisons' array.");
  }

  for (const c of config.comparisons) {
    if (!c.figma || !c.target) {
      throw new Error(
        `Each comparison must have 'figma' and 'target'. Invalid: ${JSON.stringify(c)}`
      );
    }
  }

  // Resolve env: references
  if (
    config.figmaAccessToken &&
    config.figmaAccessToken.startsWith("env:")
  ) {
    const envVar = config.figmaAccessToken.slice(4);
    config.figmaAccessToken = process.env[envVar];
  }

  return config;
}

export function resolveFigmaToken(): string | undefined {
  // 1. Env var
  if (process.env.FIGMA_ACCESS_TOKEN) {
    return process.env.FIGMA_ACCESS_TOKEN;
  }

  // 2. .kiyasrc in current directory
  const localRc = resolve(process.cwd(), ".kiyasrc");
  if (existsSync(localRc)) {
    try {
      const raw = require("node:fs").readFileSync(localRc, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.figmaAccessToken) return parsed.figmaAccessToken;
    } catch {
      // ignore
    }
  }

  // 3. .kiyasrc in home directory
  const homeRc = resolve(homedir(), ".kiyasrc");
  if (existsSync(homeRc)) {
    try {
      const raw = require("node:fs").readFileSync(homeRc, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.figmaAccessToken) return parsed.figmaAccessToken;
    } catch {
      // ignore
    }
  }

  return undefined;
}
