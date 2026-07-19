import type { Discrepancy } from "./index.js";
import { sameFinding } from "./finding-key.js";

interface Cluster {
  representative: Discrepancy;
  runIndices: Set<number>;
  severities: Discrepancy["severity"][];
}

/**
 * Merges findings from N independent comparison runs. A finding survives
 * when a majority of runs reported it (same property family + element),
 * which trades a little recall for a large precision/stability gain.
 * Each surviving finding carries confidence = runs that saw it / N.
 */
export function voteOnFindings(runs: Discrepancy[][]): Discrepancy[] {
  const clusters: Cluster[] = [];

  runs.forEach((findings, runIndex) => {
    for (const finding of findings) {
      const cluster = clusters.find((c) =>
        sameFinding(c.representative, finding)
      );
      if (cluster) {
        cluster.runIndices.add(runIndex);
        cluster.severities.push(finding.severity);
      } else {
        clusters.push({
          representative: finding,
          runIndices: new Set([runIndex]),
          severities: [finding.severity],
        });
      }
    }
  });

  const majority = Math.ceil(runs.length / 2);

  return clusters
    .filter((c) => c.runIndices.size >= majority)
    .map((c) => ({
      ...c.representative,
      severity: modalSeverity(c.severities),
      confidence: c.runIndices.size / runs.length,
    }));
}

function modalSeverity(
  severities: Discrepancy["severity"][]
): Discrepancy["severity"] {
  const counts = new Map<Discrepancy["severity"], number>();
  for (const s of severities) {
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let best = severities[0];
  let bestCount = 0;
  for (const [s, count] of counts) {
    if (count > bestCount) {
      best = s;
      bestCount = count;
    }
  }
  return best;
}
