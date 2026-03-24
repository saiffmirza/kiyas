import "dotenv/config";
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { writeFile, copyFile, unlink } from "node:fs/promises";
import { dirname, join, basename, resolve } from "node:path";
import { resolveAuth } from "./auth/index.js";
import { resolveFigmaToken, loadConfigFile } from "./config.js";
import { captureFigma } from "./capture/figma.js";
import { capturePlaywright } from "./capture/playwright.js";
import { compareImages, type Discrepancy } from "./compare/index.js";
import { resolveComponent } from "./resolve/component.js";
import { generateHtmlReport } from "./report/html.js";
import { loadSettings, saveSetting, getAllSettings } from "./settings.js";
import { log } from "./utils/logger.js";

const settings = loadSettings();
const program = new Command();

program
  .name("kiyas")
  .description(
    "AI-powered design fidelity CLI — compare Figma designs against rendered UI"
  )
  .version("1.0.0");

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

// --- main compare command (default) ---
program
  .option("--figma <url>", "Figma frame/component URL")
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
    "Dev server base URL",
    settings.devServer ?? process.env.DEV_SERVER_URL ?? "http://localhost:3000"
  )
  .option(
    "--model <provider>",
    "AI provider: claude or openai",
    settings.model ?? "claude"
  )
  .option("--output <path>", "Path to save the report (default: kiyas-report-<timestamp>.html)")
  .option("--viewport <size>", "Viewport size for screenshot", settings.viewport ?? "1280x720")
  .option("--selector <css>", "CSS selector to screenshot a specific element")
  .option("--wait <ms>", "Time in ms to wait before screenshot", parseInt)
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
  component?: string;
  target?: string;
  devServer: string;
  model: "claude" | "openai";
  output?: string;
  viewport: string;
  selector?: string;
  wait?: number;
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

  // Validate: need --figma + either --component or --target
  if (!opts.figma) {
    throw new Error(
      "Missing --figma flag.\n" +
        'Usage: kiyas --figma <figma-url> --component "button on the login page"'
    );
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

  const figmaToken = resolveFigmaToken();
  if (!figmaToken) {
    throw new Error(
      "Figma access token not found. Set FIGMA_ACCESS_TOKEN in your .env file."
    );
  }

  const auth = await resolveAuth(opts.model);

  // If --component is provided, use AI to resolve it to a URL + selector
  let targetUrl = opts.target;
  let selector = opts.selector;
  let componentName = opts.component;

  if (opts.component && !opts.target) {
    const resolveSpinner = ora(
      `Finding "${opts.component}" in codebase...`
    ).start();

    const resolved = await resolveComponent(
      opts.component,
      opts.devServer,
      auth.provider,
      auth.token,
      process.cwd()
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
  }

  await runSingleComparison({
    figmaUrl: opts.figma,
    targetUrl: targetUrl!,
    model: auth.provider,
    token: auth.token,
    figmaToken,
    viewport: opts.viewport,
    selector,
    wait: opts.wait,
    threshold: opts.threshold,
    format: opts.format,
    output: opts.output,
    name: componentName,
  });
}

async function runBatchMode(opts: CLIOptions) {
  const config = await loadConfigFile(opts.config!);
  const model = (config.model ?? opts.model) as "claude" | "openai";
  const figmaToken = config.figmaAccessToken ?? resolveFigmaToken();
  if (!figmaToken) {
    throw new Error(
      "Figma access token not found. Set FIGMA_ACCESS_TOKEN in your .env file."
    );
  }

  const auth = await resolveAuth(model);

  for (const comparison of config.comparisons) {
    console.log(
      chalk.bold(`\n--- ${comparison.name ?? comparison.figma} ---\n`)
    );

    let targetUrl = comparison.target;
    let selector = comparison.selector;

    // If target looks like a component description (not a URL), resolve it
    if (targetUrl && !targetUrl.startsWith("http")) {
      const resolveSpinner = ora(
        `Finding "${targetUrl}" in codebase...`
      ).start();

      const resolved = await resolveComponent(
        targetUrl,
        opts.devServer,
        auth.provider,
        auth.token,
        process.cwd()
      );

      resolveSpinner.succeed(
        `Found ${chalk.bold(resolved.componentName)} at ${chalk.dim(resolved.filePath)}`
      );
      targetUrl = resolved.url;
      selector = resolved.selector ?? selector;
    }

    await runSingleComparison({
      figmaUrl: comparison.figma,
      targetUrl,
      model: auth.provider,
      token: auth.token,
      figmaToken,
      viewport: comparison.viewport ?? config.viewport ?? opts.viewport,
      selector,
      wait: comparison.wait ?? opts.wait,
      threshold: comparison.threshold ?? opts.threshold,
      format: opts.format,
      output: opts.output,
      name: comparison.name,
    });
  }
}

interface ComparisonParams {
  figmaUrl: string;
  targetUrl: string;
  model: "claude" | "openai";
  token: string;
  figmaToken: string;
  viewport: string;
  selector?: string;
  wait?: number;
  threshold: "all" | "medium" | "high";
  format: "html" | "json";
  output?: string;
  name?: string;
}

async function runSingleComparison(params: ComparisonParams) {
  const tempFiles: string[] = [];

  try {
    // Step 1: Capture Figma design
    const figmaSpinner = ora("Exporting Figma design...").start();
    const figmaCapture = await captureFigma(
      params.figmaUrl,
      params.figmaToken
    );
    tempFiles.push(figmaCapture.imagePath);
    figmaSpinner.succeed("Figma design exported");

    // Step 2: Capture implementation screenshot
    const implSpinner = ora(
      `Screenshotting ${params.targetUrl}...`
    ).start();
    const implPath = await capturePlaywright({
      url: params.targetUrl,
      viewport: params.viewport,
      selector: params.selector,
      wait: params.wait,
    });
    tempFiles.push(implPath);
    implSpinner.succeed("Implementation screenshot captured");

    // Step 3: AI comparison
    const modelLabel =
      params.model === "claude" ? "Claude Sonnet 4.6" : "GPT-4o";
    const compareSpinner = ora(`Analyzing with ${modelLabel}...`).start();

    let discrepancies: Discrepancy[];
    try {
      discrepancies = await compareImages({
        designPath: figmaCapture.imagePath,
        implPath,
        provider: params.model,
        token: params.token,
        metadata: figmaCapture.metadata,
      });
      compareSpinner.succeed(`Analysis complete (${modelLabel})`);
    } catch (err) {
      compareSpinner.fail("AI analysis failed");
      throw err;
    }

    // Step 4: Determine output path
    const ext = params.format === "json" ? "json" : "html";
    const timestamp = Date.now();
    const outputPath = params.output ?? `kiyas-report-${timestamp}.${ext}`;
    const outputDir = dirname(resolve(outputPath));

    // Save images alongside report
    const designFilename = `kiyas-design-${timestamp}.png`;
    const implFilename = `kiyas-impl-${timestamp}.png`;
    const designDest = join(outputDir, designFilename);
    const implDest = join(outputDir, implFilename);

    await copyFile(figmaCapture.imagePath, designDest);
    await copyFile(implPath, implDest);

    // Step 5: Generate report
    const reportOpts = {
      name: params.name,
      figmaUrl: params.figmaUrl,
      targetUrl: params.targetUrl,
      model: modelLabel,
      discrepancies,
      threshold: params.threshold,
      designImagePath: designFilename,
      implImagePath: implFilename,
    };

    let report: string;
    if (params.format === "json") {
      report = JSON.stringify(
        { ...reportOpts, date: new Date().toISOString().split("T")[0] },
        null,
        2
      );
    } else {
      report = await generateHtmlReport({
        ...reportOpts,
        designImagePath: designDest,
        implImagePath: implDest,
      });
    }

    // Print summary to terminal
    const high = discrepancies.filter((d) => d.severity === "HIGH");
    const medium = discrepancies.filter((d) => d.severity === "MEDIUM");
    const low = discrepancies.filter((d) => d.severity === "LOW");

    console.log("");
    log.success(
      `Found ${chalk.bold(String(discrepancies.length))} discrepancies` +
        (discrepancies.length > 0
          ? ` (${[
              high.length ? `${high.length} high` : "",
              medium.length ? `${medium.length} medium` : "",
              low.length ? `${low.length} low` : "",
            ]
              .filter(Boolean)
              .join(", ")})`
          : "")
    );

    // Always save to file
    await writeFile(outputPath, report, "utf-8");

    const absolutePath = resolve(outputPath);
    console.log("");
    log.success(`Report saved to ${chalk.bold(outputPath)}`);
    console.log(chalk.dim(`  file://${absolutePath}`));
    console.log("");
  } finally {
    for (const f of tempFiles) {
      try {
        await unlink(f);
      } catch {
        // ignore
      }
    }
  }
}
