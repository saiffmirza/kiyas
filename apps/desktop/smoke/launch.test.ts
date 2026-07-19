import { test, before, after } from "node:test";
import assert from "node:assert";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron, type ElectronApplication, type Page } from "playwright";

// Packaged-app smoke: drives the electron-builder output (npx electron-builder
// --mac dir) the way Finder launches it — launchd's minimal PATH and a fresh
// HOME — to catch the failure modes dev mode can't: login-shell PATH
// resolution, the missing-Chromium Doctor check, and window reopen after close.

const DESKTOP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LAUNCHD_PATH = "/usr/bin:/bin:/usr/sbin:/sbin";

function findAppBinary(): string {
  const candidates = ["mac-arm64", "mac", "mac-universal"].map((dir) =>
    join(DESKTOP_DIR, "dist", dir, "Kiyas.app", "Contents", "MacOS", "Kiyas")
  );
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `Packaged app not found (looked in ${candidates.join(", ")}). ` +
        "Run `npx electron-builder --mac dir` in apps/desktop first."
    );
  }
  return found;
}

let home: string;
let app: ElectronApplication;
let page: Page;

before(async () => {
  // Fresh HOME: no ms-playwright cache, no ~/.kiyasrc, no saved app state.
  home = await mkdtemp(join(tmpdir(), "kiyas-desktop-smoke-"));

  // A fake `claude` reachable only through the login-shell PATH — exactly how
  // real installs (Homebrew, npm -g) are invisible to Finder-launched apps.
  const binDir = join(home, "bin");
  await mkdir(binDir);
  await writeFile(
    join(binDir, "claude"),
    '#!/bin/sh\necho "9.9.9 (Claude Code smoke shim)"\n'
  );
  await chmod(join(binDir, "claude"), 0o755);
  await writeFile(join(home, ".zprofile"), `export PATH="${binDir}:$PATH"\n`);
  // An existing (empty) rc file keeps zsh from ever going interactive-firstrun.
  await writeFile(join(home, ".zshrc"), "");

  app = await _electron.launch({
    executablePath: findAppBinary(),
    env: {
      PATH: LAUNCHD_PATH,
      HOME: home,
      SHELL: "/bin/zsh",
      USER: process.env.USER ?? "ci",
      TMPDIR: process.env.TMPDIR ?? "/tmp",
    },
  });
  page = await app.firstWindow();
});

after(async () => {
  await app?.close();
  await rm(home, { recursive: true, force: true });
});

test("finds CLIs through the login-shell PATH despite a launchd environment", async () => {
  const claudeRow = page.locator(".env-list li", { hasText: "Claude Code" });
  await claudeRow.locator(".env-tag").waitFor({ timeout: 30_000 });
  assert.strictEqual(
    await claudeRow.locator(".env-tag").textContent(),
    "Connected"
  );
});

test("missing Playwright browsers surface as a Doctor install CTA", async () => {
  const browsersRow = page.locator(".env-list li", {
    hasText: "Screenshot browser",
  });
  await browsersRow.locator(".env-cta").waitFor({ timeout: 15_000 });
  assert.strictEqual(
    await browsersRow.locator(".env-cta").textContent(),
    "Install"
  );
});

test("window reopen after close keeps IPC and the terminal alive", async () => {
  await page.close();
  await app.evaluate(async ({ BrowserWindow }) => {
    const start = Date.now();
    while (BrowserWindow.getAllWindows().length > 0 && Date.now() - start < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });

  const reopened = app.waitForEvent("window");
  await app.evaluate(({ app: electronApp }) => {
    electronApp.emit("activate");
  });
  page = await reopened;

  // Doctor list rendering proves renderer + invoke-style IPC in the new window.
  await page
    .locator(".env-list li", { hasText: "Claude Code" })
    .locator(".env-tag")
    .waitFor({ timeout: 30_000 });

  // The terminal exercises the push direction: pty output is streamed to the
  // window via webContents.send — the path that broke with a stale reference.
  await page.locator(".terminal-btn").click();
  await page.locator(".xterm").waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    () => {
      const rows = document.querySelector(".xterm-rows");
      return Boolean(rows?.textContent && rows.textContent.trim().length > 0);
    },
    undefined,
    { timeout: 15_000 }
  );
});
