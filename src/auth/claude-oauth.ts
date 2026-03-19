import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { promisify } from "node:util";
import { log } from "../utils/logger.js";

const execFileAsync = promisify(execFile);

/**
 * Read the Claude Code OAuth token from the user's machine.
 *
 * Resolution order:
 *   1. macOS Keychain (service: "Claude Code-credentials")
 *   2. CLAUDE_CODE_OAUTH_TOKEN env var
 *   3. ~/.claude/.credentials.json (Linux/Windows fallback)
 */
export async function resolveClaudeAuth(): Promise<string | undefined> {
  // 1. macOS Keychain
  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync("security", [
        "find-generic-password",
        "-s",
        "Claude Code-credentials",
        "-w",
      ]);
      const token = stdout.trim();
      if (token) {
        log.dim("Using Claude Code OAuth token from macOS Keychain");
        return token;
      }
    } catch {
      // Not found in keychain — continue
    }
  }

  // 2. CLAUDE_CODE_OAUTH_TOKEN env var
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    log.dim("Using CLAUDE_CODE_OAUTH_TOKEN from environment");
    return process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }

  // 3. ~/.claude/.credentials.json (Linux/Windows)
  const credentialsPath = resolve(homedir(), ".claude", ".credentials.json");
  if (existsSync(credentialsPath)) {
    try {
      const raw = await readFile(credentialsPath, "utf-8");
      const data = JSON.parse(raw);
      const token = extractOAuthToken(data);
      if (token) {
        log.dim("Using Claude Code OAuth token from ~/.claude/.credentials.json");
        return token;
      }
    } catch {
      // ignore
    }
  }

  return undefined;
}

function extractOAuthToken(data: Record<string, unknown>): string | undefined {
  for (const value of Object.values(data)) {
    if (typeof value === "string" && value.startsWith("sk-ant-oat01-")) {
      return value;
    }
    if (typeof value === "string" && value.startsWith("sk-ant-")) {
      return value;
    }
    if (typeof value === "object" && value !== null) {
      const nested = extractOAuthToken(value as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return undefined;
}
