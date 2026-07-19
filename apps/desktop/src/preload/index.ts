import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  CompareRequest,
  DesktopProgressEvent,
  KiyasApi,
} from "../shared/types.js";

const api: KiyasApi = {
  doctor: () => ipcRenderer.invoke("doctor"),
  reportsList: (repo: string) => ipcRenderer.invoke("reports-list", repo),
  reportsOpen: (repo: string, reportId: string) =>
    ipcRenderer.invoke("reports-open", repo, reportId),
  reposLoad: () => ipcRenderer.invoke("repos-load"),
  reposAdd: () => ipcRenderer.invoke("repos-add"),
  reposRemove: (path: string) => ipcRenderer.invoke("repos-remove", path),
  reposSelect: (path: string) => ipcRenderer.invoke("repos-select", path),
  portsList: () => ipcRenderer.invoke("ports-list"),
  termStart: (cwd?: string) => ipcRenderer.invoke("term-start", cwd),
  termInput: (data: string) => ipcRenderer.send("term-input", data),
  termResize: (cols: number, rows: number) =>
    ipcRenderer.send("term-resize", cols, rows),
  termStop: () => ipcRenderer.invoke("term-stop"),
  onTermData: (cb: (data: string) => void) => {
    const listener = (_event: IpcRendererEvent, data: string) => cb(data);
    ipcRenderer.on("term-data", listener);
    return () => ipcRenderer.removeListener("term-data", listener);
  },
  onTermExit: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on("term-exit", listener);
    return () => ipcRenderer.removeListener("term-exit", listener);
  },
  setupProvider: (provider: "claude" | "codex" | "browsers") =>
    ipcRenderer.invoke("setup-provider", provider),
  saveFigmaToken: (token: string) =>
    ipcRenderer.invoke("save-figma-token", token),
  openFigmaSettings: () => ipcRenderer.invoke("open-figma-settings"),
  pickRepo: () => ipcRenderer.invoke("pick-repo"),
  pickImage: () => ipcRenderer.invoke("pick-image"),
  capture: (params: CompareRequest) => ipcRenderer.invoke("capture", params),
  discardCapture: () => ipcRenderer.invoke("capture-discard"),
  cropImpl: () => ipcRenderer.invoke("crop-impl"),
  compareConfirmed: () => ipcRenderer.invoke("compare-confirmed"),
  openReport: (reportPath: string) =>
    ipcRenderer.invoke("open-report", reportPath),
  updateCheck: () => ipcRenderer.invoke("update-check"),
  openUpdate: () => ipcRenderer.invoke("update-open"),
  onProgress: (cb: (event: DesktopProgressEvent) => void) => {
    const listener = (_event: IpcRendererEvent, ev: DesktopProgressEvent) =>
      cb(ev);
    ipcRenderer.on("compare-progress", listener);
    return () => ipcRenderer.removeListener("compare-progress", listener);
  },
};

contextBridge.exposeInMainWorld("kiyas", api);
