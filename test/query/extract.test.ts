import { describe, expect, it } from "vitest";
import { loadIndex } from "../../src/core/index.ts";
import { buildIndex, parseDocument } from "../../src/parse/index.ts";
import { luhn, pickUnits, type Picked } from "../../src/query/extract.ts";
import { planQuery, retrieve } from "../../src/query/retrieve.ts";
import { classify } from "../../src/query/rules.ts";
import { WEIGHTS } from "../../src/query/weights.ts";
import { fastify } from "../helpers/fastify.ts";

const answer = (q: string, idx = fastify) => {
  const rule = classify(q).primary;
  const plan = planQuery(idx, q);
  const [top] = retrieve(idx, plan, rule, WEIGHTS);
  return { section: top.s, picked: pickUnits(idx, top.s, rule, plan, WEIGHTS) };
};
const units = (p: Picked) => ("units" in p ? p.units : []);

describe("luhn", () => {
  it("scores the densest cluster of significant words", () => {
    expect(luhn([true, true, false, true], 4)).toBe(9 / 4); // 3 words over a span of 4
    expect(luhn([true, false, false, false, false, false, true], 4)).toBe(1); // 5 apart: two clusters of 1
    expect(luhn([false, false], 4)).toBe(0);
  });
});

describe("pickUnits", () => {
  it("VALUE: quotes the Default line even though it repeats none of the question's words", () => {
    // research.md section 10: residual coverage plus the VALUE pattern beat a sentence naming server.keepAliveTimeout
    const { section, picked } = answer("how long is keepAliveTimeout");
    expect(section.heading).toBe("keepAliveTimeout");
    expect(units(picked).map((u) => u.text)).toEqual(["Default: `72000` (72 seconds)"]);
  });

  it("VALUE: bodyLimit answers with its default, on the right line", () => {
    const [u] = units(answer("What is the default bodyLimit?").picked);
    expect(u).toMatchObject({ kind: "list", text: "Default: `1048576` (1MiB)" });
    expect(u.line).toBe(224);
  });

  it("ERROR: a table-row answer is a single row", () => {
    const picked = units(answer("How do I fix FST_ERR_CTP_BODY_TOO_LARGE").picked);
    expect(picked).toHaveLength(1);
    expect(picked[0].kind).toBe("tableRow");
    expect(picked[0].text).toMatch(/^Code: FST_ERR_CTP_BODY_TOO_LARGE \| .*How to solve: Increase the limit/);
  });

  it("HOWTO without an ordered list: the best sentence and code block, in document order", () => {
    const picked = units(answer("how do I set a different log level for one route").picked);
    expect(picked.map((u) => u.kind)).toEqual(["sentence", "code"]);
    expect(picked[0].text).toMatch(/^Different log levels can be set for routes/);
    expect(picked[0].line).toBeLessThan(picked[1].line);
  });

  it("EXAMPLE: the first code block with the sentence before it", () => {
    const picked = units(answer("example of a preHandler hook").picked);
    expect(picked.at(-1)!.kind).toBe("code");
    expect(picked.at(-1)!.text).toContain("addHook");
    expect(picked.filter((u) => u.kind === "code")).toHaveLength(1);
  });

  it("HOWTO with an ordered list: the lead sentence and the numbered steps", () => {
    const idx = loadIndex(buildIndex([parseDocument("deploy.md", "# Deploy\n\n## Deploy to a VPS\n\nFollow these steps.\n\n1. Build the app.\n2. Copy it over.\n3. Start it.\n")]));
    const picked = units(answer("how do I deploy to a VPS", idx).picked);
    expect(picked.map((u) => `${u.kind}@${u.line}`)).toEqual(["sentence@5", "orderedList@7", "orderedList@8", "orderedList@9"]);
  });

  it("LOCATION: no text, only the section", () => {
    expect(units(answer("Where is the custom error handler documented?").picked)).toEqual([]);
  });

  it("VALUE: reports that the section holds no value at all", () => {
    const idx = loadIndex(buildIndex([parseDocument("limits.md", "# Uploads\n\n## Upload limit\n\nThere is a limit on uploads. Ask support to raise it.\n")]));
    expect(answer("what is the upload limit", idx).picked).toEqual({ noValue: true });
  });
});
