---
name: Kiyas Desktop
description: A gilded ledger for design fidelity — navy ink on parchment, gilt reserved for what matters.
colors:
  cream: "#f6f0e6"
  cream-light: "#faf6ee"
  cream-dark: "#e5ddd0"
  parchment: "#efe8d9"
  navy: "#1b1b3a"
  navy-light: "#2d2d52"
  gold: "#b8963e"
  gold-light: "#d4b667"
  gold-muted: "rgba(184, 150, 62, 0.15)"
  gold-ink: "#7d5f16"
  ink-on-gold: "#111118"
  text: "#2c2c3e"
  text-secondary: "#5c5c72"
  ink-faint: "rgba(27, 27, 58, 0.68)"
  hairline: "rgba(27, 27, 58, 0.1)"
  card-bg: "rgba(255, 255, 255, 0.55)"
  red: "#b91c1c"
  amber: "#8a6410"
  green: "#166534"
typography:
  display:
    fontFamily: "Iowan Old Style, Palatino, Book Antiqua, Georgia, serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.1
  headline:
    fontFamily: "Iowan Old Style, Palatino, Book Antiqua, Georgia, serif"
    fontSize: "21px"
    fontWeight: 600
    letterSpacing: "0.005em"
  title:
    fontFamily: "Iowan Old Style, Palatino, Book Antiqua, Georgia, serif"
    fontSize: "16px"
    fontWeight: 600
  body:
    fontFamily: "Avenir Next, Avenir, Seravek, -apple-system, Helvetica Neue, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Avenir Next, Avenir, Seravek, -apple-system, Helvetica Neue, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
    letterSpacing: "0.14em"
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "12.5px"
    fontWeight: 600
rounded:
  xs: "6px"
  sm: "8px"
  md: "9px"
  notice: "10px"
  lg: "12px"
  card: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "28px"
  3xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink-on-gold}"
    rounded: "{rounded.md}"
    padding: "11px 28px"
  button-primary-hover:
    backgroundColor: "{colors.gold-light}"
  button-secondary:
    backgroundColor: "rgba(255, 255, 255, 0.7)"
    textColor: "{colors.navy}"
    rounded: "{rounded.md}"
    padding: "9px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.gold-muted}"
  button-cta-pill:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.cream-light}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  card:
    backgroundColor: "{colors.card-bg}"
    rounded: "{rounded.card}"
    padding: "26px 28px"
  input:
    backgroundColor: "rgba(255, 255, 255, 0.75)"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "11px 13px"
  nav-item:
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "7px 10px"
  nav-item-selected:
    backgroundColor: "rgba(184, 150, 62, 0.18)"
    textColor: "{colors.navy}"
    rounded: "{rounded.sm}"
    padding: "7px 10px"
  chip-context:
    backgroundColor: "rgba(27, 27, 58, 0.05)"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  chip-status-ok:
    backgroundColor: "rgba(22, 101, 52, 0.1)"
    textColor: "{colors.green}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  tab:
    textColor: "{colors.text-secondary}"
    rounded: "7px"
    padding: "6px 14px"
  tab-active:
    backgroundColor: "rgba(255, 255, 255, 0.95)"
    textColor: "{colors.navy}"
    rounded: "7px"
    padding: "6px 14px"
  notice-warning:
    backgroundColor: "rgba(180, 130, 20, 0.09)"
    textColor: "{colors.amber}"
    rounded: "{rounded.notice}"
    padding: "12px 14px"
  notice-error:
    backgroundColor: "rgba(185, 28, 28, 0.08)"
    textColor: "{colors.red}"
    rounded: "{rounded.notice}"
    padding: "14px 16px"
---

# Design System: Kiyas Desktop

## Overview

**Creative North Star: "The Gilded Ledger"**

Kiyas Desktop is a measurement instrument in the form of a book. Ruled parchment pages,
navy ink entries, gilt applied only at the edges that matter. The app's job is to record
a comparison and mark where reality deviated from intent, and the interface behaves like
the ledger that holds that record: calm, ordered, legible at a glance, and completely
uninterested in competing with the artifact under examination. When a report is on screen,
the report is the loudest thing on screen.

