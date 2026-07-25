---
target: src/renderer/src/App.tsx
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-07-25T21-18-46Z
slug: src-renderer-src-app-tsx
---
Method: dual-agent (A: ad1461acf74b4623f · B: a499f13d3de4217bd)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Step ledger and indeterminate workbar are genuinely excellent; but no elapsed time on the longest waits, `doctor()` only re-runs on window focus (`App.tsx:123-127`), and zero live regions so a screen reader hears silence for the entire multi-minute run. |
| 2 | Match System / Real World | 3 | Copy and terminology are strong and plain; `modelLabel` appears as a bare unlabelled chip (`App.tsx:510`), and a redundant "Progress" card renders during the `preview` phase (`App.tsx:820`). |
| 3 | User Control and Freedom | 2 | No cancel exists anywhere — `KiyasApi` has no abort method (`types.ts:91-127`). Removing a project is instant, unconfirmed, and silently reassigns `selectedRepo` to `repos[0]` (`ipc.ts:178`). |
| 4 | Consistency and Standards | 2 | Up to three simultaneous `.btn.primary` (`App.tsx:492`, `571`, `650`) against DESIGN.md's "exactly one per screen"; `.side-hint` sets prose in gilt (`theme.css:350`), breaking both the One Metal and Two-Ink rules; no `Menu.setApplicationMenu` in `src/main/index.ts`, so zero macOS accelerators. |
| 5 | Error Prevention | 2 | `canRun` (`App.tsx:205-214`) never consults `doctor`, so unconfigured runs burn the whole capture path; no `node-id` validation on the Figma URL; `rerunReport` passes a hidden `selector` the form doesn't show (`App.tsx:256`). |
| 6 | Recognition Rather Than Recall | 2 | `phase === "done"` unmounts every input (`App.tsx:505`), so the result shows no frame, component, repo, or port. History rows fall back to a truncated id that reads as a duplicate of the adjacent date (`App.tsx:700`). |
| 7 | Flexibility and Efficiency | 1 | Zero keyboard shortcuts, no `<form>`, no `autoFocus`, `resetForNew` wipes the Figma URL (`App.tsx:272`), and the only accelerator (`↻`) is `visibility: hidden` until hover and rendered only at `phase === "idle"`. |
| 8 | Aesthetic and Minimalist Design | 3 | Genuinely restrained, and the detector confirms it: `App.tsx` has zero hardcoded colors and all five real shadows match the documented vocabulary exactly. But `How it works` is permanent furniture, pushing `Recent comparisons` below the fold at the 860px default height. |
| 9 | Error Recovery | 1 | One generic `Something went wrong` card for every failure mode, carrying an unclassified `err.message`; `ipc.ts:400-402` tells a desktop user to run `kiyas setup`; `setupHint` degrades to a bare "Setup failed."; `.error-box` is not `role="alert"` and has no `max-height`. |
| 10 | Help and Documentation | 2 | `How it works` and the Figma token panel are both good. Nothing explains `Crop to design shape` — the most confusing control, at the highest-stakes moment. No app menu, so no Help. |
| **Total** | | **21/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

**The visual language is authored for this product. The interaction model is not — and the split falls in the worst possible place.**

**LLM assessment.** Genuinely product-specific: the five step labels written as sentences about *this* pipeline (`App.tsx:20-26`), with `visibleSteps` (`App.tsx:195-201`) omitting `figma` for local images and `resolve` when the component field is empty — so the list is a promise about this specific run, not a template with dimmed rows. The approval phase existing at all as a distinct state. `Crop to design shape`, which is meaningless outside a design-vs-render pair. The Connections quartet, which exists *because* of the "your own subscription, never an API key" positioning. The report-focus layout that hands the window to the artifact. The closed parchment/navy/gilt palette with serif numerals and mono for machine values — no generic dev tool lands here.

