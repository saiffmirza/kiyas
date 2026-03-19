import type { FigmaNodeMetadata } from "../capture/figma.js";

export function buildComparisonPrompt(metadata?: FigmaNodeMetadata): string {
  let metadataContext = "";
  if (metadata) {
    metadataContext = `\n\nAdditional Figma node metadata (use to validate your observations):\n${JSON.stringify(metadata, null, 2)}\n`;
  }

  return `You are a senior UI engineer and design QA specialist. You are comparing a Figma design (the "expected" state) against a live implementation screenshot (the "actual" state).

Analyze both images and identify all visual discrepancies between the design and the implementation. For each discrepancy, provide:

1. **Element**: What UI element is affected (e.g., "primary button", "card header", "navigation bar")
2. **Property**: What CSS/design property is different (e.g., border-radius, font-size, padding, color, gap)
3. **Expected**: What the Figma design shows (be specific with values where possible)
4. **Actual**: What the implementation appears to show
5. **Severity**: Rate as HIGH (clearly visible to users, breaks design intent), MEDIUM (noticeable but minor), or LOW (subtle, cosmetic)

Also note:
- Any elements present in the design but missing from the implementation
- Any elements present in the implementation but not in the design
- Overall layout/alignment differences
${metadataContext}
Format your response as a JSON array of objects with the fields: element, property, expected, actual, severity.

If the implementation matches the design perfectly, return an empty array and note that the comparison passed.

Respond ONLY with valid JSON. No markdown fences, no commentary outside the JSON.`;
}
