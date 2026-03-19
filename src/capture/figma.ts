import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseFigmaUrl } from "../utils/parse-figma-url.js";
import { log } from "../utils/logger.js";

const FIGMA_API_BASE = "https://api.figma.com";

export interface FigmaCapture {
  imagePath: string;
  metadata?: FigmaNodeMetadata;
}

export interface FigmaNodeMetadata {
  name: string;
  type: string;
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fills?: unknown[];
  strokes?: unknown[];
  effects?: unknown[];
  cornerRadius?: number;
  style?: Record<string, unknown>;
}

export async function captureFigma(
  figmaUrl: string,
  figmaToken: string
): Promise<FigmaCapture> {
  const { fileKey, nodeId } = parseFigmaUrl(figmaUrl);

  // Export the node as PNG
  const imageUrl = await exportFigmaImage(fileKey, nodeId, figmaToken);
  const imagePath = join(tmpdir(), `kiyas-figma-${Date.now()}.png`);
  await downloadImage(imageUrl, imagePath);

  // Fetch metadata for enriching the AI prompt
  let metadata: FigmaNodeMetadata | undefined;
  try {
    metadata = await fetchNodeMetadata(fileKey, nodeId, figmaToken);
  } catch (err) {
    log.warn("Could not fetch Figma node metadata (non-critical)");
  }

  return { imagePath, metadata };
}

async function exportFigmaImage(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<string> {
  const url = `${FIGMA_API_BASE}/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=2`;

  const res = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API error (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    images: Record<string, string | null>;
  };

  const imageUrl = Object.values(data.images)[0];
  if (!imageUrl) {
    throw new Error(
      "Figma returned no image for this node. Check that the node-id is correct."
    );
  }

  return imageUrl;
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download Figma image: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buffer);
}

async function fetchNodeMetadata(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<FigmaNodeMetadata | undefined> {
  const url = `${FIGMA_API_BASE}/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`;

  const res = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });

  if (!res.ok) return undefined;

  const data = (await res.json()) as {
    nodes: Record<string, { document: FigmaNodeMetadata }>;
  };

  const node = Object.values(data.nodes)[0];
  return node?.document;
}
