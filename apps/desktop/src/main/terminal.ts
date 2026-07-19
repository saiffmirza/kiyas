import { ipcMain, type BrowserWindow } from "electron";
import { homedir } from "node:os";
import pty from "node-pty";

let proc: pty.IPty | undefined;

function ptyEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  return env;
}

export function registerTerminal(getWin: () => BrowserWindow): void {
  const stop = () => {
    proc?.kill();
    proc = undefined;
  };

  ipcMain.handle("term-start", (_event, cwd?: string) => {
    proc?.kill();
    const shell = process.env.SHELL || "/bin/zsh";
    proc = pty.spawn(shell, ["-l"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: cwd || homedir(),
      env: ptyEnv(),
    });
    proc.onData((data) => {
      const win = getWin();
      if (win.isDestroyed()) {
        stop();
        return;
      }
      win.webContents.send("term-data", data);
    });
    proc.onExit(() => {
      const win = getWin();
      if (!win.isDestroyed()) win.webContents.send("term-exit");
    });
    getWin().once("closed", stop);
  });

  ipcMain.on("term-input", (_event, data: string) => proc?.write(data));

  ipcMain.on("term-resize", (_event, cols: number, rows: number) => {
    if (cols > 0 && rows > 0) proc?.resize(cols, rows);
  });

  ipcMain.handle("term-stop", stop);
}
