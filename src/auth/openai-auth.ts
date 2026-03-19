import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { promisify } from "node:util";
import { log } from "../utils/logger.js";

const execFileAsync = promisify(execFile);

/**
 * Read the OpenAI Codex CLI auth token from the user's machine.
 *
 * Resolution order:
 *   1. macOS Keychain (Codex CLI stores tokens here by default)
 *   2. ~/.codex/auth.json (file-based storage fallback)
 */
export async function resolveOpenAIAuth(): Promise<string | undefined> {
  // 1. macOS Keychain
  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync("security", [
        "find-generic-password",
        "-s",
        "codex-credentials",
        "-w",
      ]);
      const token = stdout.trim();
      if (token) {
        log.dim("Using Codex OAuth token from macOS Keychain");
        return token;
      }
    } catch {
      // Not found in keychain — continue
    }
  }

  // 2. ~/.codex/auth.json (file-based storage)
  const authPath = resolve(homedir(), ".codex", "auth.json");
  if (existsSync(authPath)) {
    try {
      const raw = await readFile(authPath, "utf-8");
      const data = JSON.parse(raw);
      const token =
        data.access_token ?? data.token ?? data.api_key ?? data.key;
      if (typeof token === "string" && token.length > 0) {
        log.dim("Using Codex auth token from ~/.codex/auth.json");
        return token;
      }
    } catch {
      // ignore
    }
  }

  return undefined;
}
