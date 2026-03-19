import type { FigmaNodeMetadata } from "../capture/figma.js";
import { buildComparisonPrompt } from "./prompt.js";
import { compareWithClaude } from "./claude.js";
import { compareWithOpenAI } from "./openai.js";

export interface Discrepancy {
  element: string;
  property: string;
  expected: string;
  actual: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

export interface CompareOptions {
  designPath: string;
  implPath: string;
  provider: "claude" | "openai";
  token: string;
  metadata?: FigmaNodeMetadata;
}

export async function compareImages(
  options: CompareOptions
): Promise<Discrepancy[]> {
  const prompt = buildComparisonPrompt(options.metadata);

  if (options.provider === "claude") {
    return compareWithClaude(
      options.designPath,
      options.implPath,
      prompt,
      options.token
    );
  } else {
    return compareWithOpenAI(
      options.designPath,
      options.implPath,
      prompt,
      options.token
    );
  }
}
