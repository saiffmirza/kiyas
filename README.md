# kiyas (كياس) — AI-Powered Design Fidelity CLI

> **kiyas** (كياس) — "comparison" in Arabic, Turkish, and Urdu. Pronounced "key-AHS."

A developer-first CLI tool that compares Figma designs against rendered UI components and generates an AI-powered semantic diff report.

Unlike pixel-diff tools, kiyas uses vision AI to understand *what* is different and *why* it matters — outputting actionable, human-readable feedback like:

- "border-radius is 8px in implementation but 12px in design"
- "spacing between title and subtitle is 16px tighter than the design"

Just describe the component by name. kiyas finds it in your codebase, screenshots it, and compares it against the Figma design.

---

## How It Works

```
                          ┌─────────────────────┐
                          │   kiyas CLI          │
                          │                      │
                          │  --figma <url>       │
                          │  --component "..."   │
                          └──────────┬───────────┘
                                     │
                      ┌──────────────┼──────────────┐
                      ▼              ▼               ▼
              ┌──────────────┐ ┌───────────┐ ┌─────────────┐
              │ 1. Auth      │ │ 2. Figma  │ │ 3. Resolve  │
              │              │ │  Capture  │ │  Component  │
              │ Read Claude  │ │           │ │             │
              │ Code / Codex │ │ Export    │ │ AI agent    │
              │ OAuth token  │ │ frame as  │ │ searches    │
              │ from macOS   │ │ PNG via   │ │ codebase,   │
              │ Keychain     │ │ Figma     │ │ finds URL + │
              │              │ │ REST API  │ │ CSS selector│
              └──────┬───────┘ └─────┬─────┘ └──────┬──────┘
                     │               │               │
                     │               ▼               ▼
                     │        ┌────────────┐  ┌────────────┐
                     │        │  Figma     │  │ Playwright │
                     │        │  design    │  │ screenshot │
                     │        │  (PNG)     │  │ (PNG)      │
                     │        └─────┬──────┘  └─────┬──────┘
                     │              │               │
                     │              └───────┬───────┘
                     │                      ▼
                     │          ┌──────────────────────┐
                     └─────────►│ 4. Vision AI Compare │
                                │                      │
                                │ Both images sent to  │
                                │ Claude / OpenAI as   │
                                │ base64 with a        │
                                │ structured prompt     │
                                │                      │
                                │ Returns JSON array   │
                                │ of discrepancies     │
                                └──────────┬───────────┘
                                           │
                                           ▼
                                ┌──────────────────────┐
                                │ 5. Markdown Report   │
                                │                      │
                                │ Discrepancies sorted │
                                │ by severity:         │
                                │ HIGH / MEDIUM / LOW  │
                                │                      │
                                │ Printed to terminal  │
                                │ + optional file      │
                                └──────────────────────┘
```

**Step-by-step:**

1. **Authenticate** — kiyas reads your existing Claude Code or Codex OAuth token from the macOS Keychain. No API keys needed.
2. **Export Figma design** — Parses the Figma URL, calls the Figma REST API to export the frame as a 2x PNG, and fetches node metadata (colors, fonts, spacing).
3. **Resolve component** — An AI agent scans your codebase (file tree, routes, components) and maps your natural-language description to a URL on your dev server + a CSS selector.
4. **Screenshot implementation** — Playwright launches headless Chromium, navigates to the resolved URL, and captures the component.
5. **AI comparison** — Both PNGs are sent to the vision API with a structured prompt. The AI identifies every discrepancy with specific CSS properties and values.
6. **Report** — Results are formatted into a severity-grouped markdown report, printed to the terminal, and optionally saved to a file.

---

## Quick Start

### Prerequisites