The character is **precise and instrumental**. This is the axis the system is being pulled
along: exact alignment, mono numerals for anything countable, tight and deliberate radii,
state changes that read as readings on a gauge rather than as decoration. The shipped
implementation is warmer and softer than that target — 14px card corners, 26–28px padding,
a 720px reading column — so treat the softness as the incumbent baseline and the
instrumental precision as the direction. Where the two conflict, precision wins; but never
introduce urgency, density, or noise in its name. An instrument is quiet because it is
confident.

Gilt is the entire accent vocabulary. There is no second accent color and there is no
decorative hue — red, amber, and green exist solely to carry discrepancy severity, and
green additionally to mark a dependency as connected. Everything else is ink on parchment.
The reason this holds up under a real workload is that the user is a design-minded
developer running the same comparison many times a day: they need to find the changed
number, not to be impressed.

Both themes are **first-class peers**. Light is navy ink on parchment; dark inverts the
material so cream ink sits on an ink-blue stock. Neither is the canonical one, and neither
gets designed second.

**Key Characteristics:**
- Navy ink on parchment, with gilt reserved for the single most important thing on screen
- One accent color; semantic red/amber/green carry meaning only, never emphasis
- Serif display for headings and numerals, humanist sans for UI, mono for anything measured
- Flat translucent surfaces — paper laid on paper — with hairline borders instead of shadows
- Uppercase letterspaced micro-labels as the organizing device for panels and sections
- The diamond: a 45°-rotated square, the system's only ornament
- Light and dark designed and verified together, not sequentially

## Colors

A warm, closed palette: one paper family, one ink family, one metal, and three semantic
signals — nothing else is admitted.

### Primary
- **Gilt** (`gold`): The only accent in the system, and a **fill colour only**. It marks
  the single most important target on screen and nothing else: the primary action's fill,
  the terminal's cursor and the drawer's top rule, transient hover edges. At 2.3–2.7:1 on
  paper it is far too light to carry text or a state boundary — see the Gilt-Is-Not-Ink
  Rule. Its scarcity is what makes it legible.
- **Gilt Ink** (`gold-ink`): Gilt dark enough to be a foreground (4.9–5.6:1 on every paper
  tone). Everything gilt-coloured that must actually be *read* or that carries state on its
  own: the `DESIGN` / `IMPLEMENTATION` capture labels, the setup hint, the active progress
  medallion's glyph, the current step's diamond, the focus ring, and the focused input's
  border. Reads as antique brass rather than bright gilding, which is the price of
  legibility and is not negotiable.
- **Gilt Light** (`gold-light`): The hover and pressed state of gilt fills, and the
  dark-theme value where full gilt would be too heavy against dark stock.
- **Gilt Wash** (`gold-muted`): The 15% tint used for gilt-adjacent surfaces — focus
  ring haloes, secondary-button hover, active step medallions, the working bar's track.
  Never used as a fill for a resting element.
- **Ink on Gilt** (`ink-on-gold`): The near-black used for text sitting on a gilt fill —
  darker than Navy Ink, because gilt needs more than the palette's own ink to clear 4.5:1.

### Neutral
- **Parchment** (`cream`): The page. The application background and the value of the
  Electron window's own `backgroundColor`, so the very first painted frame is already
  the right stock.
- **Parchment Panel** (`parchment`): One step deeper than the page. The sidebar's tinted
  panel — the system's only structural surface tone, separating navigation from work.
- **Parchment Light** (`cream-light`): One step lighter than the page. The terminal
  drawer's ground, and the ink color of text sitting on navy fills.
- **Parchment Deep** (`cream-dark`): The darkest paper step; in dark theme it carries the
  active tab.
- **Navy Ink** (`navy`): The ink. Headings, selected labels, mono numerals, primary text
  emphasis, and the fill of the small dark pill CTAs in the Connections panel.
- **Navy Ink Light** (`navy-light`): The hover state of navy fills.
- **Body Ink** (`text`): Running text. A softer, warmer ink than Navy — Navy is for
  emphasis, Body Ink is for reading.
- **Muted Ink** (`text-secondary`): Secondary and supporting text — hints, process names,
  timestamps, inactive rows, unreached progress steps. Set dark enough to clear 4.5:1 on
  the sidebar's Parchment Panel, which is the darkest surface it sits on.
