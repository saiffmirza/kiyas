/**
 * Extracts the first parseable JSON array or object from model output,
 * tolerating prose and markdown fences around it. Candidates are found
 * by string-aware bracket balancing; non-JSON bracket spans in prose
 * (e.g. "[see above]") are skipped in favor of the next candidate.
 */
export function extractJson(raw: string, kind: "array" | "object"): unknown {
  const text = raw.replace(/```(?:json)?/gi, "").trim();
  const open = kind === "array" ? "[" : "{";

  let start = text.indexOf(open);
  if (start === -1) {
    throw new Error(
      `No JSON ${kind} found in AI response:\n${raw.slice(0, 500)}`
    );
  }

  while (start !== -1) {
    const end = findBalancedEnd(text, start);
    if (end !== -1) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // Balanced but not JSON (prose brackets) — try the next candidate
      }
    }
    start = text.indexOf(open, start + 1);
  }

  throw new Error(
    `No parseable JSON ${kind} in AI response:\n${raw.slice(0, 500)}`
  );
}

function findBalancedEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "[" || ch === "{") {
      depth++;
    } else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}
