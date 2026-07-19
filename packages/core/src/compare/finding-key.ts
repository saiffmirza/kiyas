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
  "border-color": "border",
  "border-width": "border",
  "border-style": "border",
  outline: "border",
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

/**
 * Models often report compound properties ("border-color / border-width",
 * "height / padding"). Split on separators and normalize each part so a
 * finding matches if ANY of its property facets matches.
 */
export function propertyFamilies(property: string): Set<string> {
  return new Set(
    property
      .split(/\s*(?:\/|,|&|\band\b)\s*/i)
      .filter(Boolean)
      .map(normalizeProperty)
  );
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
      .map(singularize)
  );
}

function singularize(token: string): string {
  return token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // Prefix match covers abbreviations: nav/navigation, btn is too short to lie
  return a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a));
}

export function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const t of smaller) {
    for (const other of larger) {
      if (tokensMatch(t, other)) {
        shared++;
        break;
      }
    }
  }
  return shared / smaller.size;
}

/**
 * Whether two findings describe the same underlying discrepancy:
 * intersecting property families and overlapping element description.
 */
export function sameFinding(
  a: Pick<Discrepancy, "element" | "property">,
  b: Pick<Discrepancy, "element" | "property">
): boolean {
  const familiesA = propertyFamilies(a.property);
  const familiesB = propertyFamilies(b.property);
  let propertyMatch = false;
  for (const f of familiesA) {
    if (familiesB.has(f)) {
      propertyMatch = true;
      break;
    }
  }
  if (!propertyMatch) return false;

  return tokenOverlap(elementTokens(a.element), elementTokens(b.element)) >= 0.5;
}