- **Faint Ink** (`ink-faint`): 68% ink. Micro-labels, carets, dismissed affordances,
  completed steps, and the unfilled diamond's stroke. The quietest value the system
  permits — quiet is set by the 4.5:1 floor, not by taste.
- **Hairline** (`hairline`): 10% ink. Every border in the system. This is the system's
  substitute for elevation.
- **Card Stock** (`card-bg`): 55% white over parchment. The translucency that makes a card
  read as a second sheet laid on the page rather than a box drawn on it.

### Tertiary (semantic only)
- **Severity High** (`red`): High-severity discrepancy counts, error notices, and the
  destructive hover on remove affordances.
- **Severity Medium** (`amber`): Medium-severity counts, capture mismatch warnings, and
  setup hints.
- **Severity Low / Ready** (`green`): Low-severity counts, the `clean` verdict, the
  running-dev-server dot, and the `Connected` / `Installed` dependency tags.

### Named Rules

**The One Metal Rule.** Gilt is the only accent. If a screen needs a second thing to stand
out, the answer is hierarchy — type, space, or ink weight — never a second hue. Audit test:
count the gilt elements in a viewport; more than three and the accent has stopped meaning
anything.

**The Gilt-Is-Not-Ink Rule.** `gold` fills; `gold-ink` is read. Anything gilt-coloured that
is text, an icon glyph, a focus ring, or a persistent state boundary takes `gold-ink`.
Transient hover edges may use `gold`, because a companion background change carries the
same signal. Audit test: `color:` and `outline:` never resolve to `var(--gold)`.

**The Legibility Floor Rule.** Every text pairing clears 4.5:1, and every boundary that is
the only signal for a component or its state clears 3:1 — in **both** themes, measured
through the full translucent stack, not against the nominal page colour. A token may be
made quieter only until it reaches that floor. One documented exception: the gilt primary
button's fill sits at 2.5:1 against paper, which is accepted because its label carries
6.7:1 and no state depends on the fill boundary alone. Hairline borders are exempt as
decorative dividers.

**The Semantics-Only Rule.** Red, amber, and green are readings, never emphasis. A red
element must correspond to an actual high-severity finding or a genuine error; an amber one
to a real warning; a green one to a verified-ready state. Never reach for them to add
color, and never introduce a fourth semantic hue.

**The Two-Ink Rule.** Navy Ink emphasizes, Body Ink reads. A heading, a selected row, or a
numeral takes Navy; a sentence takes Body. Setting body copy in Navy makes the page shout;
setting a heading in Body makes it vanish.

## Typography

**Display Font:** Iowan Old Style (falling back through Palatino, Book Antiqua, Georgia to
generic serif)
**Body Font:** Avenir Next (falling back through Avenir, Seravek, `-apple-system`, Helvetica
Neue to generic sans-serif)
**Label/Mono Font:** `ui-monospace` / SF Mono / Menlo

**Character:** A bookish humanist serif carrying every heading and every counted number,
against a geometric-humanist sans doing all the interface work. The pairing is the whole
brand argument in two typefaces: the serif says *record*, the sans says *instrument*. Both
stacks are system-resident on macOS — the app ships no webfonts and must not start.

### Hierarchy
- **Display** (Iowan Old Style 600, 30px / 20px, tight): Counted results only — the
  discrepancy total in a verdict. A number set in the display serif is the system's way of
  saying "this is the finding."
- **Headline** (Iowan Old Style 600, 21–22px, letter-spacing 0.005em): Card and result
  titles — "New comparison", "Result", "Check the captures before comparing". One per card.
- **Title** (Iowan Old Style 600, 16px): Flat section headings outside cards — "How it
  works", "Recent comparisons".
- **Body** (Avenir Next 400–500, 13–14px, line-height 1.5–1.55): All running text,
  inputs (14px), list rows (13–13.5px), and buttons (13px). Constrained to a 720px column.
- **Label** (Avenir Next 600–700, 9.5–11px, letter-spacing 0.06–0.14em, uppercase): The
  organizing device. Panel headings ("PROJECTS", "DEV SERVERS", "CONNECTIONS"), capture
  labels ("DESIGN", "IMPLEMENTATION"), the terminal bar, and status tags. Letterspacing
  scales inversely with size — the smallest labels get the most.
