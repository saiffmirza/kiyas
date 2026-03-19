# kiyas Workflow Diagram

## High-Level Flow

```
 User runs:
 kiyas --figma <url> --component "eventHeader on redemption screen"
                          │
                          ▼
                ┌───────────────────┐
                │   AUTHENTICATE    │
                │                   │
                │  macOS Keychain   │
                │  ┌─────────────┐  │
                │  │ Claude Code │  │──── or ────┐
                │  │ credentials │  │            │
                │  └─────────────┘  │    ┌───────┴──────┐
                │                   │    │ Codex        │
                │                   │    │ credentials  │
                └────────┬──────────┘    └───────┬──────┘
                         │                       │
                         └───────────┬───────────┘
                                     │
                                     ▼
          ┌──────────────────────────────────────────────────┐
          │                                                  │
          ▼                                                  ▼
 ┌─────────────────────┐                       ┌─────────────────────┐
 │  FIGMA CAPTURE       │                       │  COMPONENT RESOLVE  │
 │                      │                       │                     │
 │  1. Parse Figma URL  │                       │  1. AI agent scans  │
 │     → fileKey        │                       │     project files   │
 │     → nodeId         │                       │                     │
 │                      │                       │  2. Identifies      │
 │  2. Figma REST API   │                       │     component file, │
 │     GET /v1/images/  │                       │     route, and      │
 │     Export as 2x PNG │                       │     CSS selector    │
 │                      │                       │                     │
 │  3. Fetch metadata   │                       │  3. Returns:        │
 │     GET /v1/files/   │                       │     {               │
 │     nodes?ids=       │                       │       url,          │
 │     (colors, fonts,  │                       │       selector,     │
 │      spacing)        │                       │       filePath,     │
 │                      │                       │       componentName │
 │  4. Save PNG to      │                       │     }               │
 │     temp directory   │                       │                     │
 └──────────┬───────────┘                       └──────────┬──────────┘
            │                                              │
            │                                              ▼
            │                                  ┌─────────────────────┐
            │                                  │  PLAYWRIGHT CAPTURE │
            │                                  │                     │
            │                                  │  1. Launch headless │
            │                                  │     Chromium        │
            │                                  │                     │
            │                                  │  2. Navigate to     │
            │                                  │     resolved URL    │
            │                                  │                     │
            │                                  │  3. Wait for        │
            │                                  │     network idle    │
            │                                  │                     │
            │                                  │  4. Screenshot      │
            │                                  │     element via     │
            │                                  │     CSS selector    │
            │                                  │                     │
            │                                  │  5. Save PNG to     │
            │                                  │     temp directory  │
            │                                  └──────────┬──────────┘
            │                                              │
            ▼                                              ▼
  ┌──────────────┐                              ┌──────────────┐
  │  Figma PNG   │                              │  Impl PNG    │
  │  (design)    │                              │  (actual)    │
  └──────┬───────┘                              └──────┬───────┘
         │                                             │
         └─────────────────┬───────────────────────────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │   VISION AI COMPARISON   │
              │                          │
              │  1. Encode both PNGs     │
              │     as base64            │
              │                          │
              │  2. Build structured     │
              │     prompt:              │
              │     "You are a senior    │
              │     UI engineer and      │
              │     design QA            │
              │     specialist..."       │
              │                          │
              │  3. Send to Claude or    │
              │     OpenAI Vision API    │
              │     with both images     │
              │                          │
              │  4. Parse JSON response: │
              │     [                    │
              │       {                  │
              │         element,         │
              │         property,        │
              │         expected,        │
              │         actual,          │
              │         severity         │
              │       },                 │
              │       ...                │
              │     ]                    │
              └────────────┬─────────────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │   MARKDOWN REPORT        │
              │                          │
              │  Group by severity:      │
              │                          │
              │  🔴 HIGH                 │
              │  ┌────────────────────┐  │
              │  │ border-radius:     │  │
              │  │ 12px → 8px         │  │
              │  └────────────────────┘  │
              │                          │
              │  🟡 MEDIUM               │
              │  ┌────────────────────┐  │
              │  │ font-weight:       │  │
              │  │ 600 → 400          │  │
              │  │ padding:           │  │
              │  │ 12px 24px → 8px 16 │  │
              │  └────────────────────┘  │
              │                          │
              │  🟢 LOW                  │
              │  ┌────────────────────┐  │
              │  │ box-shadow:        │  │
              │  │ shadow → none      │  │
              │  └────────────────────┘  │
              │                          │
              │  → Terminal output       │
              │  → Optional file export  │
              └──────────────────────────┘
```

## Sequence Diagram

```
User          CLI           Auth          Figma API       AI Agent       Playwright      Vision AI
 │              │              │              │               │              │              │
 │──run kiyas──►│              │              │               │              │              │
 │              │──resolve────►│              │               │              │              │
 │              │  auth        │              │               │              │              │
 │              │◄─token───────│              │               │              │              │
 │              │              │              │               │              │              │
 │              │──export frame───────────────►               │              │              │
 │              │◄─design PNG─────────────────│               │              │              │
 │              │              │              │               │              │              │
 │              │──"find eventHeader"─────────────────────────►              │              │
 │              │◄─{ url, selector, filePath }────────────────│              │              │
 │              │              │              │               │              │              │
 │              │──screenshot URL + selector──────────────────────────────►  │              │
 │              │◄─impl PNG───────────────────────────────────────────────│  │              │
 │              │              │              │               │              │              │
 │              │──design PNG + impl PNG + prompt──────────────────────────────────────────►│
 │              │◄─JSON discrepancies──────────────────────────────────────────────────────│
 │              │              │              │               │              │              │
 │◄─report──────│              │              │               │              │              │
 │              │              │              │               │              │              │
```

## Direct URL Mode (--target)

When using `--target` instead of `--component`, the AI agent step is skipped:

```
User          CLI           Auth          Figma API       Playwright      Vision AI
 │              │              │              │              │              │
 │──run kiyas──►│              │              │              │              │
 │              │──resolve────►│              │              │              │
 │              │◄─token───────│              │              │              │
 │              │              │              │              │              │
 │              │──export frame───────────────►              │              │
 │              │◄─design PNG─────────────────│              │              │
 │              │              │              │              │              │
 │              │──screenshot target URL──────────────────►  │              │
 │              │◄─impl PNG───────────────────────────────│  │              │
 │              │              │              │              │              │
 │              │──design PNG + impl PNG + prompt──────────────────────────►│
 │              │◄─JSON discrepancies──────────────────────────────────────│
 │              │              │              │              │              │
 │◄─report──────│              │              │              │              │
 │              │              │              │              │              │
```
