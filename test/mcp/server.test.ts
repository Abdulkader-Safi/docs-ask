// The MCP tools driven over a linked in-memory transport, with a hand-rolled JSON-RPC client:
// the client SDK is not a dependency of this package, and raw messages show what a client really sees.
import { InMemoryTransport, LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/server";
import type { JSONRPCMessage } from "@modelcontextprotocol/server";
import { beforeAll, describe, expect, it } from "vitest";
import { createDocsMcpServer } from "../../src/mcp/server.ts";
import { loadIndex, type DocsIndex } from "../../src/core/index.ts";
import { buildIndex, parseDocument } from "../../src/parse/index.ts";
import { fastifyDocs } from "../helpers/fastify.ts";

interface Rpc {
  call: (method: string, params?: unknown) => Promise<any>;
  initialize: (protocolVersion: string) => Promise<any>;
}

async function connect(docs: DocsIndex = fastifyDocs, protocolVersion = LATEST_PROTOCOL_VERSION): Promise<Rpc> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createDocsMcpServer(docs).connect(serverSide);
  const pending = new Map<number, (m: any) => void>();
  clientSide.onmessage = (m: any) => pending.get(m.id)?.(m);
  await clientSide.start();
  let id = 0;
  const call = async (method: string, params: unknown = {}) => {
    const mine = ++id;
    const reply = new Promise<any>((resolve) => pending.set(mine, resolve));
    await clientSide.send({ jsonrpc: "2.0", id: mine, method, params } as JSONRPCMessage);
    const { result, error } = await reply;
    if (error) throw new Error(`${method}: ${error.message}`);
    return result;
  };
  const initialize = async (version: string) => {
    const result = await call("initialize", { protocolVersion: version, capabilities: {}, clientInfo: { name: "test", version: "0" } });
    await clientSide.send({ jsonrpc: "2.0", method: "notifications/initialized" } as JSONRPCMessage);
    return result;
  };
  await initialize(protocolVersion);
  return { call, initialize };
}

let rpc: Rpc;
beforeAll(async () => {
  rpc = await connect();
});
const callTool = (name: string, args: unknown) => rpc.call("tools/call", { name, arguments: args });
const textOf = (r: any) => r.content.map((c: any) => c.text).join("\n");

describe("initialize", () => {
  it("names the server and offers tools", async () => {
    const result = await rpc.call("ping").then(() => rpc.call("tools/list"));
    expect(result.tools.map((t: any) => t.name).sort()).toEqual(["ask_docs", "get_section"]);
  });

  it("negotiates the 2025 protocol version too", async () => {
    // research.md section 16: serveStdio's default legacy mode answers 2025-era clients
    const old = await connect(fastifyDocs, "2025-11-25");
    const result = await old.call("tools/list");
    expect(result.tools).toHaveLength(2);
  });

  it("carries instructions a client reads before any tool call", async () => {
    const fresh = InMemoryTransport.createLinkedPair();
    await createDocsMcpServer(fastifyDocs).connect(fresh[1]);
    const replies: any[] = [];
    fresh[0].onmessage = (m: any) => replies.push(m);
    await fresh[0].start();
    await fresh[0].send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "t", version: "0" } } } as JSONRPCMessage);
    await new Promise((r) => setTimeout(r, 10));
    const { serverInfo, instructions } = replies[0].result;
    expect(serverInfo.name).toBe("docs-ask");
    expect(instructions).toMatch(/^Answers questions about this repository's markdown documentation/);
    expect(instructions.length).toBeLessThan(2048); // Claude Code cuts instructions at 2 KB
  });
});

describe("the tool definitions", () => {
  it("are read-only, idempotent and closed-world, with descriptions under 2 KB", async () => {
    const { tools } = await rpc.call("tools/list");
    for (const t of tools) {
      expect(t.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true, openWorldHint: false });
      expect(t.description.length).toBeLessThan(2048);
    }
    const ask = tools.find((t: any) => t.name === "ask_docs");
    expect(ask.inputSchema.required).toEqual(["question"]);
    expect(ask.outputSchema.properties.answered.type).toBe("boolean");
  });
});

