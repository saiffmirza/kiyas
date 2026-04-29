import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  compareInputSchema,
  getDiffReportInputSchema,
  handleCompare,
  handleGetDiffReport,
  handleListIssues,
  listIssuesInputSchema,
} from "./tools.js";

const TOOLS = [
  {
    name: "compare",
    description:
      "Compare a Figma frame against a rendered implementation and return discrepancies. " +
      "Provide `figma` plus either `target` (a URL) or `component` (natural-language description; " +
      "kiyas finds it in the codebase). Returns a reportId you can pass to get_diff_report or list_issues.",
    inputSchema: z.toJSONSchema(compareInputSchema),
  },
  {
    name: "get_diff_report",
    description:
      "Fetch a stored kiyas report by reportId. Defaults to JSON; pass format=html to fetch the rendered report. " +
      "Returns the artifact path and (by default for JSON) inline content.",
    inputSchema: z.toJSONSchema(getDiffReportInputSchema),
  },
  {
    name: "list_issues",
    description:
      "List discrepancies from a stored kiyas report by reportId, optionally filtered by severity " +
      "(all | high | medium | low).",
    inputSchema: z.toJSONSchema(listIssuesInputSchema),
  },
];

export async function startMcpServer(): Promise<void> {
  // MCP stdio transport reserves stdout for JSON-RPC frames. The SDK writes
  // protocol messages via process.stdout.write directly, but stray
  // console.log/info/warn calls from auth, capture, etc. would corrupt the
  // stream — reroute them to stderr.
  console.log = (...args: unknown[]) => console.error(...args);
  console.info = (...args: unknown[]) => console.error(...args);
  console.warn = (...args: unknown[]) => console.error(...args);

  const server = new Server(
    { name: "kiyas", version: "1.0.1" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await dispatch(name, args ?? {});
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: "text", text: message }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function dispatch(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "compare":
      return handleCompare(compareInputSchema.parse(args));
    case "get_diff_report":
      return handleGetDiffReport(getDiffReportInputSchema.parse(args));
    case "list_issues":
      return handleListIssues(listIssuesInputSchema.parse(args));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
