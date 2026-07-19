import { app, BrowserWindow } from "electron";
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import icon from "../../resources/icon.png?asset";
import { registerIpc } from "./ipc.js";

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

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  const screenshotPath = process.env.KIYAS_SCREENSHOT;
  if (screenshotPath) {
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

app.whenReady().then(() => {
  if (process.platform === "darwin") app.dock.setIcon(icon);
  const win = createWindow();
  registerIpc(win);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
