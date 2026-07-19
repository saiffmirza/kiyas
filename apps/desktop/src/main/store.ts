import { app } from "electron";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface AppState {
  repos: string[];
  selectedRepo?: string;
}

function statePath(): string {
  return join(app.getPath("userData"), "kiyas-state.json");
}

export function loadState(): AppState {
  try {
    if (existsSync(statePath())) {
      const parsed = JSON.parse(readFileSync(statePath(), "utf-8"));
      return { repos: [], ...parsed };
    }
  } catch {
    // corrupted state starts fresh
  }
  return { repos: [] };
}

export function saveState(state: AppState): void {
  writeFileSync(statePath(), JSON.stringify(state, null, 2) + "\n", "utf-8");
}
