// electron-builder afterPack hook: ad-hoc sign the app bundle.
//
// Without a Developer ID certificate, electron-builder skips signing
// entirely, which leaves a broken seal (per-file linker signatures only).
// Quarantined + broken seal = Gatekeeper's "Kiyas is damaged" dialog, which
// has NO Open Anyway escape hatch. A valid ad-hoc signature downgrades that
// to "Apple could not verify…", which users can bypass once via
// System Settings → Privacy & Security → Open Anyway.
//
// Runs before the dmg/zip targets are built, so the artifacts contain the
// signed bundle. If a real certificate is ever configured (CSC_LINK),
// electron-builder signs after this hook and overwrites the ad-hoc seal.
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

module.exports = async function adhocSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit",
  });
  execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
    stdio: "inherit",
  });
  console.log(`  • ad-hoc signed ${appPath}`);
};
