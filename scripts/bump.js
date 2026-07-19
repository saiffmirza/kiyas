#!/usr/bin/env node
// Bumps the version everywhere it lives: package.json, package-lock.json,
// src/version.ts, and server.json (top-level + packages[0]).
// Usage: npm run bump -- <patch|minor|major|X.Y.Z>

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: npm run bump -- <patch|minor|major|X.Y.Z>");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const current = pkg.version;

let next;
if (/^\d+\.\d+\.\d+$/.test(arg)) {
  next = arg;
} else {
  const [major, minor, patch] = current.split(".").map(Number);
  if (arg === "major") next = `${major + 1}.0.0`;
  else if (arg === "minor") next = `${major}.${minor + 1}.0`;
  else if (arg === "patch") next = `${major}.${minor}.${patch + 1}`;
  else {
    console.error(`Unknown bump type "${arg}". Use patch, minor, major, or X.Y.Z.`);
    process.exit(1);
  }
}

pkg.version = next;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

const serverJson = JSON.parse(readFileSync("server.json", "utf-8"));
serverJson.version = next;
for (const p of serverJson.packages ?? []) {
  p.version = next;
}
writeFileSync("server.json", JSON.stringify(serverJson, null, 2) + "\n");

writeFileSync("src/version.ts", `export const VERSION = "${next}";\n`);

execSync("npm install --package-lock-only --ignore-scripts", { stdio: "inherit" });

console.log(`\n${current} -> ${next}\n`);
console.log("Next steps:");
console.log(`  git add package.json package-lock.json server.json src/version.ts`);
console.log(`  git commit -m "chore: bump version to ${next}"`);
console.log(`  git tag v${next} && git push origin main v${next}`);
console.log("The release workflow handles npm publish, MCP registry publish, and the GitHub release.");
