export function cliFailure(
  cli: string,
  err: unknown,
  timeoutMs: number
): Error {
  const e = err as Error & {
    code?: number | string;
    signal?: string | null;
    killed?: boolean;
    stdout?: string;
    stderr?: string;
  };
  if (e.code === "ENOENT") {
    return new Error(
      `${cli} CLI not found on PATH — install it or switch AI providers.`
    );
  }
  if (e.killed || e.signal === "SIGTERM") {
    return new Error(`${cli} CLI timed out after ${timeoutMs / 1000}s.`);
  }
  // Deliberately ignore e.message: for exec errors it is "Command failed:
  // <full command line>", which leaks the prompt instead of the cause.
  const detail = [e.stderr?.trim(), e.stdout?.trim()]
    .filter(Boolean)
    .join("\n")
    .slice(-1000);
  return new Error(
    `${cli} CLI exited with code ${e.code ?? "unknown"}` +
      (detail ? `:\n${detail}` : " (no output)")
  );
}
