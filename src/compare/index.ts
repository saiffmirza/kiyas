import { z } from "zod";
import type { FigmaNodeMetadata } from "../capture/figma.js";
import { buildComparisonPrompt } from "./prompt.js";
import { compareWithClaude } from "./claude.js";
import { compareWithOpenAI } from "./openai.js";
import { log } from "../utils/logger.js";
import { readPngSize } from "../utils/png-size.js";

export interface Discrepancy {
  element: string;
  property: string;
  expected: string;
  actual: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

const discrepancySchema = z.object({
  element: z.string().min(1),
  property: z.string().min(1),
  expected: z.coerce.string(),
  actual: z.coerce.string(),
  severity: z
    .string()
    .transform((s) => s.toUpperCase())
    .pipe(z.enum(["HIGH", "MEDIUM", "LOW"])),
});

/**
 * Validates raw model output into Discrepancy[]. Malformed items are
 * dropped with a warning; if the majority fail validation the whole
 * run fails rather than producing a quietly wrong report.
 */
export function parseDiscrepancies(raw: unknown): Discrepancy[] {
  if (!Array.isArray(raw)) {
    throw new Error(
      `AI response is not a JSON array of discrepancies. Got: ${JSON.stringify(raw)?.slice(0, 300)}`
    );
  }

  const valid: Discrepancy[] = [];
  let dropped = 0;
  for (const item of raw) {
    const result = discrepancySchema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      dropped++;
      log.warn(
        `Dropping malformed discrepancy: ${JSON.stringify(item)?.slice(0, 200)}`
      );
    }
  }

  if (dropped > raw.length / 2) {
    throw new Error(
      `${dropped}/${raw.length} discrepancies failed validation — AI output is unreliable, aborting.`
    );
  }

  return valid;
}

export interface CompareOptions {
  designPath: string;
  implPath: string;
  provider: "claude" | "openai";
  metadata?: FigmaNodeMetadata;
}

export async function compareImages(
  options: CompareOptions
): Promise<Discrepancy[]> {
  const [designSize, implSize] = await Promise.all([
    readPngSize(options.designPath).catch(() => undefined),
    readPngSize(options.implPath).catch(() => undefined),
  ]);
  const prompt = buildComparisonPrompt(options.metadata, {
    design: designSize,
    impl: implSize,
  });

  if (options.provider === "claude") {
    return compareWithClaude(options.designPath, options.implPath, prompt);
  } else {
    return compareWithOpenAI(options.designPath, options.implPath, prompt);
  }
}
