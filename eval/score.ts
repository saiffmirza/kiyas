import type { Discrepancy } from "../src/compare/index.js";
import {
  sameFinding,
  normalizeProperty,
  elementTokens,
} from "../src/compare/finding-key.js";

export interface Golden {
  element: string;
  property: string;
  expected: string;
  actual: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

export interface PairScore {
  fixture: string;
  mutation: string;
  kind: "mutation" | "clean";
  runs: number;
  /** Runs in which the golden finding was detected (mutation pairs only). */
  detectedRuns: number;
  /** Mean findings per run that did not match the golden (all are FPs on clean pairs). */
  avgFalsePositives: number;
  /** Severity agreement on the first matched finding, exact / within one level. */
  severityExact?: boolean;
  severityOffByOne?: boolean;
  /** Cross-run agreement: mean fraction of runs each finding-cluster appears in. 1 for single runs. */
  stability: number;
}

const SEVERITY_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;

export function scorePair(
  fixture: string,
  mutation: string,
  golden: Golden | undefined,
  runs: Discrepancy[][]
): PairScore {
  let detectedRuns = 0;
  let falsePositives = 0;
  let severityExact: boolean | undefined;
  let severityOffByOne: boolean | undefined;

  for (const findings of runs) {
    const matched = golden
      ? findings.filter((f) => sameFinding(f, golden))
      : [];
    if (golden && matched.length > 0) {
      detectedRuns++;
      if (severityExact === undefined) {
        const diff = Math.abs(
          SEVERITY_RANK[matched[0].severity] - SEVERITY_RANK[golden.severity]
        );
        severityExact = diff === 0;
        severityOffByOne = diff <= 1;
      }
    }
    falsePositives += findings.length - matched.length;
  }

  return {
    fixture,
    mutation,
    kind: golden ? "mutation" : "clean",
    runs: runs.length,
    detectedRuns,
    avgFalsePositives: falsePositives / runs.length,
    severityExact,
    severityOffByOne,
    stability: stability(runs),
  };
}

/**
 * Clusters findings across runs (same fuzzy identity) and returns the mean
 * fraction of runs each cluster appears in — 1.0 means every run reported
 * exactly the same findings.
 */
function stability(runs: Discrepancy[][]): number {
  if (runs.length < 2) return 1;

  interface Cluster {
    representative: Discrepancy;
    runsSeen: Set<number>;
  }
  const clusters: Cluster[] = [];
  runs.forEach((findings, i) => {
    for (const f of findings) {
      const cluster = clusters.find((c) => sameFinding(c.representative, f));
      if (cluster) cluster.runsSeen.add(i);
      else clusters.push({ representative: f, runsSeen: new Set([i]) });
    }
  });

  if (clusters.length === 0) return 1;
  const total = clusters.reduce((sum, c) => sum + c.runsSeen.size, 0);
  return total / (clusters.length * runs.length);
}

export interface Aggregate {
  mutationPairs: number;
  cleanPairs: number;
  recall: number;
  precision: number;
  severityExactRate: number;
  severityOffByOneRate: number;
  fpPerCleanPair: number;
  fpPerMutationPair: number;
  meanStability: number;
}

export function aggregate(
  scores: PairScore[],
  allRuns: Map<string, { golden?: Golden; runs: Discrepancy[][] }>
): Aggregate {
  const mutations = scores.filter((s) => s.kind === "mutation");
  const cleans = scores.filter((s) => s.kind === "clean");

  let truePredictions = 0;
  let totalPredictions = 0;
  for (const { golden, runs } of allRuns.values()) {
    for (const findings of runs) {
      totalPredictions += findings.length;
      if (golden) {
        truePredictions += findings.filter((f) => sameFinding(f, golden)).length;
      }
    }
  }

  const detected = mutations.filter((s) => s.detectedRuns > 0);

  return {
    mutationPairs: mutations.length,
    cleanPairs: cleans.length,
    recall: mean(mutations.map((s) => s.detectedRuns / s.runs)),
    precision: totalPredictions === 0 ? 1 : truePredictions / totalPredictions,
    severityExactRate: mean(detected.map((s) => (s.severityExact ? 1 : 0))),
    severityOffByOneRate: mean(detected.map((s) => (s.severityOffByOne ? 1 : 0))),
    fpPerCleanPair: mean(cleans.map((s) => s.avgFalsePositives)),
    fpPerMutationPair: mean(mutations.map((s) => s.avgFalsePositives)),
    meanStability: mean(scores.map((s) => s.stability)),
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function findingKey(d: Discrepancy): string {
  return `${normalizeProperty(d.property)}|${[...elementTokens(d.element)].sort().join(".")}`;
}
