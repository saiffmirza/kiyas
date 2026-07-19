import type { ComparisonSummary, Discrepancy, ProgressEvent } from "@kiyas/core";

export interface DoctorCheck {
  ok: boolean;
}

export interface DoctorReport {
  claude: DoctorCheck;
  codex: DoctorCheck;
  figmaToken: DoctorCheck;
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
      designSize: ImageSize;
      implSize: ImageSize;
    }
  | { ok: false; error: string };

export type CropResponse =
  | { ok: true; implPng: string; implSize: ImageSize; warning?: string }
  | { ok: false; error: string };

export interface RepoState {
  repos: string[];
  selectedRepo?: string;
}

export interface OpenPort {
  port: number;
  process: string;
}

export interface KiyasApi {
  doctor: () => Promise<DoctorReport>;
  reposLoad: () => Promise<RepoState>;
  reposAdd: () => Promise<RepoState>;
  reposRemove: (path: string) => Promise<RepoState>;
  reposSelect: (path: string) => Promise<RepoState>;
  portsList: () => Promise<OpenPort[]>;
  openTerminal: (cwd?: string) => Promise<void>;
  /** Opens Terminal running the provider's install + sign-in flow. */
  setupProvider: (
    provider: "claude" | "codex"
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Validates the token against the Figma API, then persists it to ~/.kiyasrc. */
  saveFigmaToken: (token: string) => Promise<{ ok: boolean; error?: string }>;
  openFigmaSettings: () => Promise<void>;
  pickRepo: () => Promise<string | undefined>;
  pickImage: () => Promise<string | undefined>;
  capture: (params: CompareRequest) => Promise<CaptureResponse>;
  cropImpl: () => Promise<CropResponse>;
  compareConfirmed: () => Promise<CompareResponse>;
  onProgress: (cb: (event: DesktopProgressEvent) => void) => () => void;
  openReport: (reportPath: string) => Promise<void>;
}
