import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Finder-launched apps inherit launchd's minimal PATH, so CLIs installed via
 * Homebrew/npm (claude, codex, npx) are invisible. Resolve the user's
 * login-shell PATH once and patch process.env before anything spawns.
 */
export async function fixPath(): Promise<void> {
  if (process.platform === "win32") return;
  const shell = process.env.SHELL || "/bin/zsh";
  try {
    // Parse `env` for the PATH line rather than echoing $PATH: rc files may
    // print to stdout, and fish expands "$PATH" space-joined — env prints it
    // colon-joined in every shell.
    const { stdout } = await execFileAsync(shell, ["-ilc", "env"], {
      timeout: 5000,
    });
    const match = stdout.match(/^PATH=(.+)$/m);
    if (match) process.env.PATH = match[1];
  } catch {
    // keep the inherited PATH; doctor checks will surface missing CLIs
  }
}
