export { resolveAuth, type AuthResult } from "./auth/index.js";
export { resolveClaudeAuth } from "./auth/claude-oauth.js";
export { resolveOpenAIAuth } from "./auth/openai-auth.js";
export {
  loadConfigFile,
  resolveFigmaToken,
  requireFigmaToken,
  ensureFigmaToken,
  type ComparisonConfig,
  type KiyasConfig,
} from "./config.js";
export {
  loadSettings,
  saveSetting,
  getSetting,
  getAllSettings,
  type KiyasSettings,
} from "./settings.js";
export { resolveComponent, type ResolvedComponent } from "./resolve/component.js";
export {
  runComparison,
  loadReport,
  defaultReportsDir,
  captureMismatchWarning,
  type ProgressEvent,
  type RunComparisonParams,
  type ComparisonSummary,
  type RunManifest,
  type ComparisonResult,
  type PersistedReport,
  type LoadedReport,
} from "./compare/pipeline.js";
export {
  compareImages,
  parseDiscrepancies,
  type Discrepancy,
  type CompareOptions,
} from "./compare/index.js";
export {
  sameFinding,
  normalizeProperty,
  propertyFamilies,
  elementTokens,
  tokenOverlap,
} from "./compare/finding-key.js";
export { captureFigma, type FigmaCapture, type FigmaNodeMetadata } from "./capture/figma.js";
export {
  capturePlaywright,
  capturePlaywrightDetailed,
  type PlaywrightCaptureOptions,
  type PlaywrightCaptureResult,
} from "./capture/playwright.js";
export {
  captureImplementation,
  type CaptureImplementationParams,
  type CaptureImplementationResult,
} from "./capture/implementation.js";
export {
  loadPng,
  savePng,
  cropImage,
  resizeImage,
  grayThumb,
  meanLuma,
  type RawImage,
} from "./capture/image.js";
export {
  selectBestCrop,
  anchoredCrop,
  visualDistance,
  type ElementBox,
} from "./capture/autocrop.js";
export { defaultCaptureScale } from "./capture/scale.js";
export { normalizeToSrgb } from "./capture/srgb.js";
export { readPngSize, type PngSize } from "./utils/png-size.js";
export { generateHtmlReport, type HtmlReportOptions } from "./report/html.js";
export { parseFigmaUrl, type FigmaUrlParts } from "./utils/parse-figma-url.js";
export { log } from "./utils/logger.js";
export { ask } from "./utils/prompt.js";
export { detectDevServer } from "./utils/dev-server.js";
export { checkForUpdate } from "./utils/update-check.js";
export { VERSION } from "./version.js";
