export interface FigmaUrlParts {
  fileKey: string;
  nodeId: string;
}

export function parseFigmaUrl(url: string): FigmaUrlParts {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid Figma URL: ${url}`);
  }

  if (!parsed.hostname.includes("figma.com")) {
    throw new Error(`Not a Figma URL: ${url}`);
  }

  const pathParts = parsed.pathname.split("/").filter(Boolean);
  // Formats:
  //   /design/:fileKey/:fileName
  //   /file/:fileKey/:fileName
  //   /design/:fileKey/branch/:branchKey/:fileName
  //   /board/:fileKey/:fileName

  let fileKey: string | undefined;

  if (pathParts.length >= 2) {
    const type = pathParts[0]; // "design", "file", "board"
    if (type === "design" || type === "file" || type === "board") {
      if (pathParts[2] === "branch" && pathParts[3]) {
        // Branch URL — use branchKey as fileKey
        fileKey = pathParts[3];
      } else {
        fileKey = pathParts[1];
      }
    }
  }

  if (!fileKey) {
    throw new Error(`Could not extract file key from Figma URL: ${url}`);
  }

  const nodeIdParam = parsed.searchParams.get("node-id");
  if (!nodeIdParam) {
    throw new Error(
      `Figma URL is missing node-id parameter. Please link to a specific frame or component.`
    );
  }

  // Figma URLs use "-" as separator but API uses ":"
  const nodeId = nodeIdParam.replace(/-/g, ":");

  return { fileKey, nodeId };
}
