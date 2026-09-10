// The golden eval: accuracy is a test, run on every commit (research.md section 20).
// baseline.json holds the floors. After an intended improvement, run `vitest -u` to accept the new
// snapshot and raise baseline.json in the same commit.
import { describe, expect, it } from "vitest";
import { loadIndex } from "../../src/core/index.ts";
import { fastifyData } from "../helpers/fastify.ts";
import { honoData } from "../helpers/hono.ts";
import baseline from "./baseline.json" with { type: "json" };
import { DEV, HELDOUT, TUNED } from "./golden.ts";
import { evaluate, table } from "./metrics.ts";

const TOLERANCE = 0.02;
const docs = loadIndex(fastifyData);
const hono = loadIndex(honoData);

describe("tuned Fastify set", () => {
  const m = evaluate(docs, TUNED);

  it("reaches parity with the research prototype (PRD M3)", () => {
    expect(m.summary.top1).toBeGreaterThanOrEqual(0.69);
    expect(m.summary.recallAt3).toBeGreaterThanOrEqual(0.8);
    expect(m.rows.filter((r) => r.unanswerable && !r.confident)).toHaveLength(4);
  });

  it("doesn't fall below baseline.json", () => {
    for (const [k, min] of Object.entries(baseline)) {
      expect.soft(m.summary[k as keyof typeof m.summary], k).toBeGreaterThanOrEqual(min - TOLERANCE);
    }
  });

  it("never answers confidently when the docs have no answer", () => {
    expect(m.rows.filter((r) => r.unanswerable && r.confident).map((r) => r.q)).toEqual([]);
  });

  it("matches the committed per-question table", async () => {
    await expect(table(m.rows)).toMatchFileSnapshot("./__snapshots__/tuned.txt");
  });
});

describe("held-out Fastify set", () => {
  const m = evaluate(docs, HELDOUT, 5);

  // Not clean any more: the 404s question was read to find a bug (see golden.ts). The honest held-out
  // numbers stay 0.50 and 0.71; these check parity with the patched prototype.
  it("matches the prototype after the 10 Sep tokenizer fix", () => {
    expect(m.summary).toMatchObject({ top1: 0.571, recallAt3: 0.786, answerRate: 0.571, precisionWhenAnswered: 0.75, abstainOnUnanswerable: 1 });
  });

  it("matches the committed per-question table", async () => {
    await expect(table(m.rows)).toMatchFileSnapshot("./__snapshots__/heldout.txt");
  });
});

// Everything tuning may look at: Fastify (tuned + held-out) and the Hono dev questions.
describe("dev set, both corpora", () => {
  const m = evaluate({ fastify: docs, hono }, DEV);
  const byCorpus = (c: string) => evaluate({ fastify: docs, hono }, DEV.filter((g) => (g.corpus ?? "fastify") === c)).summary;

  it("reports its numbers", () => {
    console.log("dev", JSON.stringify(m.summary), "\n  fastify", JSON.stringify(byCorpus("fastify")), "\n  hono", JSON.stringify(byCorpus("hono")));
    expect(m.rows.filter((r) => r.unanswerable && r.confident).length).toBeLessThanOrEqual(2);
  });

  it("matches the committed per-question table", async () => {
    await expect(table(m.rows)).toMatchFileSnapshot("./__snapshots__/dev.txt");
  });
});

describe("speed", () => {
  it("answers in well under 20 ms at p95 (PRD section 2)", () => {
    const qs = [...TUNED, ...HELDOUT].map((g) => g.q);
    const times: number[] = [];
    for (let round = 0; round < 5; round++) {
      for (const q of qs) {
        const t = performance.now();
        docs.ask(q);
        times.push(performance.now() - t);
      }
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    console.log(`ask() on ${docs.sectionCount} sections: p50 ${times[Math.floor(times.length / 2)].toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`);
    expect(p95).toBeLessThan(20);
  });
});
