import type { FigmaNodeMetadata } from "../capture/figma.js";
import type { PngSize } from "../utils/png-size.js";

export interface ImageDimensions {
  design?: PngSize;
  impl?: PngSize;
}

export function buildComparisonPrompt(
  metadata?: FigmaNodeMetadata,
  dimensions?: ImageDimensions
): string {
  let metadataContext = "";
  if (metadata) {
    metadataContext = `\n\nAdditional Figma node metadata (use to validate your observations):\n${JSON.stringify(metadata, null, 2)}\n`;
  }

  let scaleContext = "";
  if (dimensions?.design && dimensions?.impl) {
    scaleContext = `\n\nImage dimensions: the design image is ${dimensions.design.width}x${dimensions.design.height}px, the implementation screenshot is ${dimensions.impl.width}x${dimensions.impl.height}px. The images may be rendered at different scales — compare proportions, ratios, and relative values rather than absolute pixel measurements.\n`;
  }

  return `You are a senior UI engineer and design QA specialist. You are comparing a Figma design (the "expected" state) against a live implementation screenshot (the "actual" state).

Analyze both images and identify all visual discrepancies between the design and the implementation. For each discrepancy, provide:

1. **Element**: What UI element is affected (e.g., "primary button", "card header", "navigation bar")
2. **Property**: What CSS/design property is different (e.g., border-radius, font-size, padding, color, gap)
3. **Expected**: What the Figma design shows (be specific with values where possible)
4. **Actual**: What the implementation appears to show
5. **Severity**: Rate as HIGH (clearly visible to users, breaks design intent), MEDIUM (noticeable but minor), or LOW (subtle, cosmetic)
6. **Region**: An approximate bounding box of the affected area in the implementation screenshot, in pixels: {"x": ..., "y": ..., "width": ..., "height": ...}. A rough location is fine; omit it if you cannot locate the element.

Also note:
- Any elements present in the design but missing from the implementation
- Any elements present in the implementation but not in the design
- Overall layout/alignment differences

The two images come from different capture pipelines (a design export or OS screenshot vs. a headless-browser screenshot), so some pixel-level variation is inherent and must NOT be reported:
- Anti-aliasing, sub-pixel text rendering, and glyph weight/sharpness differences at identical font sizes
- Slight color rendition shifts from color profiles or compression (report a color only when it is clearly a *different chosen color*, not a slightly different rendition of the same one)
- Sub-5px positional jitter between otherwise matching elements
Only report discrepancies a developer could act on with a CSS change.
${metadataContext}${scaleContext}
Format your response as a JSON array of objects with the fields: element, property, expected, actual, severity, region (optional).

If the implementation matches the design perfectly, return exactly [].

Respond ONLY with valid JSON. No markdown fences, no commentary outside the JSON.`;
}
