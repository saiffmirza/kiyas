import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Discrepancy } from "../compare/index.js";

// Logo embedded as base64 (resized to 300px wide)
let _logoCache: string | undefined;
async function getLogoBase64(): Promise<string> {
  if (_logoCache) return _logoCache;
  try {
    // Try to load from assets directory relative to the package
    const paths = [
      resolve(dirname(fileURLToPath(import.meta.url)), "..", "assets", "logo-small.png"),
      resolve(dirname(fileURLToPath(import.meta.url)), "assets", "logo-small.png"),
      resolve(process.cwd(), "assets", "logo-small.png"),
    ];
    for (const p of paths) {
      try {
        const buf = await readFile(p);
        _logoCache = `data:image/png;base64,${buf.toString("base64")}`;
        return _logoCache;
      } catch { /* try next */ }
    }
  } catch { /* fallback */ }
  _logoCache = "";
  return _logoCache;
}

export interface HtmlReportOptions {
  name?: string;
  figmaUrl: string;
  targetUrl: string;
  model: string;
  discrepancies: Discrepancy[];
  threshold: "all" | "medium" | "high";
  designImagePath?: string;
  implImagePath?: string;
}

export async function generateHtmlReport(
  options: HtmlReportOptions
): Promise<string> {
  const { name, figmaUrl, targetUrl, model, threshold } = options;
  let discrepancies = options.discrepancies;

  if (threshold === "high") {
    discrepancies = discrepancies.filter((d) => d.severity === "HIGH");
  } else if (threshold === "medium") {
    discrepancies = discrepancies.filter(
      (d) => d.severity === "HIGH" || d.severity === "MEDIUM"
    );
  }

  const title = name ?? "Comparison";
  const date = new Date().toISOString().split("T")[0];
  const logoSrc = await getLogoBase64();

  const high = discrepancies.filter((d) => d.severity === "HIGH");
  const medium = discrepancies.filter((d) => d.severity === "MEDIUM");
  const low = discrepancies.filter((d) => d.severity === "LOW");

  // Embed images as base64
  let designBase64 = "";
  let implBase64 = "";
  if (options.designImagePath) {
    const buf = await readFile(options.designImagePath);
    designBase64 = `data:image/png;base64,${buf.toString("base64")}`;
  }
  if (options.implImagePath) {
    const buf = await readFile(options.implImagePath);
    implBase64 = `data:image/png;base64,${buf.toString("base64")}`;
  }

  const summaryParts: string[] = [];
  if (high.length) summaryParts.push(`${high.length} high`);
  if (medium.length) summaryParts.push(`${medium.length} medium`);
  if (low.length) summaryParts.push(`${low.length} low`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>kiyas Report: ${esc(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8f9fa;
      color: #1a1a2e;
      line-height: 1.6;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .header h1 {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
    }

    .header .logo img {
      height: 56px;
      width: auto;
    }

    /* Meta */
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 32px;
      padding: 20px;
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }

    .meta-item {
      font-size: 13px;
    }

    .meta-item .label {
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .meta-item .value {
      color: #334155;
      word-break: break-all;
    }

    .meta-item .value a {
      color: #3b82f6;
      text-decoration: none;
    }

    .meta-item .value a:hover {
      text-decoration: underline;
    }

    /* Visual Comparison */
    .comparison {
      margin-bottom: 32px;
    }

    .comparison h2 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #0f172a;
    }

    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .comparison-card {
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }

    .comparison-card .card-label {
      padding: 12px 16px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      border-bottom: 1px solid #e2e8f0;
    }

    .comparison-card img {
      width: 100%;
      height: auto;
      display: block;
      padding: 16px;
      object-fit: contain;
      background: #fafafa;
    }

    /* Summary */
    .summary {
      display: flex;
      gap: 12px;
      margin-bottom: 32px;
    }

    .summary-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
    }

    .summary-badge .count {
      font-size: 22px;
      font-weight: 700;
    }

    .summary-badge.high { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .summary-badge.medium { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
    .summary-badge.low { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .summary-badge.total { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }

    /* Discrepancies */
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      margin: 24px 0 12px;
      color: #0f172a;
    }

    .severity-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    .severity-dot.high { background: #ef4444; }
    .severity-dot.medium { background: #f59e0b; }
    .severity-dot.low { background: #22c55e; }

    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      margin-bottom: 16px;
      font-size: 13px;
    }

    th {
      background: #f8fafc;
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e2e8f0;
    }

    td {
      padding: 12px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
      vertical-align: top;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: #f8fafc;
    }

    /* Match */
    .match {
      text-align: center;
      padding: 48px 24px;
      background: #f0fdf4;
      border-radius: 12px;
      border: 1px solid #bbf7d0;
    }

    .match h2 {
      font-size: 20px;
      color: #166534;
    }

    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }

    /* Filter */
    .filters {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
    }

    .filter-btn {
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #fff;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: #475569;
      transition: all 0.15s;
    }

    .filter-btn:hover { background: #f1f5f9; }
    .filter-btn.active { background: #0f172a; color: #fff; border-color: #0f172a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${esc(title)}</h1>
      <div class="logo">${logoSrc ? `<img src="${logoSrc}" alt="kiyas">` : "kiyas"}</div>
    </div>

    <div class="meta">
      <div class="meta-item">
        <div class="label">Date</div>
        <div class="value">${date}</div>
      </div>
      <div class="meta-item">
        <div class="label">Figma</div>
        <div class="value"><a href="${esc(figmaUrl)}" target="_blank">${esc(figmaUrl.length > 60 ? figmaUrl.slice(0, 57) + "..." : figmaUrl)}</a></div>
      </div>
      <div class="meta-item">
        <div class="label">Target</div>
        <div class="value"><a href="${esc(targetUrl)}" target="_blank">${esc(targetUrl)}</a></div>
      </div>
      <div class="meta-item">
        <div class="label">Model</div>
        <div class="value">${esc(model)}</div>
      </div>
    </div>

    ${
      designBase64 && implBase64
        ? `<div class="comparison">
      <h2>Visual Comparison</h2>
      <div class="comparison-grid">
        <div class="comparison-card">
          <div class="card-label">Design (Figma)</div>
          <img src="${designBase64}" alt="Figma design">
        </div>
        <div class="comparison-card">
          <div class="card-label">Implementation</div>
          <img src="${implBase64}" alt="Implementation screenshot">
        </div>
      </div>
    </div>`
        : ""
    }

    ${
      discrepancies.length === 0
        ? `<div class="match"><h2>Perfect match! No discrepancies found.</h2></div>`
        : `
    <div class="summary">
      <div class="summary-badge total">
        <span class="count">${discrepancies.length}</span> total
      </div>
      ${high.length ? `<div class="summary-badge high"><span class="count">${high.length}</span> high</div>` : ""}
      ${medium.length ? `<div class="summary-badge medium"><span class="count">${medium.length}</span> medium</div>` : ""}
      ${low.length ? `<div class="summary-badge low"><span class="count">${low.length}</span> low</div>` : ""}
    </div>

    <div class="filters">
      <button class="filter-btn active" onclick="filterRows('all')">All</button>
      <button class="filter-btn" onclick="filterRows('high')">High</button>
      <button class="filter-btn" onclick="filterRows('medium')">Medium</button>
      <button class="filter-btn" onclick="filterRows('low')">Low</button>
    </div>

    ${high.length ? severityTable("high", "High", high) : ""}
    ${medium.length ? severityTable("medium", "Medium", medium) : ""}
    ${low.length ? severityTable("low", "Low", low) : ""}
    `
    }

    <div class="footer">
      Generated by kiyas — AI-powered design fidelity CLI
    </div>
  </div>

  <script>
    function filterRows(level) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');

      document.querySelectorAll('.severity-section').forEach(section => {
        if (level === 'all' || section.dataset.severity === level) {
          section.style.display = '';
        } else {
          section.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;
}

function severityTable(
  level: string,
  label: string,
  items: Discrepancy[]
): string {
  const rows = items
    .map(
      (d) => `
        <tr>
          <td>${esc(d.element)}</td>
          <td>${esc(d.property)}</td>
          <td>${esc(d.expected)}</td>
          <td>${esc(d.actual)}</td>
        </tr>`
    )
    .join("");

  return `
    <div class="severity-section" data-severity="${level}">
      <div class="section-title">
        <span class="severity-dot ${level}"></span>
        ${label}
      </div>
      <table>
        <thead>
          <tr>
            <th>Element</th>
            <th>Property</th>
            <th>Expected (Design)</th>
            <th>Actual (Implementation)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
