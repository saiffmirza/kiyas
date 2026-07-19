import { test } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// MCP smoke: boots the *built* CLI (`dist/index.js mcp`) over stdio and speaks
// real JSON-RPC — catches SDK upgrades, bundling regressions, and schema
// breakage before publish. Run `npm run build` first.

// bundled to smoke/dist, so the package root is two levels up
const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(PKG_ROOT, "dist", "index.js");

interface RpcResponse {
  id?: number;
  result?: {
    serverInfo?: { name: string; version: string };
    tools?: { name: string; inputSchema: { type: string } }[];
  };
  error?: { message: string };
}

test("MCP server boots on stdio and lists its tools", async () => {
  const pkgVersion: string = JSON.parse(
    readFileSync(join(PKG_ROOT, "package.json"), "utf-8")
  ).version;

  const proc = spawn(process.execPath, [CLI, "mcp"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const pending = new Map<number, (msg: RpcResponse) => void>();
  const rl = createInterface({ input: proc.stdout });
  rl.on("line", (line) => {
    let msg: RpcResponse;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // not a JSON-RPC frame
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const resolve = pending.get(msg.id)!;
      pending.delete(msg.id);
      resolve(msg);
    }
  });

  const request = (
    id: number,
    method: string,
    params?: Record<string, unknown>
  ): Promise<RpcResponse> => {
    const response = new Promise<RpcResponse>((resolve, reject) => {
      pending.set(id, resolve);
      setTimeout(
        () => reject(new Error(`Timed out waiting for ${method} response`)),
        10_000
      ).unref();
    });
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    return response;
  };

  try {
    const init = await request(1, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "kiyas-smoke", version: "0.0.0" },
    });
    assert.strictEqual(init.result?.serverInfo?.name, "kiyas");
    assert.strictEqual(init.result?.serverInfo?.version, pkgVersion);

    proc.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n"
    );

    const list = await request(2, "tools/list");
    const tools = list.result?.tools ?? [];
    assert.deepStrictEqual(
      tools.map((t) => t.name).sort(),
      ["compare", "get_diff_report", "list_issues"]
    );
    for (const tool of tools) {
      assert.strictEqual(tool.inputSchema.type, "object");
    }
  } finally {
    proc.kill();
  }
});
