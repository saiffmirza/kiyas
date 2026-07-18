import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { log } from "../utils/logger.js";

const execFileAsync = promisify(execFile);

/**
 * Check that the Codex CLI is installed and authenticated.
 * kiyas delegates inference to the CLI, which handles its own OAuth.
 */
export async function resolveOpenAIAuth(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("codex", ["--version"], {
      timeout: 5000,
    });
    if (stdout.trim()) {
      log.dim(`Using Codex CLI (${stdout.trim()})`);
      return true;
    }
  } catch {
    // CLI not found or errored
  }

  return false;
}
