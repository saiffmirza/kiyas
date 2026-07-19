import "dotenv/config";
import { Command } from "commander";
import chalk from "chalk";
import ora, { type Ora } from "ora";
import { resolve } from "node:path";
import { resolveAuth } from "./auth/index.js";
import { ensureFigmaToken, loadConfigFile } from "./config.js";
import { resolveComponent } from "./resolve/component.js";
import { runComparison, type ProgressEvent } from "./compare/pipeline.js";
import { loadSettings, saveSetting, getAllSettings } from "./settings.js";
import { log } from "./utils/logger.js";
import { detectDevServer } from "./utils/dev-server.js";
import { runSetup } from "./setup.js";
import { VERSION } from "./version.js";

const settings = loadSettings();
const program = new Command();

program
  .name("kiyas")
  .description(
    "AI-powered design fidelity CLI — compare Figma designs against rendered UI"
  )
  .version(VERSION);

// --- subcommands ---
program
  .command("set <key> <value>")
  .description("Set a default (e.g. kiyas set model openai)")
  .action((key: string, value: string) => {
    try {
      saveSetting(key, value);
      log.success(`${key} = ${value}`);
    } catch (err: unknown) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command("get <key>")
  .description("Get a setting value")
  .action((key: string) => {
    const all = getAllSettings() as Record<string, string | undefined>;
    const value = all[key];
    if (value !== undefined) {
      console.log(value);
    } else {
      log.dim(`${key} is not set`);
    }
  });

program
  .command("settings")
  .description("Show all settings")
  .action(() => {
    const all = getAllSettings();
    const entries = Object.entries(all);
    if (entries.length === 0) {
      log.dim("No settings configured. Defaults will be used.");
      return;
    }
    for (const [key, value] of entries) {
      console.log(`${chalk.bold(key)} = ${value}`);
    }
  });

program
  .command("setup")
  .description("Interactive first-time setup (Figma token + AI provider)")
  .action(async () => {
    try {
      await runSetup();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(message);
      process.exit(1);
    }
  });

program
  .command("mcp")
  .description("Start the kiyas MCP server (stdio transport)")
  .action(async () => {
    try {
      const { startMcpServer } = await import("./mcp/server.js");
      await startMcpServer();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // MCP runs on stdio; route diagnostics to stderr only
      console.error(message);
      process.exit(1);
    }
  });

// --- main compare command (default) ---
program
  .option("--figma <url>", "Figma frame/component URL")
  .option(
    "--design <path>",
    "Local path or URL of a design image (e.g. a screenshot) to compare against instead of a Figma URL"
  )
  .option(
    "--component <description>",
    'Component to find, e.g. "eventHeader on the redemption screen"'
  )
  .option(
    "--target <url>",
    "Direct URL of the rendered component (skips AI component lookup)"
  )
  .option(
    "--dev-server <url>",
    "Dev server base URL (default: auto-detect common ports, else http://localhost:3000)",
    settings.devServer ?? process.env.DEV_SERVER_URL
  )
  .option(
    "--model <provider>",
    "AI provider: claude or openai",
    settings.model ?? "claude"
  )
  .option("--output <path>", "Path to save the report (default: kiyas-report-<timestamp>.html)")
  .option("--viewport <size>", "Viewport size for screenshot", settings.viewport ?? "1280x720")
  .option(
    "--scale <n>",
    "Render scale for both the Figma export and the screenshot (default: adaptive — 2 for component-sized captures, 1 for large ones)",
    parseFloat
  )
  .option(
    "--no-full-page",
    "Capture only the viewport instead of the full scrollable page"
  )
  .option(
    "--runs <n>",
    "Run the comparison N times and keep majority-vote findings (higher consistency, N× cost)",
    (v: string) => parseInt(v, 10),
    1
  )
  .option("--selector <css>", "CSS selector to screenshot a specific element")
  .option("--wait <ms>", "Time in ms to wait before screenshot", parseInt)
  .option(
    "--auth-state <path>",
    "Path to a Playwright storageState JSON file for authenticated screenshots"
  )
  .option("--config <path>", "Path to a JSON config file for batch comparisons")
  .option("--threshold <level>", "Severity threshold: all, medium, high", settings.threshold ?? "all")
  .option("--format <type>", "Output format: html (default) or json", settings.format ?? "html")
  .action(async (opts) => {
    try {
      await run(opts);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(message);
      process.exit(1);
    }
  });

program.parse();

interface CLIOptions {
  figma?: string;
  design?: string;
  component?: string;
  target?: string;
  devServer?: string;
  model: "claude" | "openai";
  output?: string;
  viewport: string;
  scale?: number;
  fullPage: boolean;
  runs: number;
  selector?: string;
  wait?: number;
  authState?: string;
  config?: string;
  format: "html" | "json";
  threshold: "all" | "medium" | "high";
}

async function run(opts: CLIOptions) {
  console.log(
    chalk.bold("\n  kiyas ") +
      chalk.dim("(كياس)") +
      chalk.bold(" — design fidelity check\n")
  );

  // Batch mode via config file
  if (opts.config) {
    await runBatchMode(opts);
    return;
  }

  // Validate: need a design source (--figma or --design) + either --component or --target
  if (!opts.figma && !opts.design) {
    throw new Error(
      "Missing design source. Provide --figma <url> or --design <image-path>.\n" +
        'Usage: kiyas --figma <figma-url> --component "button on the login page"\n' +
        '       kiyas --design ./design.png --component "button on the login page"'
    );
  }
  if (opts.figma && opts.design) {
    throw new Error("Provide either --figma or --design, not both.");
  }

  if (!opts.component && !opts.target) {
    throw new Error(
      "Provide either --component or --target.\n\n" +
        "  --component  Describe the component by name and kiyas will find it:\n" +
        '               kiyas --figma <url> --component "eventHeader on redemption screen"\n\n' +
        "  --target     Provide a direct URL to screenshot:\n" +
        "               kiyas --figma <url> --target http://localhost:3000/redemption"
    );
  }

  const figmaToken = opts.figma ? await ensureFigmaToken() : undefined;

  const auth = await resolveAuth(opts.model);
  const aiModel = pinnedModel(auth.provider);

  // If --component is provided, use AI to resolve it to a URL + selector
  let targetUrl = opts.target;
  let selector = opts.selector;
  let componentName = opts.component;
  let resolvedInfo:
    | { filePath: string; url: string; selector?: string }
    | undefined;

  if (opts.component && !opts.target) {
    const resolveSpinner = ora(
      `Finding "${opts.component}" in codebase...`
    ).start();

    const resolved = await resolveComponent(
      opts.component,
      opts.devServer ?? (await detectDevServer()),
      auth.provider,
      process.cwd(),
      aiModel
    );

    resolveSpinner.succeed(
      `Found ${chalk.bold(resolved.componentName)} at ${chalk.dim(resolved.filePath)}`
    );
    log.dim(`  URL: ${resolved.url}`);
    if (resolved.selector) {
      log.dim(`  Selector: ${resolved.selector}`);
    }

    targetUrl = resolved.url;
    selector = resolved.selector ?? selector;
    componentName = resolved.componentName;
    resolvedInfo = {
      filePath: resolved.filePath,
      url: resolved.url,
      selector: resolved.selector,
    };
  }

  await runSingleComparison({
    figmaUrl: opts.figma,
    designImage: opts.design,
    aiModel,
    runs: opts.runs,
    resolved: resolvedInfo,
    targetUrl: targetUrl!,
    model: auth.provider,
    figmaToken,
    viewport: opts.viewport,
    scale: opts.scale,
    fullPage: opts.fullPage,
    selector,
    wait: opts.wait,
    authState: opts.authState,
    threshold: opts.threshold,
    format: opts.format,
    output: opts.output,
    name: componentName,
  });
}

async function runBatchMode(opts: CLIOptions) {
  const config = await loadConfigFile(opts.config!);
  const model = (config.model ?? opts.model) as "claude" | "openai";
  const needsFigma = config.comparisons.some((c) => c.figma);
  const figmaToken = needsFigma
    ? config.figmaAccessToken ?? (await ensureFigmaToken())
    : undefined;

  const auth = await resolveAuth(model);
  const aiModel = pinnedModel(auth.provider);

  for (const comparison of config.comparisons) {
    console.log(
      chalk.bold(`\n--- ${comparison.name ?? comparison.figma ?? comparison.design} ---\n`)
    );

    let targetUrl = comparison.target;
    let selector = comparison.selector;
    let resolvedInfo:
      | { filePath: string; url: string; selector?: string }
      | undefined;

    // If target looks like a component description (not a URL), resolve it
    if (targetUrl && !targetUrl.startsWith("http")) {
      const resolveSpinner = ora(
        `Finding "${targetUrl}" in codebase...`
      ).start();

      const resolved = await resolveComponent(
        targetUrl,
        opts.devServer ?? (await detectDevServer()),
        auth.provider,
        process.cwd(),
        aiModel
      );

      resolveSpinner.succeed(
        `Found ${chalk.bold(resolved.componentName)} at ${chalk.dim(resolved.filePath)}`
      );
      targetUrl = resolved.url;
      selector = resolved.selector ?? selector;
      resolvedInfo = {
        filePath: resolved.filePath,
        url: resolved.url,
        selector: resolved.selector,
      };
    }

    await runSingleComparison({
      figmaUrl: comparison.figma,
      designImage: comparison.design,
      aiModel,
      runs: opts.runs,
      resolved: resolvedInfo,
      targetUrl,
      model: auth.provider,
      figmaToken,
      viewport: comparison.viewport ?? config.viewport ?? opts.viewport,
      scale: opts.scale,
      fullPage: opts.fullPage,
      selector,
      wait: comparison.wait ?? opts.wait,
      authState: comparison.authState ?? config.authState ?? opts.authState,
      threshold: comparison.threshold ?? opts.threshold,
      format: opts.format,
      output: opts.output,
      name: comparison.name,
    });
  }
}

function pinnedModel(provider: "claude" | "openai"): string | undefined {
  return provider === "claude"
    ? settings.claudeModel ?? "sonnet"
    : settings.codexModel;
}

interface ComparisonParams {
  figmaUrl?: string;
  designImage?: string;
  targetUrl: string;
  model: "claude" | "openai";
  aiModel?: string;
  runs?: number;
  resolved?: { filePath: string; url: string; selector?: string };
  figmaToken?: string;
  viewport: string;
  scale?: number;
  fullPage?: boolean;
  selector?: string;
  wait?: number;
  authState?: string;
  threshold: "all" | "medium" | "high";
  format: "html" | "json";
  output?: string;
  name?: string;
}

async function runSingleComparison(params: ComparisonParams) {
  let activeSpinner: Ora | undefined;
  const onProgress = (event: ProgressEvent) => {
    if (event.status === "start") {
      activeSpinner = ora(progressLabel(event)).start();
      return;
    }
    if (event.status === "done") {
      activeSpinner?.succeed(progressLabel(event));
      activeSpinner = undefined;
      return;
    }
    activeSpinner?.fail(progressLabel(event));
    activeSpinner = undefined;
  };

  const result = await runComparison({ ...params, onProgress });

  // Print summary to terminal
  const { summary } = result;
  console.log("");
  log.success(
    `Found ${chalk.bold(String(summary.total))} discrepancies` +
      (summary.total > 0
        ? ` (${[
            summary.high ? `${summary.high} high` : "",
            summary.medium ? `${summary.medium} medium` : "",
            summary.low ? `${summary.low} low` : "",
          ]
            .filter(Boolean)
            .join(", ")})`
        : "")
  );
  if (params.threshold !== "all" && summary.aboveThreshold < summary.total) {
    log.dim(
      `  ${summary.aboveThreshold} at or above the "${params.threshold}" threshold shown in the report`
    );
  }

  const finalPath = params.output ? resolve(params.output) : result.reportPath;
  console.log("");
  log.success(`Report saved to ${chalk.bold(finalPath)}`);
  console.log(chalk.dim(`  file://${finalPath}`));
  console.log("");
}

function progressLabel(event: ProgressEvent): string {
  switch (event.step) {
    case "figma":
      return event.status === "start"
        ? "Exporting Figma design..."
        : "Figma design exported";
    case "screenshot":
      return event.status === "start"
        ? `Screenshotting ${event.message}...`
        : "Implementation screenshot captured";
    case "compare":
      return event.status === "start"
        ? `Analyzing with ${event.message}...`
        : event.status === "done"
          ? `Analysis complete (${event.message ?? ""})`.trim()
          : "AI analysis failed";
    case "report":
      return event.status === "start"
        ? "Generating report..."
        : "Report generated";
  }
}
