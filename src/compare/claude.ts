import { readFile } from "node:fs/promises";
import type { Discrepancy } from "./index.js";

export async function compareWithClaude(
  designPath: string,
  implPath: string,
  prompt: string,
  token: string
): Promise<Discrepancy[]> {
  const [designBuf, implBuf] = await Promise.all([
    readFile(designPath),
    readFile(implPath),
  ]);

  const designBase64 = designBuf.toString("base64");
  const implBase64 = implBuf.toString("base64");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": token,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: designBase64,
              },
            },
            {
              type: "text",
              text: "This is the Figma design (expected state).",
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: implBase64,
              },
            },
            {
              type: "text",
              text: "This is the implementation screenshot (actual state).",
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API error (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content.find((b) => b.type === "text");
  if (!textBlock?.text) {
    throw new Error("Claude returned no text response");
  }

  return JSON.parse(textBlock.text) as Discrepancy[];
}
