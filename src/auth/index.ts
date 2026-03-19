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
  } else {
    const token = await resolveOpenAIAuth();
    if (token) return { provider: "openai", token };
  }

  // No token found — tell the user how to sign in
  const tool = preferredModel === "claude" ? "Claude Code" : "Codex";
  const command = preferredModel === "claude" ? "claude" : "codex";

  throw new Error(
    `\n${chalk.bold(`No ${tool} session found.`)}\n\n` +
      `kiyas uses your existing ${tool} subscription — no API keys needed.\n\n` +
      `Sign in by running:\n\n` +
      `  ${chalk.cyan(`${command} auth login`)}\n\n` +
      `Then re-run kiyas.`
  );
}