- **Mono** (SF Mono 500–600, 11–12.5px): Anything measured or addressed — port numbers,
  target URLs, report timestamps, file paths, selectors. Never used for prose.

### Named Rules

**The Serif-Counts Rule.** If it's a heading or a number the user came here to read, it's
set in the display serif. If it's a control, a label, or a sentence, it's set in the sans.
There is no third case.

**The Measured-Mono Rule.** Monospace signals *this is a value the machine produced or
consumes* — a port, a URL, a path, a selector, a timestamp. Using it for atmosphere, code-
adjacent flavor, or emphasis breaks the signal.

**The Letterspaced-Label Rule.** Every panel and section is introduced by an uppercase
letterspaced micro-label in Faint Ink, never by a bordered header bar. Structure comes from
type, not from lines. Because these labels are the smallest type in the system, they are
also where the Legibility Floor binds hardest: at 10–10.5px they must clear 4.5:1 on
Parchment Panel, which is what sets Faint Ink's alpha. A quieter label is not available.

## Layout

A two-column shell inside a single desktop window: a fixed **264px** sidebar panel on
Parchment Panel with a hairline right border, and a fluid main column. The sidebar is
itself split — projects at the top, then `margin-top: auto` pushes dev servers, the
Connections panel, and the terminal toggle to the bottom, so navigation and environment
never intermix.

The main column is a centered reading measure: **720px max-width** with 40px side gutters
and a 72px bottom rest. The window's first 40px is a transparent drag region for the
hidden-inset macOS title bar, with the theme switch parked at its right. When a report is
displayed the column widens to **1060px** and becomes full-height flex, so the report
iframe takes every remaining pixel — the one place the system trades reading measure for
artifact size.

The terminal is a bottom drawer of fixed **300px** height that shortens the main column
rather than overlaying it, separated by a 2px gilt rule — the only place in the system where
gilt is used as a structural line.

**Spacing rhythm** is 4-based, with 12/14/16 for intra-component gaps, 26–28px for card
padding, and **28px between sections** as the constant vertical beat. Vertical rhythm is
carried by that 28px gap plus flat section padding, not by dividers.

**There are no breakpoints.** The window is resizable with a 1280×860 default and a
900×640 floor, and every layout must survive that whole range by flexing — not by
rearranging. Cards, rows, and the preview grid are flex-based with `min-width: 0` and
ellipsis truncation on every path, name, and process string. Truncation, not wrapping, is
the system's overflow answer for machine values.

### Named Rules

**The Ellipsis Rule.** Any string that comes from the user's filesystem or environment — a
repo path, a component selector, a process name — is single-line with `text-overflow:
ellipsis` and `min-width: 0` on its flex parent. Paths use `direction: rtl` so the filename
survives instead of the mount point. Machine values never wrap.

**The Artifact-First Rule.** When a report is on screen, the chrome collapses to a single
header row and the report gets the rest of the window. Nothing decorative may be added to
that state.

## Elevation & Depth

Depth is carried by **tonal layering and translucency**, not shadow. A card is 55% white
over parchment with a single hairline border — literally a lighter sheet laid on the page.
The sidebar is a deeper paper tone. Inputs and secondary buttons are 70–75% white. Nothing
is lifted; things are stacked.

Shadows do exist in the shipped code, but only in four places, and their vocabulary is
**provisional rather than doctrine** — recorded here descriptively so a future pass is free
to replace them with a real elevation scale or remove them entirely.

### Shadow Vocabulary (provisional)
- **Gilt lift** (`box-shadow: 0 2px 8px rgba(184, 150, 62, 0.35)`): The resting shadow on
  the gilt primary button, deepening to `0 3px 12px rgba(184, 150, 62, 0.45)` on hover.
  The only resting shadow in the system.
- **Tab seat** (`box-shadow: 0 1px 2px rgba(27, 27, 58, 0.12)`): Seats the active tab in
  its track. Dropped entirely in dark theme.
- **Working bloom** (`box-shadow: 0 6px 24px rgba(27, 27, 58, 0.08)`, dark
  `0 6px 24px rgba(0, 0, 0, 0.35)`): Lifts the progress card while a comparison is
  actually running, alongside a gilt-tinted border and a lighter fill.