Liftable unchanged into any Electron dev tool: the 264px sidebar + 720px column shell, the `.card`/`.btn`/`.tabs`/`.field` set, the update banner, the history list, and the sun/moon theme switch — the single most generic element in the app, occupying the window's most valuable real estate.

The load-bearing indictment: a product whose entire thesis is *we compare a design to an implementation* ships its comparison moment as two `<img>` tags at `max-height: 360px` (`theme.css:1040-1047`) inside a 720px column — roughly 340px each, with no zoom, no click-to-enlarge, no overlay, no onion-skin, no difference toggle, no synced scroll. Strip the copy and the palette and the interaction model reads: pick a thing on the left, fill a form, watch a step list, read an output. Nothing in the *behavior* knows the user's job is comparing two images.

**Deterministic scan.** `detect.mjs` on `src/renderer` exited 2 with **23 findings, all in `theme.css`** — `App.tsx` and `index.html` both scan clean. Rules fired: `design-system-color` ×10, `design-system-font-size` ×9, `design-system-radius` ×3, `side-tab` ×1.

**11 of the 23 are false positives**, and they all trace to one collector limitation: `detector/design-system.mjs:433` reads only the DESIGN.md frontmatter `colors:` and `typography[].fontSize` maps, so it cannot see prose ranges, `components.*` values, or any dark-theme token. Specifically —

- `side-tab` @ 195: DESIGN.md:364-366 explicitly sanctions the 3px gilt left edge on a selected row.
- `#111118` @ 597, 612: declared in frontmatter `components.button-primary.textColor` and in prose at DESIGN.md:385.
- `1.5px` radius @ 705: the diamond ornament, specified to that exact value at DESIGN.md:368-370.
- `22px` @ 951, `20px` @ 966, `9.5px` @ 310: all inside documented prose *ranges* (Headline 21–22px, Display 30/20px, Label 9.5–11px) that the frontmatter pins to single steps.
- `rgba(0,0,0,0.35)` @ 1149: documented as the dark-theme `working-bloom` shadow.
- Seven dark-theme tints @ 1133–1157: alpha derivations of the dark semantic tokens declared at `theme.css:40-42`. Seven findings, one issue class.

**12 true hits, reducing to three classes:** off-ramp type steps (11.5px ×3, 14.5px, 15px, 17px — 7 sites, none in any documented range), off-scale radii (7px, 2px — both already named as debt in DESIGN.md:352-359), and **dead CSS the detector doesn't check for**: `.verdict`, `.verdict strong`, `.verdict-split`, `.report-frame`, `.progress-block` have no consumer in `App.tsx` or `TerminalPanel.tsx`. Two of the type-step hits live inside those dead rules.

**Where the detector was blind, and it matters more than what it caught.** Assessment B computed 54 light-theme text pairings with full alpha compositing through every translucent layer: **30 fail WCAG AA**, in two systemic clusters. And `theme.css` uses no `color-mix()` anywhere — all 45 rgba tints hand-duplicate their token's channel values, so changing `--gold` silently desynchronizes four gold tints.

