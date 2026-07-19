import {
  resolveClaudeAuth,
  resolveOpenAIAuth,
  resolveFigmaToken,
} from "@kiyas/core";
import type { DoctorReport } from "../shared/types.js";

export async function runDoctor(): Promise<DoctorReport> {
  const [claude, codex] = await Promise.all([
    resolveClaudeAuth().catch(() => false),
    resolveOpenAIAuth().catch(() => false),
  ]);

  return {
    claude: { ok: claude },
    codex: { ok: codex },
    figmaToken: { ok: Boolean(resolveFigmaToken()) },
  };
}
