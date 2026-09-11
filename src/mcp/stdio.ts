// docs-ask mcp: the MCP server over stdio (research.md section 16).
// stdout carries JSON-RPC, so everything this prints goes to stderr.
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadDocs } from "../node/index.ts";
import { createDocsMcpServer } from "./server.ts";

/** Indexes `root` (from the index file when it's fresh), then serves until stdin closes or SIGINT. */
export async function runStdio(root: string): Promise<void> {
  const started = Date.now();
  const { docs, fromFile } = await loadDocs(root);
  console.error(`[docs-ask] ${docs.sectionCount} sections from ${root} ${fromFile ? "(docs-index.json)" : "(built in memory)"} in ${Date.now() - started} ms`);
  const handle = serveStdio(() => createDocsMcpServer(docs), { onerror: (e) => console.error(`[docs-ask] ${e.message}`) });
  process.on("SIGINT", () => void handle.close());
  process.on("SIGTERM", () => void handle.close());
}
