import { describe, expect, it } from "vitest";
import { openIndex as loadIndex } from "../../src/query/load.ts";
import { buildIndex, parseDocument } from "../../src/parse/index.ts";
import { checkGates } from "../../src/query/gates.ts";
import { planQuery, retrieve } from "../../src/query/retrieve.ts";
import { classify } from "../../src/query/rules.ts";
import { WEIGHTS, withWeights } from "../../src/query/weights.ts";
import { fastify } from "../helpers/fastify.ts";

const run = (q: string, idx = fastify, w = WEIGHTS) => {
  const plan = planQuery(idx, q);
  const ranked = retrieve(idx, plan, classify(q).primary, w);
  return { ranked, gate: checkGates(idx, ranked, plan, w) };
};

describe("checkGates", () => {
  it("lets a clear answer through with its gap and coverage (research.md section 3: 89%, 1.00)", () => {
    const { gate } = run("What is the default bodyLimit?");
    expect(gate.ok).toBe(true);
    if (gate.ok) {
      expect(gate.gap).toBeCloseTo(0.89, 2);
      expect(gate.coverage).toBe(1);
    }
  });

  it("gate 1: abstains when an identifier never appears in the docs", () => {
    expect(run("how do I parse a custom content type like text/csv").gate).toEqual({ ok: false, reason: "not found in docs: text/csv", unknown: ["text/csv"] });
    expect(run("what is the default keepAliveTimout").gate).toEqual({ ok: false, reason: "not found in docs: keepalivetimout", unknown: ["keepalivetimout"] });
  });

  it("gate 2: abstains on weak coverage but keeps the right section among the candidates", () => {
    // research.md section 11: "how do I turn on logging" abstains with coverage 0.24
    const { gate, ranked } = run("how do I turn on logging");
    expect(gate).toEqual({ ok: false, reason: "weak term coverage (0.24)" });
    expect(ranked.slice(0, 3).map((r) => r.s.id)).toContain("Reference/Logging.md#enable-logging");
  });

  it("gate 3: abstains when the top two are too close", () => {
    expect(run("how do I share a JSON schema between routes").gate).toMatchObject({ ok: false, reason: expect.stringMatching(/^ambiguous: top two within \d+%$/) });
  });

  it("uses the thresholds from WEIGHTS", () => {
    expect(run("how do I turn on logging", fastify, withWeights({ gates: { minCoverage: 0.2, softCoverage: 0.2 } })).gate.ok).toBe(true);
  });

  it("doesn't count a parent or child section of the same file as a competitor", () => {
    const idx = loadIndex(buildIndex([parseDocument("guide.md", "# Guide\n\n## Webhooks\n\nWebhooks send events.\n\n### Webhooks retries\n\nWebhooks retry events.\n")]));
    const { ranked, gate } = run("webhooks events", idx);
    expect(ranked[0].s.file).toBe(ranked[1].s.file);
    expect(gate).toEqual({ ok: true, gap: 1, coverage: 1 });
  });

  it("abstains when nothing matches", () => {
    expect(run("zzz qqq").gate).toEqual({ ok: false, reason: "no matching section" });
  });
});