- **Focus ring** (`box-shadow: 0 0 0 3px var(--gold-muted)` with a Gilt Ink border): The
  focus treatment for text inputs. Functionally a ring, not depth. Every other control uses
  `outline: 2px solid var(--gold-ink)` at a 2px offset — the same signal, drawn outside the
  box, so it reads on any surface.

## Shapes

Corners are consistently soft but the scale is **unruly and should be consolidated**: the
shipped code uses 1.5, 2, 6, 7, 8, 9, 10, 12, and 14px radii, plus full pills (999px) and
circles. The intent behind them is legible — smaller elements get tighter corners, cards
get the largest — but seven interior steps is more than the system needs. Treat
`{rounded.xs}` 6px (micro-buttons), `{rounded.sm}` 8px (rows, images, toggles),
`{rounded.md}` 9px (inputs, buttons, tab tracks), `{rounded.notice}` 10px (message boxes),
`{rounded.lg}` 12px (the report frame), and `{rounded.card}` 14px (cards) as the working
set, and prefer collapsing toward it over adding an eighth value.

Pills (999px) are for status: context chips, dependency tags, and the small dark CTAs.
Circles are for medallions: the 22px progress-step icon and the 7px running-server dot.

Borders are **always hairline** — 1px at 10% ink. One exception: the 2px gilt rule above
the terminal drawer, which reads as structure rather than as a boundary. Selection is
carried by surface and ink, never by a thickened edge.

**The diamond** is the system's only ornament: a 7px square rotated 45° with a 1.5px
stroke and a 1.5px radius, used as the bullet in the "How it works" list. It is unfilled
and Faint Ink when the step is unreached, solid Gilt Ink when current, solid Faint Ink when
done — a three-state marker that carries progress without a progress bar. Gilt Ink rather
than Gilt because at 7px the fill is the only signal distinguishing current from done.
It echoes the wordmark's gold diamond accent and is the one place ornament is permitted.

### Named Rules

**The Hairline Rule.** Every border is 1px at 10% ink. The only heavier line in the system
is the 2px gilt rule above the terminal drawer. If a boundary needs more presence than a
hairline, the answer is a tonal surface change, not a thicker line — and never a coloured
side border, which is the most recognisable tell of generated UI.

## Components

### Buttons
- **Shape:** Gently rounded (9px), with pill (999px) reserved for the small dark CTAs in
  the Connections panel.
- **Primary:** Gilt fill with Ink on Gilt (`ink-on-gold`) — not Navy, because gilt needs a
  darker ink than the palette's own to clear 4.5:1. 700 weight, 14px, generous 11×28px
  padding, and the gilt lift shadow. Exactly one per screen. Disabled keeps the gilt fill
  at 0.72 opacity with the shadow removed, so the shape of the action stays visible while
  unavailable and its label stays legible.
- **Hover:** Primary lightens to Gilt Light and its shadow deepens. Secondary swaps its
  hairline border to gilt and its fill to Gilt Wash — the accent arrives at the edge before
  it arrives in the fill. Hover may use `gold` because the fill change carries the signal
  too.
- **Focus:** every button takes `outline: 2px solid var(--gold-ink)` at a 2px offset. Never
  suppress it, and never let a hover-revealed control hide behind `visibility: hidden` —
  that removes it from the tab order. Use `opacity: 0` with a `:focus-visible` reveal.
- **Secondary:** 70% white over parchment (6% white in dark), hairline border, Navy ink,
  600 weight, 13px, 9×16px padding. This is the default button; the system has many
  secondaries and one primary.
- **Micro:** The `+` add-project and `↻` re-run buttons are 20px-square / 6px-radius
  hairline affordances in Faint Ink, revealed on row hover via `visibility`. The add
  button inverts to a gilt fill on hover.

### Chips
- **Context chips:** 5% ink fill, Muted Ink text, pill, 11px 600. They report ambient state
  — the selected repo and target URL — and never invite a click. A `.mono` variant carries
  URLs and drops to 500 weight.
- **Status tags:** `Connected` / `Installed` in green over a 10% green wash, pill, 9.5px
  700 uppercase with 0.06em tracking. The smallest type in the system, and the only place
  green appears outside severity.

### Cards / Containers
- **Corner Style:** 14px — the largest radius in the system.
- **Background:** Card Stock (55% white over parchment; 4% white in dark).
- **Shadow Strategy:** None at rest. See Elevation & Depth — the only card that gains a
  shadow is the progress card while work is actually running.
