import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadIndex, type Answer, type Unit } from "../../src/core/index.ts";
import { buildIndex, parseDocument } from "../../src/parse/index.ts";
import { HELDOUT, TUNED } from "../eval/golden.ts";
import { FASTIFY_DIR, fastifyData } from "../helpers/fastify.ts";

const docs = loadIndex(fastifyData);
const QUESTIONS = [...TUNED, ...HELDOUT].map((g) => g.q);

describe("ask", () => {
  it("answers the research.md section 3 trace in full", () => {
    const a = docs.ask("What is the default bodyLimit?");
    expect(a).toMatchObject({
      confident: true,
      level: "high",
      qclass: "VALUE",
      reason: "gap 89%, coverage 1.00",
      id: "Reference/Server.md#bodylimit",
      file: "Reference/Server.md",
      line: 224,
      endLine: 224,
      headingPath: ["Factory", "bodyLimit"],
      text: "Default: `1048576` (1MiB)",
      units: [{ kind: "list", text: "Default: `1048576` (1MiB)", line: 224 }],
    });
    expect(a.candidates).toHaveLength(5);
    expect(a.candidates[0]).toEqual({ id: "Reference/Server.md#bodylimit", file: "Reference/Server.md", line: 221, headingPath: ["Factory", "bodyLimit"], score: 1098.63 });
  });

  it("fences quoted code", () => {
    const a = docs.ask("how do I set a different log level for one route");
    expect(a.text).toMatch(/^Different log levels can be set for routes[\s\S]*\n```js\n[\s\S]*\n```$/);
    expect(a.endLine).toBeGreaterThan(a.line!);
  });

  it("gives medium confidence when the gap is small", () => {
    expect(docs.ask("How do I fix FST_ERR_CTP_BODY_TOO_LARGE")).toMatchObject({ confident: true, level: "medium", reason: "gap 19%, coverage 1.00" });
  });

  it("says not sure, with the closest sections, when it can't tell", () => {
    const a = docs.ask("how do I turn on logging");
    expect(a).toMatchObject({ confident: false, qclass: "HOWTO", reason: "weak term coverage (0.24)" });
    expect(a.file).toBeUndefined();
    expect(a.candidates.map((c) => c.id)).toContain("Reference/Logging.md#enable-logging");
  });

  it("points at the section when a VALUE question finds no value", () => {
    const idx = loadIndex(buildIndex([parseDocument("limits.md", "# Uploads\n\n## Upload limit\n\nThere is a limit on uploads. Ask support to raise it.\n")]));
    expect(idx.ask("what is the upload limit")).toMatchObject({ confident: false, reason: "VALUE question but best section has no value", file: "limits.md", line: 3 });
  });

  it("takes topK and weight overrides per call or as defaults", () => {
    expect(docs.ask("how do I turn on logging", { topK: 2 }).candidates).toHaveLength(2);
    expect(docs.ask("how do I turn on logging", { weights: { gates: { minCoverage: 0.2, softCoverage: 0.2 } } }).confident).toBe(true);
    const lenient = loadIndex(fastifyData, { weights: { gates: { minCoverage: 0.2, softCoverage: 0.2 } } });
    expect(lenient.ask("how do I turn on logging").confident).toBe(true);
  });
});

describe("DocsIndex", () => {
  it("looks sections up by id and reports its size", () => {
    expect(docs.get("Reference/Server.md#bodylimit")?.heading).toBe("bodyLimit");
    expect(docs.get("nope")).toBeUndefined();
    expect(docs.sectionCount).toBe(559);
    expect(docs.suggest("keepAliveTimout")).toEqual([]); // filled in at M4
  });
});

// PRD section 2: every confident answer's line holds the start of the quoted text.
const sourceLines = new Map<string, string[]>();
const lineOf = (file: string, n: number) => {
  if (!sourceLines.has(file)) sourceLines.set(file, readFileSync(join(FASTIFY_DIR, file), "utf8").split(/\r?\n/));
  return sourceLines.get(file)![n - 1] ?? "";
};
const plain = (s: string) => s.replace(/\]\([^)]*\)/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
// the start of a unit as it appears in the source: a table row starts with its first cell, not "Header: "
const start = (u: Unit) => plain(u.kind === "tableRow" ? u.text.replace(/^[^:]*:\s*/, "") : u.text).slice(0, 16);

describe("across the golden questions", () => {
  const answers = QUESTIONS.map((q) => [q, docs.ask(q)] as const);

  it("puts every quoted unit on the source line where its text starts", () => {
    const wrong: string[] = [];
    for (const [q, a] of answers) {
      if (!a.confident) continue;
      for (const u of a.units!) {
        const at = lineOf(a.file!, u.line);
        // a fenced code unit's line is the fence; its code starts on the next line
        const from = u.kind === "code" && /^\s*(```|~~~)/.test(at) ? u.line + 1 : u.line;
        // the quote may start near the end of its line and wrap, so search from this line on,
        // but the match has to begin on this line
        const first = plain(lineOf(a.file!, from));
        const found = (first + plain(lineOf(a.file!, from + 1)) + plain(lineOf(a.file!, from + 2))).indexOf(start(u));
        const ok = found >= 0 && found < Math.max(first.length, 1);
        if (!ok) wrong.push(`${q} -> ${a.file}:${u.line} ${u.kind} "${u.text.slice(0, 40)}" vs "${at.slice(0, 60)}"`);
      }
    }
    expect(wrong).toEqual([]);
    expect(answers.filter(([, a]) => a.confident).length).toBeGreaterThan(20);
  });

  it("gives the same answer every time", () => {
    const again = QUESTIONS.map((q) => docs.ask(q));
    expect(again).toEqual(answers.map(([, a]) => a as Answer));
  });
});
