import { readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import chalk from "chalk";
import { ask } from "./utils/prompt.js";

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

const TOKEN_INSTRUCTIONS =
  `\n  To get a Figma access token:\n` +
  `  1. Open Figma → click your avatar (top-left) → ${chalk.bold("Settings")}\n` +
  `  2. Scroll down to ${chalk.bold("Personal access tokens")}\n` +
  `  3. Click ${chalk.bold("Generate new token")}, give it a name (e.g. "kiyas")\n` +
  `  4. Under ${chalk.bold("Scopes")}, only check ${chalk.cyan("File content")} → ${chalk.cyan("Read only")}\n` +
  `     (kiyas only reads your designs — it never modifies your Figma files)\n` +
  `  5. Click ${chalk.bold("Generate token")} and copy it\n`;

export async function ensureFigmaToken(): Promise<string> {
  const existing = resolveFigmaToken();
  if (existing) return existing;

  console.log(chalk.yellow("\n  Figma access token not found."));
  console.log(chalk.dim(`  Tip: run ${chalk.cyan("kiyas setup")} for full guided setup.\n`));
  console.log(TOKEN_INSTRUCTIONS);
  console.log(
    `  ${chalk.bold("A)")} Add ${chalk.cyan("FIGMA_ACCESS_TOKEN")} to a ${chalk.bold(".env")} file (recommended)\n` +
    `  ${chalk.bold("B)")} Paste the token here\n`
  );

  const choice = await ask("  Choose an option (A/B): ");

  if (choice.toLowerCase() === "a") {
    console.log(
      `\n  Add this line to ${chalk.bold(".env")} in your project root:\n\n` +
      `    ${chalk.cyan("FIGMA_ACCESS_TOKEN=your-token-here")}\n`
    );
    await ask("  Press Enter when ready...");

    // Re-read .env manually since dotenv already ran at startup
    const envPath = resolve(process.cwd(), ".env");
    if (existsSync(envPath)) {
      const raw = await readFile(envPath, "utf-8");
      const match = raw.match(/^FIGMA_ACCESS_TOKEN=(.+)$/m);
      if (match?.[1]) {
        const token = match[1].trim();
        if (token && token !== "your-token-here") {
          console.log(chalk.green("\n  ✔ Token found in .env\n"));
          return token;
        }
      }
    }
    throw new Error(
      "Could not find FIGMA_ACCESS_TOKEN in .env. Make sure the file is saved and the token is set."
    );
  }

  // Option B: paste directly
  const token = await ask("  Paste your Figma token: ");
  if (!token) {
    throw new Error("No token provided.");
  }

  // Offer to save to .env for next time
  const save = await ask("  Save to .env for future use? (Y/n): ");
  if (save.toLowerCase() !== "n") {
    const envPath = resolve(process.cwd(), ".env");
    const line = `FIGMA_ACCESS_TOKEN=${token}\n`;
    if (existsSync(envPath)) {
      await appendFile(envPath, `\n${line}`);
    } else {
      await writeFile(envPath, line);
    }
    console.log(chalk.green("  ✔ Saved to .env\n"));
  }

  return token;
}
