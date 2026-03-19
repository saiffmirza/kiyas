import type { Discrepancy } from "../compare/index.js";

export interface ReportOptions {
  name?: string;
  figmaUrl: string;
  targetUrl: string;
  model: string;
  discrepancies: Discrepancy[];
  threshold: "all" | "medium" | "high";
}

export function generateMarkdownReport(options: ReportOptions): string {
  const { name, figmaUrl, targetUrl, model, threshold } = options;
  let discrepancies = options.discrepancies;

  // Apply severity threshold filter
  if (threshold === "high") {
    discrepancies = discrepancies.filter((d) => d.severity === "HIGH");
  } else if (threshold === "medium") {
    discrepancies = discrepancies.filter(
      (d) => d.severity === "HIGH" || d.severity === "MEDIUM"
    );
  }

  const title = name ?? "Comparison";
  const date = new Date().toISOString().split("T")[0];

  const high = discrepancies.filter((d) => d.severity === "HIGH");
  const medium = discrepancies.filter((d) => d.severity === "MEDIUM");
  const low = discrepancies.filter((d) => d.severity === "LOW");

  let report = `# kiyas Report: ${title}\n\n`;
  report += `**Date:** ${date}\n`;
  report += `**Figma:** ${figmaUrl}\n`;
  report += `**Target:** ${targetUrl}\n`;
  report += `**Model:** ${model}\n\n`;

  if (discrepancies.length === 0) {
    report += `## Result\n\n`;
    report += `**Perfect match!** No discrepancies found between the design and implementation.\n`;
    return report;
  }

  report += `## Summary\n\n`;
  report += `Found **${discrepancies.length} discrepancies**`;
  const parts: string[] = [];
  if (high.length) parts.push(`${high.length} high`);
  if (medium.length) parts.push(`${medium.length} medium`);
  if (low.length) parts.push(`${low.length} low`);
  report += ` (${parts.join(", ")})\n\n`;

  report += `## Discrepancies\n\n`;

  if (high.length) {
    report += formatSeveritySection("HIGH", high);
  }
  if (medium.length) {
    report += formatSeveritySection("MEDIUM", medium);
  }
  if (low.length) {
    report += formatSeveritySection("LOW", low);
  }

  return report;
}

function formatSeveritySection(
  severity: string,
  items: Discrepancy[]
): string {
  const icons: Record<string, string> = {
    HIGH: "🔴",
    MEDIUM: "🟡",
    LOW: "🟢",
  };

  let section = `### ${icons[severity] ?? ""} ${severity}\n\n`;
  section += `| Element | Property | Expected (Design) | Actual (Implementation) |\n`;
  section += `|---------|----------|--------------------|------------------------|\n`;

  for (const d of items) {
    section += `| ${escape(d.element)} | ${escape(d.property)} | ${escape(d.expected)} | ${escape(d.actual)} |\n`;
  }

  section += "\n";
  return section;
}

function escape(str: string): string {
  return str.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
