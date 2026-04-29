import { readFile } from "node:fs/promises";
import { z } from "zod";
import { resolveAuth } from "../auth/index.js";
import { ensureFigmaToken } from "../config.js";
import { resolveComponent } from "../resolve/component.js";
import {
  defaultReportsDir,
  loadReport,
  runComparison,
} from "../compare/pipeline.js";
import { loadSettings } from "../settings.js";

export const compareInputSchema = z.object({
  figma: z.string().url().describe("Figma frame/component URL"),
  target: z
    .string()
    .url()
    .optional()
    .describe(
      "Direct URL of the rendered component. Provide either `target` OR `component`."
    ),
  component: z
    .string()
    .optional()
    .describe(
      'Natural-language description of the component to find in the codebase, e.g. "primary button on the login page".'
    ),
  devServer: z
    .string()
    .url()
    .optional()
    .describe("Dev server base URL (default: http://localhost:3000)"),
  model: z
    .enum(["claude", "openai"])
    .optional()
    .describe("AI provider (default: claude)"),
  viewport: z
    .string()
    .regex(/^\d+x\d+$/)
    .optional()
    .describe("Viewport for the screenshot, format WIDTHxHEIGHT (default: 1280x720)"),
  selector: z
    .string()
    .optional()
    .describe("CSS selector to screenshot a specific element"),
  wait: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Time in ms to wait after page load before screenshotting"),
  authState: z
    .string()
    .optional()
    .describe(
      "Path to a Playwright storageState JSON file (cookies + localStorage). " +
        "Lets kiyas screenshot authenticated views the same way your tests do. " +
        "Generate with `npx playwright codegen --save-storage=auth.json`."
    ),
  threshold: z
    .enum(["all", "medium", "high"])
    .optional()
    .describe("Severity threshold for the rendered HTML report (default: all)"),
  name: z
    .string()
    .optional()
    .describe("Friendly name for the comparison, used in the report header"),
});

export type CompareInput = z.infer<typeof compareInputSchema>;

export const getDiffReportInputSchema = z.object({
  reportId: z.string().describe("Report ID returned from a prior compare call"),
  format: z
    .enum(["html", "json"])
    .optional()
    .describe("Which artifact to return (default: json)"),
  includeContent: z
    .boolean()
    .optional()
    .describe(
      "When true, return the raw file content inline. When false, return only the path. Default: true for json, false for html (HTML is large)."
    ),
});

export type GetDiffReportInput = z.infer<typeof getDiffReportInputSchema>;

export const listIssuesInputSchema = z.object({
  reportId: z.string().describe("Report ID returned from a prior compare call"),
  severity: z
    .enum(["all", "high", "medium", "low"])
    .optional()
    .describe("Filter to a single severity level (default: all)"),
});

export type ListIssuesInput = z.infer<typeof listIssuesInputSchema>;

export async function handleCompare(input: CompareInput) {
  if (!input.target && !input.component) {
    throw new Error(
      "Provide either `target` (a URL) or `component` (a natural-language description)."
    );
  }

  const settings = loadSettings();
  const model = input.model ?? settings.model ?? "claude";
  const devServer =
    input.devServer ??
    settings.devServer ??
    process.env.DEV_SERVER_URL ??
    "http://localhost:3000";
  const viewport = input.viewport ?? settings.viewport ?? "1280x720";
  const threshold = input.threshold ?? settings.threshold ?? "all";

  const figmaToken = await ensureFigmaToken();
  const auth = await resolveAuth(model);

  let targetUrl = input.target;
  let selector = input.selector;
  let componentName = input.component;

  if (input.component && !input.target) {
    const resolved = await resolveComponent(
      input.component,
      devServer,
      auth.provider,
      auth.token,
      process.cwd()
    );
    targetUrl = resolved.url;
    selector = resolved.selector ?? selector;
    componentName = resolved.componentName;
  }

  const result = await runComparison({
    figmaUrl: input.figma,
    targetUrl: targetUrl!,
    model: auth.provider,
    token: auth.token,
    figmaToken,
    viewport,
    selector,
    wait: input.wait,
    authState: input.authState,
    threshold,
    format: "html",
    name: componentName ?? input.name,
  });

  return {
    reportId: result.reportId,
    summary: result.summary,
    reportPath: result.reportPath,
    jsonPath: result.jsonPath,
    designImagePath: result.designImagePath,
    implImagePath: result.implImagePath,
    discrepancies: result.discrepancies,
    model: result.modelLabel,
    figmaUrl: result.figmaUrl,
    targetUrl: result.targetUrl,
    name: result.name,
  };
}

export async function handleGetDiffReport(input: GetDiffReportInput) {
  const report = await loadReport(input.reportId, defaultReportsDir());
  const format = input.format ?? "json";
  const includeContent =
    input.includeContent ?? (format === "json" ? true : false);

  const path = format === "json" ? report.jsonPath : report.reportPath;
  const base = {
    reportId: report.reportId,
    format,
    path,
    summary: report.summary,
  };

  if (!includeContent) {
    return base;
  }

  const content = await readFile(path, "utf-8");
  return { ...base, content };
}

export async function handleListIssues(input: ListIssuesInput) {
  const report = await loadReport(input.reportId, defaultReportsDir());
  const severity = input.severity ?? "all";

  let issues = report.discrepancies;
  if (severity !== "all") {
    const wanted = severity.toUpperCase();
    issues = issues.filter((d) => d.severity === wanted);
  }

  return {
    reportId: report.reportId,
    severity,
    count: issues.length,
    issues,
  };
}
