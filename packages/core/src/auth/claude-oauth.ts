import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { log } from "../utils/logger.js";

const execFileAsync = promisify(execFile);

/**
 * Check that the Claude Code CLI is installed and authenticated.
 * kiyas delegates inference to the CLI, which handles its own OAuth.
 */
export async function resolveClaudeAuth(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("claude", ["--version"], {
      timeout: 5000,
    });
    if (stdout.trim()) {
      log.dim(`Using Claude Code CLI (${stdout.trim()})`);
      return true;
    }
  } catch {
    // CLI not found or errored
  }

  return false;
}
