import chalk from "chalk";
import { resolveClaudeAuth } from "./claude-oauth.js";
import { resolveOpenAIAuth } from "./openai-auth.js";

export interface AuthResult {
  provider: "claude" | "openai";
  token: string;
}

export async function resolveAuth(
  preferredModel: "claude" | "openai"
): Promise<AuthResult> {
  if (preferredModel === "claude") {
    const token = await resolveClaudeAuth();
    if (token) return { provider: "claude", token };

    throw new Error(
      `\n${chalk.bold("No Claude Code session found.")}\n\n` +
        `kiyas uses your existing Claude Code subscription — no API keys needed.\n\n` +
        `To fix this, either:\n\n` +
        `  1. Sign into Claude Code:\n` +
        `     ${chalk.cyan("claude auth login")}\n\n` +
        `  2. Or switch kiyas to use OpenAI instead:\n` +
        `     ${chalk.cyan("kiyas set model openai")}\n` +
        `     (requires signing into Codex: ${chalk.cyan("codex auth login")})`
    );
  } else {
    const token = await resolveOpenAIAuth();
    if (token) return { provider: "openai", token };

    throw new Error(
      `\n${chalk.bold("No Codex session found.")}\n\n` +
        `kiyas uses your existing Codex subscription — no API keys needed.\n\n` +
        `To fix this, either:\n\n` +
        `  1. Sign into Codex:\n` +
        `     ${chalk.cyan("codex auth login")}\n\n` +
        `  2. Or switch kiyas to use Claude instead:\n` +
        `     ${chalk.cyan("kiyas set model claude")}\n` +
        `     (requires signing into Claude Code: ${chalk.cyan("claude auth login")})`
    );
  }
}
