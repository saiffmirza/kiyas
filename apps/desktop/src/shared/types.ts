import type { ComparisonSummary, Discrepancy, ProgressEvent } from "@kiyas/core";

export interface DoctorCheck {
  ok: boolean;
}

export interface DoctorReport {
  claude: DoctorCheck;
  codex: DoctorCheck;
  figmaToken: DoctorCheck;
  /** Playwright's Chromium — present for npm installs, missing for DMG-only users. */
  browsers: DoctorCheck;
}

export interface CompareRequest {
  repo: string;
  figmaUrl?: string;
  designImage?: string;
  targetUrl: string;
  component?: string;
  selector?: string;
  viewport: string;
  threshold: "all" | "medium" | "high";
}

export interface ImageSize {
  width: number;
  height: number;
}

export type DesktopProgressEvent =
  | ProgressEvent
  | { step: "resolve"; status: "start" | "done" | "fail"; message?: string };

export type CompareResponse =
  | {
      ok: true;
      summary: ComparisonSummary;
      discrepancies: Discrepancy[];
      reportPath: string;
      reportHtml: string;
      modelLabel: string;
    }
  | { ok: false; error: string };

export type CaptureResponse =
  | {
      ok: true;
      /** data: URLs for preview rendering */
      designPng: string;
      implPng: string;
      targetUrl: string;
      selector?: string;
      resolved?: { filePath: string; url: string; selector?: string };
      warning?: string;
      /** Absent when the design isn't a PNG (e.g. a JPEG on non-macOS). */
      designSize?: ImageSize;
      implSize: ImageSize;
    }
  | { ok: false; error: string };

export type CropResponse =
  | { ok: true; implPng: string; implSize: ImageSize; warning?: string }
  | { ok: false; error: string };

export interface DesktopUpdateInfo {
  version: string;
  current: string;
  url: string;
}

export interface RepoState {
  repos: string[];
  selectedRepo?: string;
}

export interface OpenPort {
  port: number;
  process: string;
}

export interface ReportListItem {
  reportId: string;
  name?: string;
  date: string;
  summary: ComparisonSummary;
  /** Saved inputs to run the same comparison again; absent when the report predates them. */
  rerun?: Omit<CompareRequest, "repo">;
}

export interface KiyasApi {
  doctor: () => Promise<DoctorReport>;
  reportsList: (repo: string) => Promise<ReportListItem[]>;
  reportsOpen: (repo: string, reportId: string) => Promise<CompareResponse>;
  reposLoad: () => Promise<RepoState>;
  reposAdd: () => Promise<RepoState>;
  reposRemove: (path: string) => Promise<RepoState>;
  reposSelect: (path: string) => Promise<RepoState>;
  portsList: () => Promise<OpenPort[]>;
  /** In-app terminal (node-pty in the main process, xterm.js in the renderer). */
  termStart: (cwd?: string) => Promise<void>;
  termInput: (data: string) => void;
  termResize: (cols: number, rows: number) => void;
  termStop: () => Promise<void>;
  onTermData: (cb: (data: string) => void) => () => void;
  onTermExit: (cb: () => void) => () => void;
  /** Opens Terminal running the install + sign-in flow for a provider or the screenshot browser. */
  setupProvider: (
    provider: "claude" | "codex" | "browsers"
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Validates the token against the Figma API, then persists it to ~/.kiyasrc. */
  saveFigmaToken: (token: string) => Promise<{ ok: boolean; error?: string }>;
  openFigmaSettings: () => Promise<void>;
  pickRepo: () => Promise<string | undefined>;
  pickImage: () => Promise<string | undefined>;
  capture: (params: CompareRequest) => Promise<CaptureResponse>;
  /** Deletes the pending capture's temp files (call when abandoning a preview). */
  discardCapture: () => Promise<void>;
  cropImpl: () => Promise<CropResponse>;
  compareConfirmed: () => Promise<CompareResponse>;
  onProgress: (cb: (event: DesktopProgressEvent) => void) => () => void;
  openReport: (reportPath: string) => Promise<void>;
  /** Newer desktop release on GitHub, or null when current/offline. */
  updateCheck: () => Promise<DesktopUpdateInfo | null>;
  /** Opens the release page found by the last updateCheck. */
  openUpdate: () => Promise<void>;
}