describe("ask_docs", () => {
  it("quotes the answer with file:line and lists the closest sections", async () => {
    const r = await callTool("ask_docs", { question: "what is the default bodyLimit" });
    expect(r.structuredContent).toMatchObject({
      answered: true,
      qclass: "VALUE",
      answer: { id: "Reference/Server.md#bodylimit", file: "Reference/Server.md", line: 224, level: "high", text: "Default: `1048576` (1MiB)" },
    });
    expect(textOf(r).split("\n").slice(0, 2)).toEqual([
      "Reference/Server.md:224  Factory > bodyLimit  [Reference/Server.md#bodylimit]",
      "Default: `1048576` (1MiB)",
    ]);
    expect(textOf(r)).toContain("Also:");
  });

  it("says it isn't sure and hands back candidates to read", async () => {
    const r = await callTool("ask_docs", { question: "how do I stop the server gracefully" });
    expect(r.structuredContent.answered).toBe(false);
    expect(r.structuredContent.candidates.length).toBeGreaterThan(1);
    expect(r.structuredContent.answer).toBeUndefined();
    expect(textOf(r)).toMatch(/^No confident answer \(ambiguous: top two within \d+%\)\./);
    expect(textOf(r)).toContain("Closest sections, call get_section for the full text:");
  });

  it("passes on near spellings", async () => {
    const r = await callTool("ask_docs", { question: "what is the default keepAliveTimout" });
    expect(r.structuredContent.suggestions).toContain("keepAliveTimeout");
    expect(textOf(r)).toContain("Did you mean: keepAliveTimeout?");
  });

  it("takes topK, and defaults to 3", async () => {
    const one = await callTool("ask_docs", { question: "how do I stop the server gracefully", topK: 1 });
    expect(one.structuredContent.candidates).toHaveLength(1);
    const dflt = await callTool("ask_docs", { question: "how do I stop the server gracefully" });
    expect(dflt.structuredContent.candidates).toHaveLength(3);
  });

  it("rejects bad arguments before the handler runs", async () => {
    const short = await callTool("ask_docs", { question: "" });
    expect(short.isError).toBe(true);
    const tooMany = await callTool("ask_docs", { question: "what is the default bodyLimit", topK: 99 });
    expect(tooMany.isError).toBe(true);
  });
});

describe("get_section", () => {
  it("returns the section's own text under its citation", async () => {
    const r = await callTool("get_section", { id: "Reference/Server.md#bodylimit" });
    expect(r.isError).toBeFalsy();
    expect(textOf(r)).toMatch(/^Reference\/Server\.md:\d+ {2}Factory > bodyLimit\n\n/);
    expect(textOf(r)).toContain("Default: `1048576` (1MiB)");
  });

  it("cuts a long section at 8000 characters", async () => {
    // the Fastify fixture's longest section is 2,214 characters, so the cut needs a section of its own
    const wall = Array.from({ length: 400 }, (_, i) => `Sentence number ${i} of a very long section.`).join(" ");
    const big = loadIndex(buildIndex([parseDocument("long.md", `# Long\n\n## Wall of text\n\n${wall}\n`)]));
    const r = await (await connect(big)).call("tools/call", { name: "get_section", arguments: { id: "long.md#wall-of-text" } });
    expect(textOf(r)).toContain("... cut at 8000 characters");
    expect(textOf(r).length).toBeLessThan(8000 + 100);
    const { tools } = await rpc.call("tools/list");
    expect(tools.find((t: any) => t.name === "get_section").description).toContain("8000");
  });

  it("tells a caller with an unknown id to ask first", async () => {
    const r = await callTool("get_section", { id: "Reference/Nope.md#missing" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toBe('Unknown id "Reference/Nope.md#missing". Call ask_docs first to get valid ids.');
  });
});
