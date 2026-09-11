// The CLI is tested through main(argv, io): same code as the bin, without spawning a process.
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { main } from "../../src/cli/main.ts";

const FASTIFY = fileURLToPath(new URL("../fixtures/fastify", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "docs-ask-cli-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const run = async (...argv: string[]) => {
  const out: string[] = [], err: string[] = [];
  const code = await main(argv, { log: (s) => out.push(s), error: (s) => err.push(s) });
  return { code, out: strip(out.join("\n")), err: strip(err.join("\n")) };
};

describe("docs-ask ask", () => {
  it("prints file:line, the heading path, the quote and the closest sections", async () => {
    const { code, out } = await run("ask", "what is the default bodyLimit", "-d", FASTIFY);
    expect(code).toBe(0);
    expect(out.split("\n").slice(0, 2)).toEqual([
      "Reference/Server.md:224 Factory > bodyLimit VALUE · high",
      "Default: `1048576` (1MiB)",
    ]);
    expect(out).toMatch(/\nAlso: Reference\/\S+:\d+ {2}/);
  });

  it("exits 2 and lists the closest sections when it isn't sure", async () => {
    const { code, out } = await run("ask", "how do I stop the server gracefully", "-d", FASTIFY);
    expect(code).toBe(2);
    expect(out).toContain("No confident answer (ambiguous: top two within 9%). Closest sections:");
    expect(out).toMatch(/ {2}1\. Reference\/Hooks\.md:\d+ {2}Application Hooks > preClose/);
  });

  it("offers near spellings for an unknown identifier", async () => {
    const { out } = await run("ask", "what is the default keepAliveTimout", "-d", FASTIFY);
    expect(out).toContain("Did you mean: keepAliveTimeout?");
  });

  it("uses the same exit codes with --json, and prints the Answer", async () => {
    const answered = await run("ask", "what is the default bodyLimit", "-d", FASTIFY, "--json");
    expect(answered.code).toBe(0);
    expect(JSON.parse(answered.out)).toMatchObject({ confident: true, file: "Reference/Server.md", line: 224, qclass: "VALUE" });
    const unsure = await run("ask", "how do I stop the server gracefully", "-d", FASTIFY, "--json");
    expect(unsure.code).toBe(2);
    expect(JSON.parse(unsure.out).confident).toBe(false);
  });

  it("takes --top", async () => {
    const { out } = await run("ask", "how do I stop the server gracefully", "-d", FASTIFY, "--top", "1");
    expect(out.split("\n").filter((l) => /^ {2}\d\./.test(l))).toHaveLength(1);
  });
});

describe("docs-ask build", () => {
  it("writes an index and reports what it holds", async () => {
    const out = join(tmp, "docs-index.json");
    const res = await run("build", "-d", FASTIFY, "-o", out);
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/^ok 559 sections from 30 files, \d+ KB -> /);
    expect(statSync(out).size).toBeGreaterThan(0);
  });
});

describe("errors and help", () => {
  it.each([
    [["frob"], 'error: unknown command "frob"'],
    [["ask"], "error: missing question"],
    [["build", "--target", "sideways"], 'error: --target must be node or web, not "sideways"'],
    [["ask", "q", "--nope"], "error: Unknown option"],
  ])("%s exits 1", async (argv, message) => {
    const { code, err } = await run(...argv);
    expect(code).toBe(1);
    expect(err).toContain(message);
  });

  it("prints help: exit 0 when asked for, 1 when no command is given", async () => {
    const asked = await run("--help");
    expect(asked.code).toBe(0);
    expect(asked.out).toContain("Usage:");
    expect((await run()).code).toBe(1);
  });

  it("reports a missing folder", async () => {
    const { code, err } = await run("ask", "anything", "-d", join(tmp, "not-here"));
    expect(code).toBe(1);
    expect(err).toContain("error: no such folder:");
  });

  it("reports a folder with no markdown in it", async () => {
    const empty = mkdtempSync(join(tmpdir(), "docs-ask-empty-"));
    try {
      const { code, err } = await run("ask", "anything", "-d", empty);
      expect(code).toBe(1);
      expect(err).toContain("error: no markdown found in");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("docs-ask mcp", () => {
  it("loads the MCP module only for this command", async () => {
    // the stub throws until M6; reaching it proves the lazy import path runs
    const { code, err } = await run("mcp", FASTIFY);
    expect(code).toBe(1);
    expect(err).toContain("the MCP server is not built yet");
  });
});
