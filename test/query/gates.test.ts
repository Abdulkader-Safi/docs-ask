import { describe, expect, it } from "vitest";
import { openIndex as loadIndex } from "../../src/query/load.ts";
import { buildIndex, parseDocument } from "../../src/parse/index.ts";
import { checkGates } from "../../src/query/gates.ts";
import { planQuery, retrieve } from "../../src/query/retrieve.ts";
import { classify } from "../../src/query/rules.ts";
import { WEIGHTS, withWeights } from "../../src/query/weights.ts";
import { loadIndex as loadDocsIndex } from "../../src/core/index.ts";
import { fastify, fastifyData } from "../helpers/fastify.ts";
import { honoData } from "../helpers/hono.ts";

const run = (q: string, idx = fastify, w = WEIGHTS) => {
  const plan = planQuery(idx, q);
  const ranked = retrieve(idx, plan, classify(q).primary, w);
  return { ranked, gate: checkGates(idx, ranked, plan, classify(q), w) };
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

  it("gate 1: lets a MIME type through, since docs explain content types without listing each one", () => {
    expect(planQuery(fastify, "how do I parse a custom content type like text/csv").exact).toEqual(["text/csv"]);
    expect(run("how do I parse a custom content type like text/csv").gate).not.toMatchObject({ reason: expect.stringMatching(/^not found/) });
  });

  it("gate 1: abstains when an identifier never appears in the docs", () => {
    expect(run("what is the default keepAliveTimout").gate).toEqual({ ok: false, reason: "not found in docs: keepalivetimout", unknown: ["keepalivetimout"] });
  });

  it("gate 2: abstains on weak coverage but keeps the right section among the candidates", () => {
    // research.md section 11 used "how do I turn on logging"; the M4 enable synonym answers that one now
    const { gate, ranked } = run("how do I parse a custom content type like text/csv");
    expect(gate).toEqual({ ok: false, reason: "weak term coverage (0.39)" });
    expect(ranked[0].s.heading).toBe("addContentTypeParser"); // an accepted answer for this held-out question
  });

  it("gate 3: abstains when the top two are too close", () => {
    expect(run("how do I share a JSON schema between routes").gate).toMatchObject({ ok: false, reason: expect.stringMatching(/^ambiguous: top two within \d+%$/) });
  });

  it("uses the thresholds from WEIGHTS", () => {
    expect(run("how do I parse a custom content type like text/csv", fastify, withWeights({ gates: { minCoverageByType: { HOWTO: 0.3 } } })).gate.ok).toBe(true);
  });

  it("uses a per-type coverage bar (HOWTO 0.45) before the general one", () => {
    // coverage 0.39: under both bars; coverage between 0.45 and 0.5 passes only for HOWTO
    expect(WEIGHTS.gates.minCoverageByType.HOWTO).toBe(0.45);
    expect(run("how do I parse a custom content type like text/csv", fastify, withWeights({ gates: { minCoverageByType: {} } })).gate).toEqual({ ok: false, reason: "weak term coverage (0.39)" });
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

describe("gates 4 and 5 (research.md section 11)", () => {
  const doc = (src: string) => loadIndex(buildIndex([parseDocument("api.md", src)]));

  it("gate 4: an EXAMPLE question needs a code block in the section", () => {
    const noCode = "# Hooks\n\n## preHandler hook\n\nThe preHandler hook runs before the handler.\n";
    expect(run("example of a preHandler hook", doc(noCode)).gate).toEqual({ ok: false, reason: "EXAMPLE question but best section has no code" });
    expect(run("example of a preHandler hook", doc(noCode + '\n```js\nfastify.addHook("preHandler", fn)\n```\n')).gate.ok).toBe(true);
  });

  it("gate 4: an ENDPOINT question needs an endpoint in the section", () => {
    expect(run("Which endpoint creates an app?", doc("# API\n\n## Create an app\n\nThis creates an application for your account.\n")).gate).toEqual({
      ok: false,
      reason: "ENDPOINT question but best section names no endpoint",
    });
    expect(run("Which endpoint creates an app?", doc("# API\n\n## Create an app\n\nCall `POST /api/v1/apps` to create an application.\n")).gate.ok).toBe(true);
  });

  it("gate 4: skips the check when the question type is a tie", () => {
    // ENDPOINT ties YESNO at 3 here; the section has no endpoint but answers the yes/no question
    expect(classify("can I route based on the Host header").scores).toMatchObject({ ENDPOINT: 3, YESNO: 3 });
    // (at the M4 coverage bar of 0.75 this question stops at gate 2 first, so gate 4 is tested with 0.5)
    expect(run("can I route based on the Host header", fastify, withWeights({ gates: { minCoverage: 0.5 } })).gate.ok).toBe(true);
  });

  it("gate 5: a single common word typed on its own is too broad", () => {
    expect(run("hooks").gate).toEqual({ ok: false, reason: 'too broad: "hook" is in 15% of sections' });
  });

  it("gate 5: a real question about a common word is not (Hono corpus: 'hono' is in 52% of sections)", () => {
    const hono = loadIndex(honoData);
    expect(run("hono", hono).gate).toEqual({ ok: false, reason: 'too broad: "hono" is in 52% of sections' });
    expect(run("What is Hono?", hono).gate.ok).toBe(true);
  });
});

// Gate 6 runs after extraction, in ask(), so it is tested through ask() rather than checkGates().
describe("gate 6: a DEFINITION answer has to define the thing", () => {
  const docs = loadDocsIndex(fastifyData);
  const off = loadDocsIndex(fastifyData, { weights: { gates: { definitionShape: 0 } } });

  it("blocks a rare word matched inside an identifier", () => {
    // "framework" matches the parts index of the heading `frameworkErrors`, and used to win by 3x on BM25
    const q = "what is fastify framework?";
    expect(off.ask(q)).toMatchObject({ confident: true, file: "Reference/Server.md", headingPath: ["Factory", "frameworkErrors"] });
    expect(docs.ask(q)).toMatchObject({ confident: false, reason: "DEFINITION question but the best section doesn't define it" });
  });

  it("lets a heading that names the thing through", () => {
    expect(docs.ask("What is encapsulation?")).toMatchObject({ confident: true, headingPath: ["Encapsulation"] });
  });

  it("lets a quote that reads like a definition through, whatever the heading says", () => {
    const idx = loadDocsIndex(buildIndex([parseDocument("g.md", "# Guide\n\n## Contexts\n\nA widget is a small piece of a page. Use one per card.\n")]));
    expect(idx.ask("what is a widget")).toMatchObject({ confident: true, text: expect.stringContaining("A widget is a small piece of a page.") });
  });

  it("is not fooled by a bare \"are\" in an unrelated sentence", () => {
    // the heading doesn't name the thing either, so only the quote could carry the definition, and it doesn't
    const idx = loadDocsIndex(buildIndex([parseDocument("g.md", "# Guide\n\n## Sending\n\nIf you are sending widgets, call send twice.\n")]));
    expect(idx.ask("what is a widget")).toMatchObject({ confident: false, reason: "DEFINITION question but the best section doesn't define it" });
  });
});