**Visual overlays: none.** No user-visible overlay was produced and none exists. Two independent hard blockers, both verified: `node_modules` is absent repo-wide (`playwright` is declared in `package.json` but `require.resolve` fails; Chromium binaries are cached but there's no driver package), and the renderer cannot mount outside Electron regardless — `App.tsx:117` calls `window.kiyas.updateCheck()` with no feature detection, throwing `TypeError` inside a `useEffect` under StrictMode with no error boundary. 22 further unguarded `window.kiyas.*` call sites follow. Fallback signal: all geometry below is CSS-derived, not measured. Values from explicit dimensions or `line-height: 1` are exact; auto-height boxes are computed as `font-size × 1.2 + padding + border` and marked approximate.

## Overall Impression

This is a well-made app with a real point of view that has never been used by anyone who couldn't see it or couldn't reach for a mouse. The reading path is excellent — `--text` on `--cream` is 12.05:1, `.card h2` is 15.71:1 — and the restraint is real, not accidental. Then everything in the quiet register fails: every uppercase micro-label in the app sits at 2.72:1, and every use of gilt as a *foreground* color sits between 2.01:1 and 2.66:1, with the two worst ratios in the entire app landing on *selected* and *active* states — the states meant to read as most prominent.

The single biggest opportunity is not on that list. It's that **the approval gate, not the step ledger, should be the signature component.** The product's thesis is "we compare a design to an implementation," and the app asks the user to make exactly that comparison once, at two 340px thumbnails, with no comparison tool at all. An onion-skin slider, a synced-zoom pair, or a difference toggle on that one screen would do more for "authored for this product" than the entire palette does.

## What's Working

**1. The step ledger as full sentences, gated to only the steps that will actually run.** (`App.tsx:20-26`, `195-201`, `theme.css:821-922`.) It works for two reasons that are easy to miss. The labels describe the pipeline the user's mental model already contains — "Exporting the design from Figma", "Finding the component in the codebase" — so no translation is needed, which is PRODUCT.md principle 4 executed precisely. And `visibleSteps` omits steps that won't run, making the list a promise about *this* run rather than a fixed template. The indeterminate workbar, the 1.2s medallion pulse, and the 13.5→14.5px active-row growth then give an unknowable-duration wait a legible "something specific is happening" without faking a percentage.

**2. Blocked states name the next action in the place the blockage is noticed.** `First, pick a dev server port in the sidebar.` (`App.tsx:205-213`); `Add the repo that renders your UI — comparisons and reports live with it.` (`320-323`); `None running. Start one in your project, e.g. npm run dev.` (`356-360`). Each names both the specific action and the specific place, and the repo empty state smuggles in a reason that teaches the storage model in passing. The contrast with the error card proves this copy was authored deliberately.

**3. The Figma token panel is a complete, self-contained credential flow.** (`App.tsx:547-583`, `ipc.ts:312-341`.) Exact navigation path, minimum-scope guidance, an unprompted reassurance about what the token *won't* do, an in-app escape hatch to Figma's settings, server-side validation before anything persists, and a rejection message naming the HTTP status. It removes every reason to leave the app and every uncertainty about whether what you pasted was right — the exact inverse of the generic error card three sections away.

## Priority Issues

### [P0] Keyboard users cannot reach the primary actions, and nothing anywhere shows focus

All three selection mechanisms are `onClick` handlers on bare `<li>` elements: repo select (`App.tsx:331`), port select (`App.tsx:366`), open past report (`App.tsx:698`). No `tabIndex`, no `role`, no key handler. Assessment B confirms mechanically: **zero** `aria-*`, **zero** `role=`, **zero** `tabIndex` in the entire renderer, and **zero** `:focus-visible` rules in `theme.css` against `outline: none` at `theme.css:552`. The nested `.repo-remove` and `.history-rerun` buttons are `visibility: hidden` until parent hover, which removes them from the tab order entirely — neither is keyboard-reachable under any circumstance. `canRun` requires both a repo and a port, so the core task is keyboard-unreachable except in the narrow accident where exactly one port is listening and the repo was auto-selected by `reposAdd`.

Also: no `<h1>` in the document; none of the three text inputs has a programmatic label (the component field's `<label>` neither wraps the input nor carries `htmlFor`, and the input has no `id`); no `aria-pressed`/`aria-selected` on either toggle set; 9 of 13 interactive classes are under 24×24px, with `.side-add` at exactly 20×20 and `.theme-switch button` at 22×22 with zero padding slack; and two infinite animations (`theme.css:855`, `907`) sit outside the single `prefers-reduced-motion` gate — precisely the class WCAG 2.2.2 addresses.

**Why it matters:** the primary persona is a developer who lives on the keyboard. Sam cannot switch projects, choose between two dev servers, re-run a comparison, or remove a stale repo at all.

**Fix:** convert each row's clickable content to `<button type="button">` inside the `<li>`, or make the `<ul>` a `role="listbox"` with `role="option" tabIndex={0}` rows plus Enter/Space handlers. Replace `visibility: hidden` with `opacity: 0` + `:focus-visible { opacity: 1 }` on `.repo-remove` and `.history-rerun`. Add a gilt `:focus-visible` ring for `.btn`, `.btn.primary`, `.tabs button`, `.side-add`, `.side-toggle`, `.env-cta`, `.terminal-btn`, `.theme-switch button`, `.update-dismiss`, `.term-bar button` — the sidecar already ships the correct rule (`.ds-btn-primary:focus-visible { outline: 2px solid var(--navy); outline-offset: 2px; }`) and `theme.css` doesn't have it. Add `role="alert"` to `.error-box` and an `aria-live` region for phase and step changes. Wrap the two infinite animations in a `prefers-reduced-motion: reduce` override.

**Suggested command:** `/impeccable audit`

### [P0] 30 of 54 light-theme text pairings fail WCAG AA — and DESIGN.md mandates two of the failures

**Cluster 1 — every `--ink-faint` micro-label: 12 of 12 pairings fail at 2.66–2.80:1.** This covers `PROJECTS`, `DEV SERVERS`, `CONNECTIONS`, the terminal bar, completed steps, and both hover-revealed micro-buttons — rendered at 10–10.5px, the worst possible size to pair with 2.72:1. DESIGN.md's **Letterspaced-Label Rule** makes this the system's central organizing device, so the documented rule currently prescribes the least legible text in the app.

**Cluster 2 — every use of `--gold` as a foreground: 9 of 9 fail at 2.01–2.66:1.** Worst two in the app: `.port-list li.selected .port-proc` on gold-18% at **2.01:1** and `.theme-switch button.active` on `--gold-muted` at **2.20:1** — both *selected* states. `.preview-label` (the `DESIGN` / `IMPLEMENTATION` capture labels) is 2.66:1, and **DESIGN.md:188 explicitly sanctions gilt there.** `.side-hint` — which carries setup instructions — is 2.30:1.

**Cluster 3 — `--text-secondary`, 6 of 15 fail, all marginally and all surface-dependent.** It clears on `--cream` (4.57:1) and `--card-bg` (4.90:1) but not on the sidebar's one-step-deeper `--parchment` (4.25:1). A 0.25 shortfall caused entirely by the panel tone.

**Cluster 4 — amber is the only semantic signal that fails.** `.c-medium` is 3.02:1 on the page while `--red` clears at 5.36–6.12:1 and `--green` at 5.01–6.29:1. In a product whose entire output is severity, the *middle* severity is the only illegible one — which inverts the ordering the color exists to convey. Also failing: `input::placeholder` at 2.60:1, `.warning-box` amber-on-amber-tint at 2.95:1, `.update-dismiss` at 3.18:1, and `.btn.primary:disabled` at 3.89:1 — the app's primary action in its default first-run state.

Dark theme fares materially better on all of these, which contradicts DESIGN.md's "both themes are first-class peers, neither gets designed second." Light is the one that was under-verified.

**Why it matters:** two of these are prescribed by the design system I just wrote. Fixing the CSS without fixing DESIGN.md guarantees the failure returns on the next pass. This is the finding that most needs a decision from you, because it's a direct conflict between the documented aesthetic and the accessibility floor.

**Fix:** raise `--ink-faint` from 0.45 to roughly 0.62 alpha (≈4.6:1 on parchment) and re-verify the 12 pairings, or lift micro-labels to `--text-secondary` and darken that token slightly so it clears on `--parchment` too. Stop using `--gold` as a text color: keep gilt for fills, edges, and rings, and set foreground text on gilt surfaces in `--navy` or `#111118`. Darken `--amber` to roughly `#8a6410` for a 4.5:1 pass on both page and card. Then amend DESIGN.md — the Letterspaced-Label Rule needs a minimum-contrast clause, and the sanctioned gilt capture labels at DESIGN.md:188 have to change.

**Suggested command:** `/impeccable audit`

### [P1] "you approve the captured pair before any AI runs" is false

`resolveComponent` is an AI call executed inside `capture` (`ipc.ts:418-432`), *before* the approval gate. `App.tsx:687` states the commitment without qualification, and PRODUCT.md principle 2 makes it binding: "Nothing expensive happens without consent… a product commitment, not a UI step to streamline away."

**Why it matters:** the consent gate is one of two mechanisms PRODUCT.md names as uncopyable. A user who fills the optional component field has already spent an AI call by the time they're asked to consent — and the app told them they hadn't. Discovering that erodes the exact trust the gate exists to build.

**Fix:** either scope the copy at `App.tsx:687` to "you approve the captured pair before the comparison runs" and surface the resolve step's AI nature in the `.soft-note` at `App.tsx:760-765`, or move the resolve behind its own confirmation. The sentence must not ship as written. Which one you pick is a product decision, not a copy fix.

**Suggested command:** `/impeccable clarify`

### [P1] The pipeline has no interruption model — and mid-run interaction silently misfiles the result

`KiyasApi` (`types.ts:91-127`) has no abort method. Once `run()` fires, every control is disabled through `capturing` and `comparing`. A user who spots a wrong Figma URL one second in must wait out a Figma export, an AI resolve, and a Playwright launch — then press `Start over`, which discards that spent AI call and re-runs the whole chain.

Worse, the things that *aren't* disabled are the dangerous ones. The repo `<li>`s stay clickable during a run (`App.tsx:331`). Switching repos mid-run changes `repo`, which re-keys `refreshHistory` — but the run writes its report to `pending.params.repo`'s `.kiyas/reports` (`ipc.ts:553`), the *old* repo. The `phase === "done"` effect then refreshes history for the *new* one. **The comparison completes successfully and does not appear in the history the user is looking at.** Same class: `.tabs` aren't disabled either, so clicking `Screenshot` during a Figma run removes the already-completed `figma` row from the progress list. And removing the selected repo mid-run silently reassigns `selectedRepo` to `repos[0]` while the run keeps writing to a repo no longer in the list.

**Why it matters:** PRODUCT.md principle 3 says the second comparison must be faster than the first. An uninterruptible pipeline makes every misstep maximally expensive, and the silent misfiling means a user can lose a completed AI call with no error and no explanation.

**Fix:** add `compareCancel: () => Promise<void>` to `KiyasApi`, backed by an `AbortController` threaded through the `capture` and `compare-confirmed` handlers in `ipc.ts`. Render a secondary `Cancel` in `.progress-card` whenever `busy`, paired with an elapsed-seconds counter — honest temporal information that doesn't violate the no-fake-percentage rule. Separately, disable the repo list, port list, and `.tabs` while `busy`, and add a confirmation to repo removal.

**Suggested command:** `/impeccable harden`

### [P1] Runs launch into environments the app already knows will fail, then fail into a contentless card

`canRun` (`App.tsx:205-214`) consults `repo`, `targetUrl`, and `hasDesign` — never `doctor`. With no Figma token and the Figma tab active, you burn the full capture path and land on `<h2>Something went wrong</h2>` carrying a raw `err.message` reading "No Figma token found. Set FIGMA_TOKEN or run `kiyas setup`" (`ipc.ts:400-402`) — a CLI instruction, inside the desktop app, contradicting the Connections panel that already handles it. Every failure mode — Figma 403, dev-server ECONNREFUSED, missing Chromium, AI CLI timeout — renders identically and unclassified, with a `Back` button and no next action. `.error-box` also has no `max-height`, so a multi-kilobyte stack trace buries `Back` below the fold. The heading names nothing, which is the one thing PRODUCT.md principle 5 forbids.

**Why it matters:** this is the first-run experience, and it's where the app most looks broken rather than unconfigured.

**Fix:** extend `missingStep` with `doctor` cases — `!doctor.figmaToken.ok && designTab === "figma"` → "add your Figma token in Connections"; `!doctor.browsers.ok` → "install the screenshot browser in Connections"; `!doctor.claude.ok && !doctor.codex.ok` → "connect Claude Code or Codex in Connections". Rewrite `ipc.ts:400-402` for a desktop reader. Replace the generic heading with a classified one, give the error card a second action that jumps to the relevant Connections item, cap `.error-box` height, and add `role="alert"`.

**Suggested command:** `/impeccable harden`

## Persona Red Flags

**Alex (impatient power user, 5th comparison of the day).** Zero keyboard shortcuts — `src/main/index.ts` never calls `Menu.setApplicationMenu` and there's no `onKeyDown` anywhere in `src/renderer`. No `<form>`, so Enter in the Figma field does nothing. No `autoFocus`, so every comparison opens with a mouse trip. `.tabs` has no `role="tablist"`, so no arrow-key switching. `resetForNew` clears `figmaUrl`, so comparing the *same* frame after a fix — the definitional repeat action in this product — requires re-copying from Figma. The one accelerator (`↻`) is hover-revealed and only rendered at `phase === "idle"`, so reaching it from a result costs three interactions plus a 0.63s `rise` stagger. And it lies: `rerunReport` sets `setComponent("")` while passing `item.rerun.selector` straight through, so the form visibly disagrees with what's executing. `selectedPort` is plain `useState`, so every launch requires re-picking — while `theme` and `connectionsOpen` are both faithfully persisted. The two things a daily driver most needs to survive are the only two that don't.

**Sam (keyboard + screen reader).** Covered in P0, plus: no live regions at all, so pressing Compare produces silence for the entire run and failure is never announced. The blocked-state explanation is keyboard-unreachable — `.btn.primary` is `disabled` so Chromium drops it from the tab order, and `.run-hint` is an adjacent `<span>` with no `aria-describedby`, so "every blocked state names its next action" holds visually and only visually. Meaning by color alone: `.port-dot` is an empty `<span>` whose entire content is a green background; `.steps li.current` vs `.done` differ only by diamond fill and text color. Credit where due — severity counts pair color with the words "high"/"medium"/"low", and progress states pair color with `✓`/`✕`/`•`. `title` carries the accessible name for six icon-only buttons; `aria-label` costs nothing and is the correct instrument.

**Riley (deliberate stress tester).** `doctor === null` renders nothing, so the Connections panel is a labelled void for the first frames and permanently if `runDoctor()` rejects. No history empty state. `resolved.filePath` + `selector` in the `.soft-note` has no truncation, no `min-width: 0`, and no `word-break`, so a deep monorepo path wraps and pushes `.actions` down — violating DESIGN.md's Ellipsis Rule ("machine values never wrap") *and* the Measured-Mono Rule, since it's set in body sans. `reports-list` awaits `loadReport` for *every* id in the directory before `.slice(0, 20)` (`ipc.ts:210-256`), so a 500-report project reads 500 reports on every repo switch and every `phase === "done"` transition, then silently truncates with no "showing 20 of 100" and no in-app path to report 21. Corrupt reports vanish silently (`return null` at `ipc.ts:248`), so the history count won't match the directory and nothing says why. After a crop failure the screen says "Crop failed…" while the progress card below shows every capture step as `done` — "this failed" and "everything succeeded" simultaneously.

## Minor Observations

- **The report state overflows when an update is pending.** `.main-inner.focus` is `height: calc(100vh - 40px)` and the with-terminal variant is `calc(100vh - 340px)` — correct for the drag strip and drawer. But `.update-banner` also lives inside `.main-scroll` and is in neither calc, so an available update makes the report frame overflow by the banner's height, breaking the Artifact-First rule.
- The update banner renders outside `.main-inner`, so it's exempt from the `rise` stagger while everything below it animates. The banner snaps in; the rest floats.
- `.card h2` sets `margin-bottom: 16px` but sits in an `align-items: baseline` flex row with `.context-chips`, so the chips carry a 16px offset from the baseline they're aligned to and sit visually high above the tab track.
- `.result-head` wraps badly at the 900px window floor — `flex-wrap: wrap` plus `.result-spacer { flex: 1 }` drops both buttons to their own line and collapses the spacer.
- `setupHint` is never cleared on success, so "Finish the Claude Code sign-in in Terminal" persists indefinitely next to a green `Connected` tag saying the opposite.
- **The gilt count exceeds DESIGN.md's own audit test on the approval screen:** the primary button fill, both `.preview-label`s, the selected repo's left edge, and the selected port's left edge = 5. The One Metal Rule says more than three and the accent has stopped meaning anything.
- `.progress-card` shouldn't render at `phase === "preview"` — it's a second, non-actionable card beneath the approval card, which already implies capture succeeded.
- **`summary.total === 0` renders a bare `0 discrepancies`** with no verdict and no green, while `.c-clean` exists and is used in *history*. PRODUCT.md lists *clean* as established terminology. The single best outcome in the product renders as a bare zero — and under the peak-end rule, that's the memory a daily driver accumulates over a hundred clean runs. Failure is where the app's most expressive typography lives.
- **Dead CSS:** `.verdict`, `.verdict strong`, `.verdict-split`, `.report-frame`, `.progress-block` — no consumer anywhere. Two detector type-step findings live inside these unreachable rules.
- **`backgroundColor: "#f6f0e6"`** (`src/main/index.ts:25`) — dark-theme launch flashes parchment. DESIGN.md documents it and it still ships. Fix in main by reading the persisted `kiyas.theme`, not in CSS.
- `viewport: "1440x900"` and `threshold: "all"` are hardcoded and invisible (`App.tsx:243-244`), so a user comparing a mobile frame reads the resulting size-mismatch warning as a Kiyas defect.
- No `color-mix()` anywhere: all 45 rgba tints hand-duplicate their token's channel values, so changing `--gold` silently desynchronizes four gold tints and `--red` six red tints.
- `TerminalPanel.tsx` ships a full 16-color ANSI palette including `#1d4ed8` blue, `#86198f` magenta, and `#0e7490` cyan — hues with no counterpart in DESIGN.md's closed palette. ANSI arguably requires all sixteen slots; the detector doesn't scan this file.
- `Recent comparisons · {basename(repo)}` duplicates the `.context-chip` showing the same repo ~200px above it.
- `.pathpill`'s `direction: rtl` will visually transpose bidi-neutral runs — a path like `/Users/x/(v2)/app` can render its bracket group reordered. Minor, but it's a correctness bug in a machine value.

## Questions to Consider

1. **What if the approval gate — not the step ledger — were the signature component?** The app asks the user to make exactly the comparison the product exists for, at two 340px thumbnails, with no comparison tool. An onion-skin slider or a difference toggle on that one screen would do more for design specificity than the entire palette does.
2. **Is the real commitment "no AI without consent" or "no *comparison* without consent"?** `resolveComponent` spends an AI call before the gate while the UI promises otherwise. One of those two has to move.
3. **The app persists the theme and a collapsed panel, and forgets the port and the last frame.** What would the idle screen look like if it opened on *"run the last comparison again"* rather than an empty form?
4. **Is the viewport decision "expose it or not," or just "name it"?** A read-only `1440×900` chip beside the repo and URL chips costs nothing, needs no new control, and removes an entire class of "Kiyas is inaccurate" distrust.
5. **Does the Gilded Ledger survive contact with WCAG, or does it need amending?** Two of its documented rules currently prescribe contrast failures. The palette can be fixed, but the rules have to change with it.
