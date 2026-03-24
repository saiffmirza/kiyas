import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

const SETTINGS_DIR = resolve(homedir(), ".kiyas");
const SETTINGS_FILE = resolve(SETTINGS_DIR, "settings.json");

export interface KiyasSettings {
  model?: "claude" | "openai";
  devServer?: string;
  viewport?: string;
  threshold?: "all" | "medium" | "high";
  format?: "html" | "json";
}

const VALID_KEYS: Record<string, string[]> = {
  model: ["claude", "openai"],
  threshold: ["all", "medium", "high"],
  format: ["html", "json"],
};

export function loadSettings(): KiyasSettings {
  if (!existsSync(SETTINGS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

export function saveSetting(key: string, value: string): void {
  if (!existsSync(SETTINGS_DIR)) {
    mkdirSync(SETTINGS_DIR, { recursive: true });
  }

  const settings = loadSettings();

  if (VALID_KEYS[key] && !VALID_KEYS[key].includes(value)) {
    throw new Error(
      `Invalid value "${value}" for ${key}. Must be one of: ${VALID_KEYS[key].join(", ")}`
    );
  }

  (settings as Record<string, string>)[key] = value;
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");
}

export function getSetting(key: string): string | undefined {
  const settings = loadSettings();
  return (settings as Record<string, string | undefined>)[key];
}

export function getAllSettings(): KiyasSettings {
  return loadSettings();
}
