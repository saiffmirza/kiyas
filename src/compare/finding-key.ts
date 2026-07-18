import type { Discrepancy } from "./index.js";

/**
 * Canonical property families so "corner radius", "roundness", and
 * "border-radius" cluster together across runs and against eval goldens.
 */
const PROPERTY_SYNONYMS: Record<string, string> = {
  "corner-radius": "border-radius",
  "corner radius": "border-radius",
  roundness: "border-radius",
  "border radius": "border-radius",
  radius: "border-radius",
  colour: "color",
  "background-color": "color",
  "background colour": "color",
  background: "color",
  "text-color": "color",
  "font-color": "color",
  "fill": "color",
  spacing: "gap",
  margin: "gap",
  padding: "gap",
  "white-space": "gap",
  whitespace: "gap",
  "letter-spacing": "letter-spacing",
  "font-size": "font-size",
  "text-size": "font-size",
  "font-weight": "font-weight",
  boldness: "font-weight",
  weight: "font-weight",
  shadow: "box-shadow",
  "drop-shadow": "box-shadow",
  "box shadow": "box-shadow",
  elevation: "box-shadow",
  alignment: "alignment",
  align: "alignment",
  position: "alignment",
  offset: "alignment",
  "missing element": "presence",
  missing: "presence",
  "extra element": "presence",
  presence: "presence",
  visibility: "presence",
  text: "text-content",
  "text-content": "text-content",
  content: "text-content",
  label: "text-content",
  wording: "text-content",
};

export function normalizeProperty(property: string): string {
  const cleaned = property.toLowerCase().trim().replace(/_/g, "-");
  if (PROPERTY_SYNONYMS[cleaned]) return PROPERTY_SYNONYMS[cleaned];
  const spaced = cleaned.replace(/-/g, " ");
  if (PROPERTY_SYNONYMS[spaced]) return PROPERTY_SYNONYMS[spaced];
  for (const [synonym, canonical] of Object.entries(PROPERTY_SYNONYMS)) {
    if (cleaned.includes(synonym)) return canonical;
  }
  return cleaned;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "of", "on", "in", "and", "or", "element", "component",
]);

export function elementTokens(element: string): Set<string> {
  return new Set(
    element
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
  );
}

export function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size);
}

/**
 * Whether two findings describe the same underlying discrepancy:
 * same property family and overlapping element description.
 */
export function sameFinding(
  a: Pick<Discrepancy, "element" | "property">,
  b: Pick<Discrepancy, "element" | "property">
): boolean {
  if (normalizeProperty(a.property) !== normalizeProperty(b.property)) {
    return false;
  }
  return tokenOverlap(elementTokens(a.element), elementTokens(b.element)) >= 0.5;
}
