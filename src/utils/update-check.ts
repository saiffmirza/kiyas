import { VERSION } from "../version.js";

// Fire-and-forget: never blocks startup, never throws. Logs to stderr so
// MCP stdio framing on stdout is untouched.
export function checkForUpdate(): void {
  void (async () => {
    try {
      const res = await fetch("https://registry.npmjs.org/kiyas-cli/latest", {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return;
      const { version } = (await res.json()) as { version?: string };
      if (version && isNewer(version, VERSION)) {
        console.error(
          `kiyas ${version} is available (you're running ${VERSION}). ` +
            `Update: \`npm install -g kiyas-cli@latest\`, or use \`npx kiyas-cli@latest\` in your MCP config.`
        );
      }
    } catch {
      // offline or registry hiccup — stay quiet
    }
  })();
}

function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split(".").map((n) => parseInt(n, 10));
  const b = current.split(".").map((n) => parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}
