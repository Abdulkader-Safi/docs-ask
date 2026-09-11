// docs-ask mcp, driven the way a client drives it: a real child process, JSON-RPC over its stdin and stdout.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { indexDirectory, writeIndex, INDEX_FILE } from "../../src/node/index.ts";
import { FASTIFY_DIR } from "../helpers/fastify.ts";

const CLAIM = "io.modelcontextprotocol/protocolVersion"; // a modern (2026-07-28) client claims its revision here
// The built binary when there is one (what a user runs), otherwise the source with type stripping,
// which spends a second parsing the tree before it starts and so can't be timed.
const BIN = fileURLToPath(new URL("../../dist/cli-bin.mjs", import.meta.url));
const built = existsSync(BIN);
const ENTRY = built ? [BIN] : ["--experimental-strip-types", "src/cli/bin.ts"];

class Server {
  readonly child: ChildProcessWithoutNullStreams;
  readonly messages: any[] = [];
  stderr = "";
  #buf = "";
  constructor(args: string[], env: NodeJS.ProcessEnv = {}) {
    this.child = spawn(process.execPath, [...ENTRY, "mcp", ...args], { env: { ...process.env, ...env } });
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (d: string) => (this.stderr += d));
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (d: string) => {
      this.#buf += d;
      for (let i; (i = this.#buf.indexOf("\n")) >= 0; ) {
        const line = this.#buf.slice(0, i).trim();
        this.#buf = this.#buf.slice(i + 1);
        if (line) this.messages.push(JSON.parse(line)); // every stdout line must be JSON-RPC, so this throws if anything else is logged
      }
    });
  }
  send(method: string, params: unknown = {}, id?: number) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, params })}\n`);
  }
  /** Waits for the reply to one id, or for a line of stderr when no id is given. */
  async wait(id: number | null, ms = 5000): Promise<any> {
    const until = Date.now() + ms;
    for (;;) {
      const found = id === null ? this.stderr.includes("\n") : this.messages.find((m) => m.id === id);
      if (found) return id === null ? this.stderr : found;
      if (Date.now() > until) throw new Error(`timed out waiting for ${id ?? "stderr"}\nstderr: ${this.stderr}`);
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  async initialize(extra: Record<string, unknown> = {}): Promise<any> {
    this.send("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "0" }, ...extra }, 1);
    const reply = await this.wait(1);
    this.send("notifications/initialized", extra);
    return reply;
  }
  kill() {
    this.child.kill();
  }
}

let running: Server[] = [];
const start = (args: string[], env?: NodeJS.ProcessEnv) => {
  const s = new Server(args, env);
  running.push(s);
  return s;
};
afterEach(() => {
  running.forEach((s) => s.kill());
  running = [];
});

describe("docs-ask mcp over stdio", () => {
  it("answers initialize and logs to stderr only", async () => {
    const started = Date.now();
    const server = start([FASTIFY_DIR]);
    const reply = await server.initialize();
    if (built) expect(Date.now() - started).toBeLessThan(1000); // PRD: initialize inside a second with a fresh index
    expect(reply.result.serverInfo).toMatchObject({ name: "docs-ask" });
    expect(reply.result.protocolVersion).toBe("2025-11-25");
    expect(server.stderr).toMatch(/\[docs-ask\] 559 sections from .*fastify \(built in memory\) in \d+ ms/);
    expect(server.messages.every((m) => m.jsonrpc === "2.0")).toBe(true); // stdout parsed as JSON-RPC line by line
  });

  it("answers a question with its citation", async () => {
    const server = start([FASTIFY_DIR]);
    await server.initialize();
    server.send("tools/call", { name: "ask_docs", arguments: { question: "what is the default bodyLimit", topK: 1 } }, 2);
    const { result } = await server.wait(2);
    expect(result.content[0].text).toContain("Reference/Server.md:224  Factory > bodyLimit");
    expect(result.structuredContent.answer.text).toBe("Default: `1048576` (1MiB)");
  });

  it("serves a client that claims the modern protocol revision", async () => {
    // serveStdio picks the era from the opening message: an initialize carrying a valid 2026-07-28 envelope
    // claim is served as modern, anything else as 2025-era. Both reach the same tools.
    const server = start([FASTIFY_DIR]);
    const meta = { _meta: { [CLAIM]: "2026-07-28" } };
    await server.initialize(meta);
    server.send("tools/list", meta, 2);
    const { result } = await server.wait(2);
    expect(result.tools.map((t: any) => t.name).sort()).toEqual(["ask_docs", "get_section"]);
  });

  it("reads docs-index.json when it's fresh", async () => {
    const root = mkdtempSync(join(tmpdir(), "docs-ask-mcp-"));
    try {
      writeFileSync(join(root, "limits.md"), "# Limits\n\n## bodyLimit\n\nDefault: `1048576` (1MiB)\n");
      await writeIndex(await indexDirectory(root), join(root, INDEX_FILE));
      const server = start([root]);
      await server.initialize();
      expect(server.stderr).toContain("(docs-index.json)");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("falls back to CLAUDE_PROJECT_DIR when no folder is given", async () => {
    const server = start([], { CLAUDE_PROJECT_DIR: FASTIFY_DIR });
    await server.initialize();
    expect(server.stderr).toContain(FASTIFY_DIR);
  });
});
