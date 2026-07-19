/**
 * Adaptive capture scale. `focused` means the capture targets one component —
 * an explicit selector OR a component description (resolution produces a
 * selector later). Focused captures must be retina: designs are usually 2x
 * screenshots or 2x Figma exports, and a 1x capture makes the AI misread
 * every measurement. Large full-page captures stay 1x — the vision model
 * downscales them anyway.
 */
export function defaultCaptureScale(viewport: string, focused: boolean): number {
  if (focused) return 2;
  const match = viewport.match(/^(\d+)x(\d+)$/);
  if (!match) return 1;
  return Math.max(parseInt(match[1], 10), parseInt(match[2], 10)) <= 1000 ? 2 : 1;
}
