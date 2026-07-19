import { app, shell, BrowserWindow } from "electron";
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import packagedIcon from "../../resources/icon.png?asset";
import devIcon from "../../resources/icon-dev.png?asset";
import { registerIpc } from "./ipc.js";
import { registerTerminal } from "./terminal.js";
import { fixPath } from "./shell-env.js";

const icon = app.isPackaged ? packagedIcon : devIcon;

const __dirname = dirname(fileURLToPath(import.meta.url));

app.setName("Kiyas");

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: "Kiyas",
    icon,
    backgroundColor: "#f6f0e6",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      sandbox: false,
    },
  });

  // External links (e.g. from the report iframe) open in the default browser,
  // never in a child window that would inherit the preload bridge.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    const appUrl = process.env.ELECTRON_RENDERER_URL;
    const allowed =
      url.startsWith("file:") || (appUrl ? url.startsWith(appUrl) : false);
    if (!allowed) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  const screenshotPath = process.env.KIYAS_SCREENSHOT;
  if (screenshotPath && !app.isPackaged) {
    win.webContents.on("did-finish-load", () => {
      setTimeout(async () => {
        const image = await win.webContents.capturePage();
        await writeFile(screenshotPath, image.toPNG());
        app.quit();
      }, 2500);
    });
  }

  return win;
}

app.whenReady().then(async () => {
  await fixPath();
  // Packaged builds get the dock icon from the bundle's compiled assets
  // (Assets.car / icns); a runtime-set bitmap would downgrade it to the
  // legacy rendering. Dev mode sets the badged DEV tile explicitly.
  if (process.platform === "darwin" && !app.isPackaged) {
    app.dock.setIcon(icon);
  }
  let win = createWindow();
  const getWin = () => win;
  registerIpc(getWin);
  registerTerminal(getWin);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) win = createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
