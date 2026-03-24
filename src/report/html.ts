import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Discrepancy } from "../compare/index.js";

// Logo embedded as base64
let _logoCache: string | undefined;
async function getLogoBase64(): Promise<string> {
  if (_logoCache) return _logoCache;
  try {
    // Try to load from assets directory relative to the package
    const paths = [
      resolve(dirname(fileURLToPath(import.meta.url)), "..", "assets", "logo.png"),
      resolve(dirname(fileURLToPath(import.meta.url)), "assets", "logo.png"),
      resolve(process.cwd(), "assets", "logo.png"),
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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --cream: #f6f0e6;
      --cream-light: #f5f1ea;
      --cream-dark: #e5ddd0;
      --navy: #1b1b3a;
      --navy-light: #2d2d52;
      --gold: #b8963e;
      --gold-light: #d4b667;
      --gold-muted: rgba(184, 150, 62, 0.15);
      --text: #2c2c3e;
      --text-secondary: #6b6b82;
      --card-bg: rgba(255, 255, 255, 0.65);
      --card-border: rgba(27, 27, 58, 0.08);
      --card-shadow: 0 1px 3px rgba(27, 27, 58, 0.04), 0 4px 12px rgba(27, 27, 58, 0.03);
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--cream);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }

    .page-accent {
      height: 4px;
      background: linear-gradient(90deg, var(--navy) 0%, var(--gold) 50%, var(--navy) 100%);
    }

    .container {
      max-width: 980px;
      margin: 0 auto;
      padding: 48px 32px 64px;
    }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 28px;
      border-bottom: 1px solid var(--cream-dark);
    }

    .header-left h1 {
      font-size: 26px;
      font-weight: 700;
      color: var(--navy);
      letter-spacing: -0.3px;
    }

    .header-left .subtitle {
      font-size: 13px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .header .logo img {
      height: 120px;
      width: auto;
    }

    /* Meta */
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 36px;
      padding: 22px 24px;
      background: var(--card-bg);
      backdrop-filter: blur(8px);
      border-radius: 14px;
      border: 1px solid var(--card-border);
      box-shadow: var(--card-shadow);
    }

    .meta-item {
      font-size: 13px;
    }

    .meta-item .label {
      font-weight: 600;
      color: var(--gold);
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }

    .meta-item .value {
      color: var(--text);
      word-break: break-all;
    }

    .meta-item .value a {
      color: var(--navy);
      text-decoration: none;
      border-bottom: 1px solid var(--cream-dark);
      transition: border-color 0.2s;
    }

    .meta-item .value a:hover {
      border-color: var(--gold);
    }

    /* Visual Comparison */
    .comparison {
      margin-bottom: 36px;
    }

    .comparison h2 {
      font-size: 17px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--navy);
    }

    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .comparison-card {
      background: var(--card-bg);
      backdrop-filter: blur(8px);
      border-radius: 14px;
      border: 1px solid var(--card-border);
      box-shadow: var(--card-shadow);
      overflow: hidden;
      transition: box-shadow 0.2s;
    }

    .comparison-card:hover {
      box-shadow: 0 2px 6px rgba(27, 27, 58, 0.06), 0 8px 24px rgba(27, 27, 58, 0.05);
    }

    .comparison-card .card-label {
      padding: 12px 18px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--gold);
      border-bottom: 1px solid var(--card-border);
      background: rgba(255, 255, 255, 0.4);
    }

    .comparison-card img {
      width: 100%;
      height: auto;
      display: block;
      padding: 16px;
      object-fit: contain;
      background: var(--cream-light);
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
      padding: 12px 18px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      backdrop-filter: blur(8px);
      transition: transform 0.15s;
    }

    .summary-badge:hover {
      transform: translateY(-1px);
    }

    .summary-badge .count {
      font-size: 24px;
      font-weight: 700;
    }

    .summary-badge.high {
      background: rgba(185, 28, 28, 0.08);
      color: #991b1b;
      border: 1px solid rgba(185, 28, 28, 0.15);
    }
    .summary-badge.medium {
      background: rgba(180, 130, 20, 0.08);
      color: #92400e;
      border: 1px solid rgba(180, 130, 20, 0.15);
    }
    .summary-badge.low {
      background: rgba(22, 101, 52, 0.08);
      color: #166534;
      border: 1px solid rgba(22, 101, 52, 0.15);
    }
    .summary-badge.total {
      background: rgba(27, 27, 58, 0.06);
      color: var(--navy);
      border: 1px solid rgba(27, 27, 58, 0.1);
    }

    /* Discrepancies */
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      margin: 28px 0 12px;
      color: var(--navy);
    }

    .severity-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .severity-dot.high { background: #dc2626; }
    .severity-dot.medium { background: #d97706; }
    .severity-dot.low { background: #16a34a; }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: var(--card-bg);
      backdrop-filter: blur(8px);
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--card-border);
      box-shadow: var(--card-shadow);
      margin-bottom: 16px;
      font-size: 13px;
    }

    th {
      background: rgba(27, 27, 58, 0.03);
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      color: var(--text-secondary);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid var(--card-border);
    }

    td {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(27, 27, 58, 0.04);
      color: var(--text);
      vertical-align: top;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: rgba(184, 150, 62, 0.04);
    }

    /* Match */
    .match {
      text-align: center;
      padding: 56px 24px;
      background: rgba(22, 101, 52, 0.06);
      border-radius: 14px;
      border: 1px solid rgba(22, 101, 52, 0.12);
    }

    .match h2 {
      font-size: 20px;
      color: #166534;
      font-weight: 600;
    }

    /* Footer */
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--cream-dark);
      text-align: center;
      font-size: 12px;
      color: var(--text-secondary);
      letter-spacing: 0.2px;
    }

    .footer span {
      color: var(--gold);
    }

    /* Filter */
    .filters {
      display: flex;
      gap: 8px;
      margin-bottom: 28px;
    }

    .filter-btn {
      padding: 7px 16px;
      border-radius: 9px;
      border: 1px solid var(--card-border);
      background: var(--card-bg);
      backdrop-filter: blur(8px);
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
      transition: all 0.2s;
    }

    .filter-btn:hover {
      background: rgba(27, 27, 58, 0.04);
      color: var(--navy);
    }

    .filter-btn.active {
      background: var(--navy);
      color: var(--cream-light);
      border-color: var(--navy);
      box-shadow: 0 2px 8px rgba(27, 27, 58, 0.2);
    }
  </style>
</head>
<body>
  <div class="page-accent"></div>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <h1>${esc(title)}</h1>
        <div class="subtitle">Design Fidelity Report &middot; ${date}</div>
      </div>
      <div class="logo">${logoSrc ? `<img src="${logoSrc}" alt="kiyas">` : "kiyas"}</div>
    </div>

    <div class="meta">
      <div class="meta-item">
        <div class="label">Figma Source</div>
        <div class="value"><a href="${esc(figmaUrl)}" target="_blank">${esc(figmaUrl.length > 60 ? figmaUrl.slice(0, 57) + "..." : figmaUrl)}</a></div>
      </div>
      <div class="meta-item">
        <div class="label">Target</div>
        <div class="value"><a href="${esc(targetUrl)}" target="_blank">${esc(targetUrl)}</a></div>
      </div>
      <div class="meta-item">
        <div class="label">AI Model</div>
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
      Generated by <span>kiyas</span> — AI-powered design fidelity CLI
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