- **Border:** Hairline.
- **Internal Padding:** 26px top/bottom, 28px sides. Cards are separated by 28px.

### Inputs / Fields
- **Style:** 75% white over parchment (6% white in dark), hairline border, 9px radius,
  11×13px padding, 14px body type. Labels are 12px 600 Navy with an inline 400-weight
  Muted Ink hint on the same line — the hint rides the label rather than sitting below it.
- **Focus:** Border shifts to Gilt Ink with a 3px Gilt Wash ring. `outline: none` is set, so
  this ring *is* the focus indicator and must never be removed without a replacement.
- **Placeholder:** 90% Muted Ink — placeholders are text and take the full 4.5:1 floor.
- **Labels:** every input carries a programmatic label, via `htmlFor`/`id` when a visible
  label exists and `aria-label` when the surrounding control names it instead.

### Navigation
- **Style:** The sidebar list row — 8px radius, 13px body, no border at all. The row's click
  target is a real `<button class="row-select">` filling the row and carrying its 7×12px
  padding; the `<li>` is only the visual container. A row is never a bare `onClick` on the
  list item.
- **States:** Hover is a 5% ink wash. Selected is an 18% gilt wash, Navy ink, 600 weight,
  and `aria-current` — four signals, no edge. Selection matters here because it determines
  what every other surface operates on, but weight and surface carry it; a coloured side
  border would be the loudest and cheapest way to say it.
- **Structure:** Each group is introduced by an uppercase letterspaced micro-label with an
  optional trailing affordance, and shows a Muted Ink empty-state sentence naming the next
  action when the list is empty.

### The Working Bar
A 3px gilt-wash track with a 40% gradient sweep (`transparent → gilt → transparent`)
traveling across it on a 1.3s loop. Indeterminate by design — the AI comparison has no
knowable duration, and the system refuses to fake a percentage. It appears only while a
comparison is genuinely in flight, paired with the active step's medallion pulsing between
full and 35% opacity.

