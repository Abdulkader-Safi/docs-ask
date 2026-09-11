import { describe, expect, it } from "vitest";
import { loadIndex } from "../../src/core/index.ts";
import { splitComparison } from "../../src/query/compare.ts";
import { fastifyData } from "../helpers/fastify.ts";

const docs = loadIndex(fastifyData);

describe("splitComparison (research.md section 8)", () => {
  it.each([
    ["difference between onRequest and preHandler", ["onRequest", "preHandler"]],
    ["reply.send vs return", ["reply.send", "return"]],
    ["connectionTimeout versus requestTimeout?", ["connectionTimeout", "requestTimeout"]],
    ["should I use inject or a running server", ["inject", "a running server"]],
  ])("%s", (q, sides) => {
    expect(splitComparison(q)).toEqual(sides);
  });

  it("returns null for anything else", () => {
    expect(splitComparison("how do I register a plugin")).toBeNull();
  });
});

describe("comparison answers", () => {
  it("quote one sentence per side, each with its own citation", () => {
    const a = docs.ask("onSend vs preSerialization");
    expect(a).toMatchObject({ confident: true, qclass: "COMPARISON", file: "Reference/Hooks.md", line: 199 });
    expect(a.parts!.map((p) => `${p.file}:${p.line} ${p.headingPath.at(-1)}`)).toEqual(["Reference/Hooks.md:199 onSend", "Reference/Hooks.md:152 preSerialization"]);
    expect(a.text).toBe(a.parts!.map((p) => p.text).join("\n"));
    expect(a.reason).toMatch(/^comparison: onSend gap \d+%, preSerialization gap \d+%$/);
  });

  it("fall back to a single lookup when a side is one common word", () => {
    // "return" is in more than 5% of sections: too vague to look up alone
    const a = docs.ask("reply.send vs return");
    expect(a.parts).toBeUndefined();
    expect(a.qclass).toBe("COMPARISON");
  });

  it("never quote a lead-in sentence that ends in a colon", () => {
    for (const q of ["onSend vs preSerialization", "difference between onRequest and preHandler", "connectionTimeout vs requestTimeout"]) {
      for (const p of docs.ask(q).parts ?? []) expect(p.text.endsWith(":"), `${q}: ${p.text}`).toBe(false);
    }
  });
});
