import chalk from "chalk";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { resolveClaudeAuth } from "./auth/claude-oauth.js";
import { resolveOpenAIAuth } from "./auth/openai-auth.js";
import { resolveFigmaToken } from "./config.js";
import { saveSetting } from "./settings.js";
import { ask } from "./utils/prompt.js";
import { log } from "./utils/logger.js";

export async function runSetup() {
  console.log(
    chalk.bold("\n  kiyas ") +
      chalk.dim("(كياس)") +
      chalk.bold(" — setup\n")
  );

  // --- Step 1: Figma token ---
  console.log(chalk.bold("  Step 1: Figma Access Token\n"));

  const existingToken = resolveFigmaToken();
  if (existingToken) {
    log.success("Figma token already configured\n");
  } else {
    console.log(
      `  kiyas needs a Figma access token to ${chalk.bold("read")} your design files.\n` +
      `  The token is ${chalk.bold("only used for read access")} — kiyas never modifies your Figma files.\n`
    );

    console.log(chalk.bold("  How to create a token:\n"));
    console.log(
      `  1. Open Figma → click your avatar (top-left) → ${chalk.bold("Settings")}\n` +
      `  2. Scroll down to ${chalk.bold("Personal access tokens")}\n` +
      `  3. Click ${chalk.bold("Generate new token")}\n` +
      `  4. Give it a name (e.g. "kiyas")\n` +
      `  5. Under ${chalk.bold("Scopes")}, only check ${chalk.cyan("File content")} → ${chalk.cyan("Read only")}\n` +
      `     (kiyas only needs to export images from your designs)\n` +
      `  6. Click ${chalk.bold("Generate token")} and copy it\n`
    );

    console.log(
      `  ${chalk.bold("A)")} Add the token to a ${chalk.bold(".env")} file (recommended for projects)\n` +
      `  ${chalk.bold("B)")} Paste it here and save to .env\n`
    );

    const choice = await ask("  Choose an option (A/B): ");

    if (choice.toLowerCase() === "a") {
      console.log(
        `\n  Add this line to ${chalk.bold(".env")} in your project root:\n\n` +
        `    ${chalk.cyan("FIGMA_ACCESS_TOKEN=your-token-here")}\n`
      );
      await ask("  Press Enter when ready...");

      const envPath = resolve(process.cwd(), ".env");
      if (existsSync(envPath)) {
        const raw = await readFile(envPath, "utf-8");
        const match = raw.match(/^FIGMA_ACCESS_TOKEN=(.+)$/m);
        if (match?.[1]?.trim() && match[1].trim() !== "your-token-here") {
          log.success("Figma token found in .env\n");
        } else {
          log.warn("Token not detected in .env — you can set it up later\n");
        }
      } else {
        log.warn("No .env file found — you can set it up later\n");
      }
    } else {
      const token = await ask("  Paste your Figma token: ");
      if (token) {
        const envPath = resolve(process.cwd(), ".env");
        const line = `FIGMA_ACCESS_TOKEN=${token}`;
        if (existsSync(envPath)) {
          await appendFile(envPath, `\n${line}\n`);
        } else {
          await writeFile(envPath, `${line}\n`);
        }
        log.success("Token saved to .env\n");
      } else {
        log.warn("No token provided — you can set it up later\n");
      }
    }
  }

  // --- Step 2: AI provider ---
  console.log(chalk.bold("  Step 2: AI Provider\n"));
  console.log(
    `  kiyas uses your existing AI subscription — ${chalk.bold("no API keys needed")}.\n` +
    `  It works with either ${chalk.cyan("Claude Code")} or ${chalk.cyan("OpenAI Codex")}.\n`
  );

  const hasClaudeCode = await resolveClaudeAuth();
  const hasCodex = !!(await resolveOpenAIAuth());

  if (hasClaudeCode && hasCodex) {
    log.success("Both Claude Code and Codex detected");
    console.log(chalk.dim("  Using Claude as default (change with: kiyas set model openai)\n"));
  } else if (hasClaudeCode) {
    log.success("Claude Code detected — using Claude as AI provider\n");
  } else if (hasCodex) {
    log.success("Codex detected — using OpenAI as AI provider");
    saveSetting("model", "openai");
    console.log(chalk.dim("  Set as default model\n"));
  } else {
    log.warn("No AI provider found\n");
    console.log(
      `  Install one of the following:\n\n` +
      `  ${chalk.bold("Option 1: Claude Code")} (recommended)\n` +
      `    ${chalk.cyan("npm install -g @anthropic-ai/claude-code")}\n` +
      `    ${chalk.cyan("claude auth login")}\n\n` +
      `  ${chalk.bold("Option 2: OpenAI Codex")}\n` +
      `    ${chalk.cyan("npm install -g @openai/codex")}\n` +
      `    ${chalk.cyan("codex auth login")}\n`
    );
  }

  // --- Done ---
  console.log(chalk.bold("  Setup complete!\n"));
  console.log(
    `  Run a comparison:\n\n` +
    `    ${chalk.cyan('kiyas --figma <figma-url> --target <page-url>')}\n`
  );
}