### The Step Ledger
The five-step progress list is the app's signature component. Each row is a 22px circular
medallion plus a plain-language sentence: 6% ink and Muted Ink when pending, Gilt Wash and
gilt with a 1.2s pulse when active, 12% green and green with a `✓` when done, 12% red and
red with a `✕` when failed. The active row grows from 13.5px to 14.5px and from 500 to 600
weight while the card is busy — the only place in the system where type size changes to
signal state. Step labels are full sentences in plain language ("Screenshotting the
rendered component"), never terse status codes.

### The Embedded Terminal
xterm.js with two hand-built 16-color palettes derived from this system rather than from a
stock terminal theme: Parchment Light / Parchment ground, Body Ink foreground, gilt cursor,
gilt-at-28% selection, and the palette's own red/amber/green for ANSI red/green/yellow.
Blue, magenta, and cyan are the only hues in the entire product outside this component, and
they exist solely because ANSI requires all sixteen slots. 12.5px mono. Do not import a
third-party terminal theme.

### Motion
All entrance motion is gated behind `@media (prefers-reduced-motion: no-preference)`. Main
column children rise 10px into place over 0.45s on `cubic-bezier(0.22, 1, 0.36, 1)`,
staggered 60ms apart for the first four. State transitions are fast and small: the caret
rotates 90° over 0.18s ease-out. Only two things loop, and both mean "work is happening":
the medallion pulse (1.2s) and the working bar sweep (1.3s). Because both run indefinitely,
both carry a `prefers-reduced-motion: reduce` opt-out — the pulse stops and the bar becomes
a static half-opacity track that still reads as "in progress".

## Do's and Don'ts

### Do:
- **Do** design and verify every component in **both themes at once**. They are peers.
  Dark is not a filter over light — it re-derives its surfaces from the wordmark's ink
  (`#101528` family), lifts gilt to `#c8a44e`, and drops the tab shadow entirely. Light is
  the theme that historically got under-verified; check it first.
- **Do** compute contrast through the whole translucent stack. A card is 55% white over
  Parchment and an input is 75% white over that, so a token's ratio against `--cream` tells
  you nothing about its ratio where it actually renders. See the Legibility Floor Rule.
- **Do** spend gilt on exactly one target per screen, and reach for type, space, or ink
  weight when something else needs to stand out.
- **Do** give every interactive row a real `<button>`, every icon-only control an
  `aria-label`, every toggle an `aria-pressed`, and every async phase an `aria-live` region.
  A control that only responds to a mouse is unfinished.
- **Do** pair every colour-coded state with a non-colour signal — a word, a glyph, or
  visually hidden text. Severity counts already say "high"/"medium"/"low"; progress rows
  carry their state as `sr-only` text beside the glyph.
- **Do** keep every hit target at 24×24 minimum. When the visual box must stay smaller,
  expand the target with a centred `::after` overlay rather than resizing the control.
- **Do** set headings and counted numbers in Iowan Old Style, controls and prose in Avenir
  Next, and machine values in mono. See the Serif-Counts and Measured-Mono rules.
- **Do** introduce every panel and section with an uppercase letterspaced micro-label in
  Faint Ink (10.5px, 0.14em) rather than a bordered header.
- **Do** give every empty list a Muted Ink sentence naming the next action, in the voice
  already shipped ("Add the repo that renders your UI…", "None running. Start one in your
  project, e.g. npm run dev.").
- **Do** keep borders at hairline (1px, 10% ink), and use a tonal surface change when a
  boundary needs more presence.
- **Do** put `min-width: 0` and ellipsis truncation on every filesystem or environment
  string, with `direction: rtl` on paths.
- **Do** gate entrance and looping motion behind `prefers-reduced-motion` — the entrance
  rise via `no-preference`, and both indefinite loops via a `reduce` opt-out.
- **Do** keep the window's `backgroundColor` in `src/main/index.ts` in mind — it is
  hardcoded to Parchment `#f6f0e6`, so a dark-theme launch flashes light. Fix it there, not
  in CSS, if it's addressed.

### Don't:
- **Don't** introduce a second accent color, a decorative hue, or a gradient fill. Gilt is
  the only metal; the working bar's sweep is the sole gradient in the system and it is a
  motion effect, not a surface.
- **Don't** use red, amber, or green for emphasis. They are severity and readiness
  readings. No fourth semantic hue.
- **Don't** add resting shadows. Surfaces are flat and translucent; the four existing
  shadows are provisional and shouldn't be extended into a general elevation habit.
- **Don't** add an eighth interior radius. Work within 6 / 8 / 9 / 10 / 12 / 14, and prefer
  consolidating toward it.
- **Don't** ship a webfont. Both stacks are system-resident on macOS by design.
- **Don't** remove an input's gilt focus ring — `outline: none` is set, so that ring is the
  only focus indicator. And don't ship a button without one.
- **Don't** set `color:` or `outline:` to `var(--gold)`. Gilt fills; `--gold-ink` is read.
- **Don't** mark selection, emphasis, or severity with a coloured side border on a row,
  card, callout, or alert. It is the most recognisable tell of generated UI, and this system
  has better tools: a tonal wash, Navy ink, and a weight step.
- **Don't** hide a hover-revealed control with `visibility: hidden` or `display: none` —
  both remove it from the tab order, which is how the remove and re-run affordances became
  keyboard-unreachable. Use `opacity` with a `:focus-visible` reveal.
- **Don't** make a token quieter than the Legibility Floor allows, in either theme. If the
  design wants a fainter label, the answer is less of it, not a lighter value.
- **Don't** show a determinate progress bar or a percentage for the AI comparison. Its
  duration is unknowable and the system does not fake it.
- **Don't** render the ledger metaphor literally: no paper texture, grain, torn edges,
  ruled lines, or drop-shadowed sheets. It is a reasoning tool, not a skin.
- **Don't** drift toward a glowing dark developer-tool aesthetic — neon accents, glow
  effects, saturated-on-black chrome. Dark theme is ink-blue stock, not a terminal.
- **Don't** drift toward the generic AI look: violet gradients, sparkle iconography,
  gradient text, "AI" chrome. Kiyas uses AI; it doesn't advertise it visually.
- **Don't** drift toward corporate blue SaaS: stock `#3B82F6`, uniform card grids, Inter
  everywhere.
- **Don't** add ornament beyond the diamond, and don't fill the diamond except to mark the
  current step.
- **Don't** let chrome compete with a displayed report. See the Artifact-First rule.
