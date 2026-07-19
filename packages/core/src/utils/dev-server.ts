const COMMON_PORTS = [3000, 5173, 8080, 4200];

/**
 * Probe common local dev-server ports in parallel and return the first
 * (in priority order) that responds. Any HTTP response counts — even an
 * error status means something is listening. Falls back to :3000.
 */
export async function detectDevServer(): Promise<string> {
  const candidates = COMMON_PORTS.map((port) => `http://localhost:${port}`);
  const results = await Promise.all(
    candidates.map(async (url) => {
      try {
        await fetch(url, { signal: AbortSignal.timeout(1500) });
        return url;
      } catch {
        return null;
      }
    })
  );
  return results.find((url) => url !== null) ?? candidates[0];
}
