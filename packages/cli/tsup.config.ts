import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  splitting: false,
  noExternal: ["@kiyas/core"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
