# Product

<!-- impeccable:product-schema 1 -->

Scope: this record covers **Kiyas Desktop** (`apps/desktop`) only. The monorepo has no
root PRODUCT.md; `packages/cli` and `packages/core` are not described here.

## Platform

web

## Users

Primary users are **design-minded developers and hybrid ICs** — people who write the
frontend code *and* own the visual result. They are fluent in both Figma and their own
codebase, so neither needs explaining.

They are working locally on a machine that already has: the repo cloned, a dev server
running, a Figma personal access token, and a signed-in `claude` or `codex` CLI. They
reach for the app during implementation, when they want to know how far the built
component has drifted from the design.

The README's "designers and anyone who'd rather not touch a terminal" framing overstates
the audience: the happy path requires a repo, a port, and a Figma token. Non-technical
designers are not the design target.

## Product Purpose

Kiyas Desktop compares a Figma frame (or a supplied screenshot) against the same
component as actually rendered by the user's running dev server, and reports the
semantic differences with severity.

Success is being a **daily driver** — installed and returned to for real fidelity work,
not a demo. That makes reliability, the speed of the repeat loop, capture
trustworthiness, and report legibility the things that matter most. It is not primarily
a showcase, an on-ramp to the CLI, or an accessibility shim for terminal-averse users.

## Positioning

Two mechanisms a neighboring product could not truthfully copy:

1. **Semantic, not pixel, diffing.** Vision AI describes *what* differs and *why* it
   matters ("border-radius is 8px in implementation but 12px in design"), rather than
   emitting a highlighted pixel delta.
2. **The user's own AI subscription, never an API key.** All AI calls shell out to the
   `claude` or `codex` CLI already signed in on the machine. Kiyas stores no AI
   credentials and never asks for one.

Alongside those: the component is found by describing it in plain language, and the user
approves the captured design/implementation pair before any AI call is made.

## Operating Context

The everyday loop:

1. Add / select a project folder in the sidebar.
2. Select a detected dev-server port (auto-detected, polled every 10s, auto-selected
   when exactly one is running).
3. Provide the design: a Figma frame URL, or a local screenshot file.
4. Optionally describe the component in plain language ("the event header on the
   redemption screen"); AI resolves it to a file path, URL, and CSS selector.
5. Capture. Review the side-by-side pair, with any mismatch warning; optionally "crop to
   design shape"; then approve or start over.
6. Compare. Progress advances through five named steps (export design → find component →
   screenshot → compare → write report).
7. Read the report in-app, or open it in the browser. It also persists under the
   project's `.kiyas/reports/` and appears in a "Recent comparisons" list with one-click
   re-run.

Supporting context: a **Connections** panel reports readiness of Claude Code, Codex, the
Playwright Chromium, and the Figma token, with per-item setup actions that launch the
real sign-in flow in Terminal. A built-in terminal drawer (node-pty + xterm.js) is pinned
to the selected repo's directory. An update notice appears when a newer GitHub release
exists.

## Capabilities and Constraints

Confirmed capabilities:

- Multi-project sidebar with persisted list and selection
- Dev-server port discovery with owning process name
- Figma-link and local-screenshot design sources
- Natural-language component resolution
- Capture preview, mismatch warning, and manual crop-to-design-shape
- Explicit human approval gate before any AI call
- Per-step progress reporting, including failure state
- In-app HTML report (sandboxed iframe) plus "open in browser"
- Per-project report history with re-run
- Environment doctor with guided setup for each dependency
- Embedded terminal scoped to the selected repo
- Light and dark themes, persisted, defaulting to the system preference
- GitHub release update check

Technical constraints:

- Electron 33 + React 18 + electron-vite; single window, no responsive breakpoints
  required — the design target is a resizable desktop window
- macOS, Apple Silicon only (`dmg` + `zip`, arm64); `com.saifmirza.kiyas`
- Ad-hoc signed, **not notarized** — first launch requires right-click → Open or
  clearing the quarantine attribute
- Comparison logic lives in `@kiyas/core` and is shared with the CLI and MCP server;
  the desktop app must not fork engine behavior
- The renderer reaches the main process only through the `window.kiyas` preload bridge
- Viewport (`1440x900`) and severity threshold (`all`) are currently hardcoded in the
  desktop run path and not user-controllable
- Known parity gaps with the CLI, deliberately open: no multi-run majority vote, no
  wait/authState options, no remote design-image ingestion

Terminology (user-facing, established): *comparison*, *design* vs *implementation*,
*discrepancy*, severity as *high / medium / low*, *clean* for a zero-discrepancy result,
*project* for a repo, *Connections* for environment readiness.

Undecided: whether viewport and threshold become user-facing controls; whether
notarization happens; whether Intel or Windows/Linux builds are ever shipped.

## Brand Commitments

Binding:

- The name **kiyas** (كياس) — "comparison" in Arabic/Turkish/Urdu, pronounced
  "key-AHS". Lowercase in the wordmark; the macOS app is titled **Kiyas**.
- The wordmark assets (`wordmark.png`, `wordmark-dark.png`) and the app icon
  (`build/kiyas.icon`, a macOS 26 Liquid Glass icon).

Explicitly **not** binding: the incumbent palette (cream / navy / gold), the serif +
Avenir typographic pairing, and the current surface treatments. They are the shipped
system and the starting authority for refinement, but the user has left them open to
replacement if a stronger direction wins. The HTML report in `@kiyas/core` shares that
palette's lineage, so any replacement must reckon with cross-surface divergence.

Voice, as written in the shipped copy: plain, second-person, concrete, no marketing
register. Errors and empty states tell the user the next action ("Add the repo that
renders your UI", "First, pick a dev server port in the sidebar"). Preserve this.

## Evidence on Hand

- Working product: the full flow described above is implemented and shipped
- Shipped releases: Kiyas Desktop 0.1.0 (GitHub, tag `desktop-v0.1.0`); current version
  in-tree is 0.1.1. `kiyas-cli` is published on npm.
- Real assets: wordmark (light + dark), app icon, generated HTML reports with real
  side-by-side captures
- Engine eval harness exists in the repo with measured numbers, but those measure
  `@kiyas/core`, not the desktop app

Absences future work must not fabricate: **no** testimonials, named customers, user
counts, install counts, press, case studies, pricing, or hosted demo. No notarization.
No accuracy claim may be stated on a desktop surface without citing the eval harness.

## Product Principles

1. **The engine is shared; only the experience is ours.** Never fork `@kiyas/core`
   behavior to make a desktop surface nicer.
2. **Nothing expensive happens without consent.** The capture-approval gate before any
   AI call is a product commitment, not a UI step to streamline away.
3. **Built for the repeat loop.** The second comparison of the day must be faster than
   the first; assume the user is mid-implementation, not onboarding.
4. **Assume competence in both worlds.** The user knows Figma and knows their codebase.
   Explain Kiyas's own mechanics, never theirs.
5. **Every blocked state names its next action.** Missing repo, missing port, missing
   token, failed capture — each says what to do, in the place it's noticed.
