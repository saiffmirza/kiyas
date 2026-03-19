import { readFile } from "node:fs/promises";
import type { Discrepancy } from "./index.js";

export async function compareWithOpenAI(
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

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${designBase64}`,
              },
            },
            {
              type: "text",
              text: "This is the Figma design (expected state).",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${implBase64}`,
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
    throw new Error(`OpenAI API error (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned no response");
  }

  return JSON.parse(content) as Discrepancy[];
}