- Node.js 20+
- Signed into [Claude Code](https://claude.ai/code) or [Codex](https://platform.openai.com/docs/guides/codex) (for AI auth)
- A Figma personal access token ([generate one here](https://www.figma.com/developers/api#access-tokens))

### Install

```bash
git clone <repo-url> && cd kiyas
npm install
npx playwright install chromium
npm run build
```

### Configure

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Then add your Figma token:

```
FIGMA_ACCESS_TOKEN=your-figma-token-here
DEV_SERVER_URL=http://localhost:3000
```

### Run

```bash
# Describe the component by name — kiyas finds it automatically
kiyas --figma "https://www.figma.com/design/abc123/Design?node-id=1:234" \
  --component "eventHeader on the redemption screen"

# Or provide a direct URL if you already know it
kiyas --figma "https://www.figma.com/design/abc123/Design?node-id=1:234" \
  --target "http://localhost:3000/redemption" \
  --selector ".event-header"

# Save the report to a file
kiyas --figma "https://www.figma.com/design/abc123/Design?node-id=1:234" \
  --component "primary button" \
  --output report.md

# Use OpenAI instead of Claude
kiyas --figma "https://www.figma.com/design/abc123/Design?node-id=1:234" \
  --component "nav bar" \
  --model openai
```

---

## CLI Reference

| Flag | Description | Required |
|------|-------------|----------|
| `--figma <url>` | Figma frame/component URL | Yes |
| `--component <description>` | Natural-language description of the component to find | Yes* |
| `--target <url>` | Direct URL of the rendered component (skips AI lookup) | Yes* |
| `--dev-server <url>` | Dev server base URL (default: `http://localhost:3000`) | No |
| `--model <provider>` | AI provider: `claude` (default) or `openai` | No |
| `--output <path>` | Path to save the markdown report | No |
| `--viewport <size>` | Viewport size for screenshot (default: `1280x720`) | No |
| `--selector <css>` | CSS selector to screenshot a specific element | No |
| `--wait <ms>` | Time in ms to wait before screenshot (for animations/loading) | No |
| `--config <path>` | Path to a JSON config file for batch comparisons | No |
| `--threshold <level>` | Severity filter: `all`, `medium`, `high` (default: `all`) | No |

*\*Provide either `--component` or `--target`. When using `--component`, kiyas uses AI to find the component in your codebase and resolve it to a URL.*

---

## Authentication

kiyas leverages your existing AI subscriptions — no separate API keys needed.

**Claude (default):** If you're signed into Claude Code with a Pro, Max, or Team subscription, kiyas reads the OAuth token from your macOS Keychain automatically. Usage counts against your existing subscription quota.

**OpenAI (alternative):** If you're signed into Codex, kiyas reads that token instead. Use `--model openai` to select it.

**Auth resolution order:**

| Provider | Priority |
|----------|----------|
| Claude | 1. macOS Keychain (`Claude Code-credentials`) |
| | 2. `CLAUDE_CODE_OAUTH_TOKEN` env var |
| | 3. `~/.claude/.credentials.json` (Linux/Windows) |
| OpenAI | 1. macOS Keychain (`codex-credentials`) |
| | 2. `~/.codex/auth.json` |

If no session is found, kiyas prompts you to sign in:

```
No Claude Code session found.

kiyas uses your existing Claude Code subscription — no API keys needed.

Sign in by running:

  claude auth login

Then re-run kiyas.
```

**Figma:** Requires a personal access token. Set it in `.env` as `FIGMA_ACCESS_TOKEN` or in a `.kiyasrc` file.

---

## Config File

For teams running repeated comparisons, create a `kiyas.config.json`:

```json
{
  "figmaAccessToken": "env:FIGMA_ACCESS_TOKEN",
  "model": "claude",
  "viewport": "1280x720",
  "comparisons": [
    {
      "name": "Primary Button",
      "figma": "https://www.figma.com/design/abc123/Design?node-id=1:234",
      "target": "primary button on the login page"
    },
    {
      "name": "Event Card",
      "figma": "https://www.figma.com/design/abc123/Design?node-id=5:678",
      "target": "http://localhost:6006/iframe.html?id=card--event",
      "selector": ".event-card"
    }
  ]
}
```

The `target` field accepts both component descriptions (resolved by AI) and direct URLs. Run with:

```bash
kiyas --config ./kiyas.config.json
```

---

## Example Report

```markdown
# kiyas Report: Primary Button

**Date:** 2026-03-19
**Figma:** https://www.figma.com/design/abc123/Design?node-id=1:234
**Target:** http://localhost:3000/login
**Model:** Claude Sonnet 4.6

## Summary

Found **4 discrepancies** (1 high, 2 medium, 1 low)

## Discrepancies

### HIGH

| Element | Property | Expected (Design) | Actual (Implementation) |
|---------|----------|--------------------|------------------------|
| Button | border-radius | 12px | 8px |

### MEDIUM

| Element | Property | Expected (Design) | Actual (Implementation) |
|---------|----------|--------------------|------------------------|
| Button label | font-weight | 600 (semibold) | 400 (regular) |
| Button | padding | 12px 24px | 8px 16px |

### LOW

| Element | Property | Expected (Design) | Actual (Implementation) |
|---------|----------|--------------------|------------------------|
| Button | box-shadow | subtle drop shadow | none |
```

---

## Project Structure

```
kiyas/
├── src/
│   ├── index.ts                # CLI entry point (argument parsing, orchestration)
│   ├── config.ts               # Config file loading + Figma token resolution
│   ├── auth/
│   │   ├── index.ts            # Auth resolver (picks best available auth)
│   │   ├── claude-oauth.ts     # Read Claude Code OAuth token from Keychain
│   │   └── openai-auth.ts      # Read Codex OAuth token from Keychain
│   ├── resolve/
│   │   └── component.ts        # AI agent: finds component in codebase → URL + selector
│   ├── capture/
│   │   ├── figma.ts            # Figma REST API: export frame as PNG + metadata
│   │   └── playwright.ts       # Playwright: headless screenshot of rendered component
│   ├── compare/
│   │   ├── index.ts            # Orchestrator: sends images to vision AI
│   │   ├── claude.ts           # Claude Vision API call
│   │   ├── openai.ts           # OpenAI Vision API call
│   │   └── prompt.ts           # The comparison prompt (shared across providers)
│   ├── report/
│   │   └── markdown.ts         # Format AI response into structured markdown
│   └── utils/
│       ├── parse-figma-url.ts  # Extract file key + node ID from Figma URL
│       └── logger.ts           # Minimal logging utility
├── .env.example
├── .kiyasrc.example
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Runtime | Node.js (TypeScript) |
| Screenshot capture | Playwright (headless Chromium) |
| Figma export | Figma REST API |
| AI comparison | Claude Vision API or OpenAI Vision API |
| Component resolution | Claude / OpenAI (codebase agent) |
| Output | Markdown (terminal + file) |
| Build | tsup |
| Package manager | npm |

---

## Stretch Goals

These are not part of the MVP:

- CI integration (GitHub Actions, CircleCI)
- PR comment posting with the report
- Figma node metadata enrichment (pull actual design token values)
- Side-by-side image output in the report
- Interactive mode to step through discrepancies
- Caching Figma exports by `lastModified` timestamp
- Storybook addon wrapper
- Web dashboard for team use

---

## License

MIT
