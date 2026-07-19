import { readPngSize } from "../utils/png-size.js";

/**
 * Sanity check that two captures plausibly show the same component.
 * Returns a human-readable warning when the implementation capture is a tiny
 * sliver or its aspect ratio is wildly different from the design's — the
 * classic symptom of a wrong selector (e.g. a bare `h1` instead of the card
 * that contains it).
 */
export async function captureMismatchWarning(
  designPath: string,
  implPath: string
): Promise<string | undefined> {
  const [design, impl] = await Promise.all([
    readPngSize(designPath),
    readPngSize(implPath),
  ]);
  if (!design || !impl) return undefined;

  if (impl.width < 80 || impl.height < 80) {
    return `Implementation capture is only ${impl.width}×${impl.height}px — the selector likely matched a single element inside the component instead of the component itself.`;
  }

  const ratio =
    design.width / design.height / (impl.width / impl.height);
  if (ratio > 2.5 || ratio < 0.4) {
    return `Capture shapes differ a lot (design ${design.width}×${design.height}, implementation ${impl.width}×${impl.height}) — the screenshot may not cover the same region as the design.`;
  }

  return undefined;
}
