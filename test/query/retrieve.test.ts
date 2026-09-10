import { describe, expect, it } from "vitest";
import { planQuery, retrieve } from "../../src/query/retrieve.ts";
import { classify } from "../../src/query/rules.ts";
import { withWeights, type WeightOverrides } from "../../src/query/weights.ts";
import { openIndex as loadIndex } from "../../src/query/load.ts";
import { buildIndex, parseDocument } from "../../src/parse/index.ts";
import { fastify } from "../helpers/fastify.ts";

const ranked = (q: string, overrides: WeightOverrides = {}) =>
  retrieve(fastify, planQuery(fastify, q), classify(q).primary, withWeights(overrides));
const top = (q: string, overrides: WeightOverrides = {}) => {
  const [r] = ranked(q, overrides);
  return `${r.s.file} > ${r.s.heading}`;
};
const scoreOf = (q: string, id: string, overrides: WeightOverrides = {}) => ranked(q, overrides).find((r) => r.s.id === id)!.score;
const gap = (q: string, overrides: WeightOverrides = {}) => {
  const [a, b] = ranked(q, overrides);
  return (a.score - b.score) / a.score;
};

describe("planQuery", () => {
  it("applies synonyms and splits out identifiers and trigger words", () => {
    expect(planQuery(fastify, "What is the default bodyLimit?")).toEqual({
      q: ["default", "bodylimit", "bodi", "limit"],
      exact: ["bodylimit"],
      content: ["bodylimit", "bodi"],
      expanded: ["default", "bodylimit", "bodi", "limit"],
      origin: new Map(),
      words: 5,
    });
    const remove = planQuery(fastify, "how do I remove a route");
    expect(remove.expanded).toEqual(["remov", "rout", "delet"]);
    expect(remove.origin).toEqual(new Map([["delet", "remov"]]));
  });
});

describe("retrieve", () => {
  it("keeps at most 25 sections, best first, with coverage between 0 and 1", () => {
    const r = ranked("how do I set a different log level for one route");
    expect(r.length).toBeLessThanOrEqual(25);
    expect(r.map((x) => x.score)).toEqual([...r.map((x) => x.score)].sort((a, b) => b - a));
    expect(r.every((x) => x.idfCoverage >= 0 && x.idfCoverage <= 1)).toBe(true);
    expect(top("how do I set a different log level for one route")).toBe("Reference/Routes.md > Custom Log Level");
  });

  it("finds bodyLimit with the numbers research.md section 3 traces", () => {
    const [first, second] = ranked("What is the default bodyLimit?");
    expect(first.s.id).toBe("Reference/Server.md#bodylimit");
    // research.md quotes 1099.5 and 121.5; the prototype's own ask() gives 1098.63 today, and so do we.
    expect(Math.abs(first.score / 1099.5 - 1)).toBeLessThan(0.01);
    expect(Math.abs(second.score / 121.5 - 1)).toBeLessThan(0.01);
    expect(first.idfCoverage).toBe(1);
  });
});

// Each factor fixed a real failure in the research prototype (research.md section 9).
describe("rerank factors", () => {
  it("definition site: an error code starting a table row wins", () => {
    const q = "How do I fix FST_ERR_CTP_BODY_TOO_LARGE";
    expect(top(q)).toBe("Reference/Errors.md > Fastify Error Codes");
    expect(top(q, { rerank: { definitionSite: 1 } })).toBe("Reference/Server.md > bodyLimit");
  });

  it("signature penalty: a TypeScript signature heading doesn't win a plain question", () => {
    const q = "How do I register a plugin?";
    expect(top(q)).toBe("Guides/Plugins-Guide.md > Register");
    expect(top(q, { rerank: { signaturePenalty: 1 } })).toMatch(/^Reference\/TypeScript\.md > fastify\.FastifyRegister\(/);
  });

  it("jaccard: the heading that says exactly 'Encapsulation' pulls clear", () => {
    const q = "What is encapsulation?";
    expect(top(q)).toBe("Reference/Encapsulation.md > Encapsulation");
    expect(gap(q)).toBeGreaterThan(0.3);
    expect(gap(q, { rerank: { jaccard: 0 } })).toBeLessThan(0.05); // would abstain as too close to call
  });

  it("exact identifier in the heading multiplies the score by 1.5", () => {
    const q = "What is the default bodyLimit?", id = "Reference/Server.md#bodylimit";
    expect(scoreOf(q, id) / scoreOf(q, id, { rerank: { exactInHeading: 1 } })).toBeCloseTo(1.5);
  });

  it("heading term of the question type (VALUE: limit) multiplies by 1.15", () => {
    const q = "What is the default bodyLimit?", id = "Reference/Server.md#bodylimit";
    expect(scoreOf(q, id) / scoreOf(q, id, { rerank: { headingTerm: 1 } })).toBeCloseTo(1.15);
  });

  it("preferred unit kinds (HOWTO: ordered list or code) multiply by the rule's factor", () => {
    const q = "how to install fastify", id = ranked(q)[0].s.id;
    expect(ranked(q)[0].s.units.some((u) => u.kind === "code")).toBe(true);
    const rule = classify(q).primary;
    const noFactor = { ...rule, boosts: { ...rule.boosts, sectionHasFactor: 1 } };
    const off = retrieve(fastify, planQuery(fastify, q), noFactor, withWeights()).find((r) => r.s.id === id)!.score;
    expect(scoreOf(q, id) / off).toBeCloseTo(1.25);
  });
});

describe("loose synonyms (M4)", () => {
  const idx = loadIndex(buildIndex([
    parseDocument("a.md", "# Records\n\n## Deleting\n\nDelete the record. Delete it from the list. Delete works on drafts.\n"),
    parseDocument("b.md", "# Cleanup\n\n## Cleaning up\n\nRemove the record. Destroy the cache. Drop the table.\n"),
  ]));
  const scores = (groupExpansions: number) => {
    const q = "how do I delete a record";
    const res = retrieve(idx, planQuery(idx, q), classify(q).primary, withWeights({ search: { groupExpansions } }));
    return Object.fromEntries(res.map((x) => [x.s.file === "b.md" ? "aliases" : x.s.id === "a.md#deleting" ? "exact" : "other", x.score]));
  };

  it("count a word and its synonyms as one match", () => {
    // b.md matched record, remov, destroy and drop: 4 terms from 2 question words, so its score halves
    const on = scores(1), off = scores(0);
    expect(on.aliases / off.aliases).toBeCloseTo(0.5);
    expect(on.exact).toBe(off.exact);
    expect(on.exact).toBeGreaterThan(on.aliases);
  });

  it("cover the question word they were added for", () => {
    // "hide" only reaches the Log Redaction section through its synonym "redact"
    const [top] = ranked("How do I hide passwords in logs?");
    expect(top.s.heading).toBe("Log Redaction");
    expect(top.idfCoverage).toBeGreaterThanOrEqual(0.5);
  });
});
