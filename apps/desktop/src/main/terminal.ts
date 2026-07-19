import { ipcMain, type BrowserWindow } from "electron";
import { homedir } from "node:os";
import pty from "node-pty";

let proc: pty.IPty | undefined;

export function registerTerminal(win: BrowserWindow): void {
  ipcMain.handle("term-start", (_event, cwd?: string) => {
    proc?.kill();
    const shell = process.env.SHELL || "/bin/zsh";
    proc = pty.spawn(shell, ["-l"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: cwd || homedir(),
      env: process.env as Record<string, string>,
    });
    proc.onData((data) => win.webContents.send("term-data", data));
    proc.onExit(() => win.webContents.send("term-exit"));
  });

  ipcMain.on("term-input", (_event, data: string) => proc?.write(data));

  ipcMain.on("term-resize", (_event, cols: number, rows: number) => {
    if (cols > 0 && rows > 0) proc?.resize(cols, rows);
  });

  ipcMain.handle("term-stop", () => {
    proc?.kill();
    proc = undefined;
  });
}
