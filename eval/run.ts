import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { capturePlaywright } from "../packages/core/src/capture/playwright.js";
import { runComparison } from "../packages/core/src/compare/pipeline.js";
import type { Discrepancy } from "../packages/core/src/compare/index.js";
import { loadSettings } from "../packages/core/src/settings.js";
import { aggregate, scorePair, type Golden, type PairScore } from "./score.js";

interface Mutation {
  css?: string;
  remove?: string;
  text?: [string, string];
  golden: Golden;
}

interface FixtureSpec {
  clean?: boolean;
  /** Fixture-sized viewport so the component fills the frame like a real design export. */
  viewport?: string;
  mutations: Record<string, Mutation>;
}

const EVAL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES_DIR = join(EVAL_DIR, "fixtures");

const { values: args } = parseArgs({
  options: {
    pairs: { type: "string" },
    runs: { type: "string", default: "1" },
    provider: { type: "string", default: "claude" },
    viewport: { type: "string", default: "900x700" },
    scale: { type: "string", default: "1" },
  },
});

const runs = parseInt(args.runs!, 10);
const scale = parseFloat(args.scale!);
const provider = args.provider as "claude" | "openai";
const settings = loadSettings();
const aiModel =
  provider === "claude"
    ? settings.claudeModel ?? "sonnet"
    : settings.codexModel;

const specs: Record<string, FixtureSpec> = JSON.parse(
  await readFile(join(EVAL_DIR, "mutations.json"), "utf-8")
);

const selected = args.pairs
  ? Object.fromEntries(
      Object.entries(specs).filter(([name]) =>
        args.pairs!.split(",").includes(name)
      )
    )
  : specs;

if (Object.keys(selected).length === 0) {
  console.error(`No fixtures match --pairs=${args.pairs}`);
  process.exit(1);
}

const resultsDir = join(
  EVAL_DIR,
  "results",
  new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
);
await mkdir(resultsDir, { recursive: true });

// --- static fixture server ---
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url!, "http://localhost").pathname;
  try {
    const data = await readFile(join(FIXTURES_DIR, pathname));
    res.setHeader(
      "content-type",
      pathname.endsWith(".js") ? "text/javascript" : "text/html"
    );
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
});
await new Promise<void>((r) => server.listen(0, r));
const base = `http://localhost:${(server.address() as AddressInfo).port}`;

function mutationUrl(fixture: string, mutation: Mutation): string {
  const params = new URLSearchParams();
  if (mutation.css) params.set("css", mutation.css);
  if (mutation.remove) params.set("remove", mutation.remove);
  if (mutation.text) params.set("text", JSON.stringify(mutation.text));
  return `${base}/${fixture}.html?${params}`;
}

const totalPairs = Object.values(selected).reduce(
  (n, spec) => n + Object.keys(spec.mutations).length + (spec.clean ? 1 : 0),
  0
);
console.log(
  `eval: ${Object.keys(selected).length} fixtures, ${totalPairs} pairs × ${runs} run(s), provider=${provider}${aiModel ? ` (${aiModel})` : ""}\n`
);

const scores: PairScore[] = [];
const allRuns = new Map<string, { golden?: Golden; runs: Discrepancy[][] }>();
let done = 0;

try {
  for (const [fixture, spec] of Object.entries(selected)) {
    const viewport = spec.viewport ?? args.viewport!;
    const baselineTmp = await capturePlaywright({
      url: `${base}/${fixture}.html`,
      viewport,
      scale,
    });
    const baseline = join(resultsDir, `${fixture}-baseline.png`);
    await copyFile(baselineTmp, baseline);

    const pairs: Array<[string, Mutation | undefined]> = [
      ...Object.entries(spec.mutations),
      ...(spec.clean ? [["clean", undefined] as [string, undefined]] : []),
    ];

    for (const [mutationId, mutation] of pairs) {
      const targetUrl = mutation
        ? mutationUrl(fixture, mutation)
        : `${base}/${fixture}.html`;

      const runFindings: Discrepancy[][] = [];
      let pairError: string | undefined;
      for (let i = 0; i < runs; i++) {
        try {
          const result = await runComparison({
            designImage: baseline,
            targetUrl,
            model: provider,
            aiModel,
            viewport,
            scale,
            threshold: "all",
            format: "json",
            name: `${fixture}:${mutationId}`,
            reportsDir: join(resultsDir, "reports"),
          });
          runFindings.push(result.discrepancies);
        } catch (err) {
          pairError = err instanceof Error ? err.message : String(err);
        }
      }

      if (runFindings.length === 0) {
        done++;
        console.log(
          `[${done}/${totalPairs}] ${fixture}:${mutationId} — ERROR: ${pairError?.slice(0, 120)}`
        );
        continue;
      }

      const score = scorePair(fixture, mutationId, mutation?.golden, runFindings);
      scores.push(score);
      allRuns.set(`${fixture}:${mutationId}`, {
        golden: mutation?.golden,
        runs: runFindings,
      });

      done++;
      const status = mutation
        ? score.detectedRuns === runs
          ? "detected"
          : score.detectedRuns > 0
            ? `detected ${score.detectedRuns}/${runs}`
            : "MISSED"
        : score.avgFalsePositives === 0
          ? "clean"
          : `${score.avgFalsePositives} FP`;
      console.log(
        `[${done}/${totalPairs}] ${fixture}:${mutationId} — ${status}` +
          (score.avgFalsePositives > 0 && mutation
            ? ` (+${score.avgFalsePositives} FP)`
            : "")
      );
    }
  }
} finally {
  server.close();
}

const summary = aggregate(scores, allRuns);

console.log("\n=== eval summary ===");
console.log(`mutation pairs   ${summary.mutationPairs}`);
console.log(`clean pairs      ${summary.cleanPairs}`);
console.log(`recall           ${pct(summary.recall)}`);
console.log(`precision        ${pct(summary.precision)}`);
console.log(`severity exact   ${pct(summary.severityExactRate)}`);
console.log(`severity ±1      ${pct(summary.severityOffByOneRate)}`);
console.log(`FP / clean pair  ${summary.fpPerCleanPair.toFixed(2)}`);
console.log(`FP / mut pair    ${summary.fpPerMutationPair.toFixed(2)}`);
console.log(`stability        ${pct(summary.meanStability)}${runs === 1 ? " (single run — rerun with --runs 3 to measure)" : ""}`);

const resultPath = join(resultsDir, "summary.json");
await writeFile(
  resultPath,
  JSON.stringify(
    {
      date: new Date().toISOString(),
      provider,
      aiModel,
      runsPerPair: runs,
      scale,
      viewport: args.viewport,
      summary,
      pairs: scores,
    },
    null,
    2
  )
);
console.log(`\nresults written to ${resultPath}`);

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
