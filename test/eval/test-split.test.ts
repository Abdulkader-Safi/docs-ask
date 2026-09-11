// The fresh frozen test split (golden-test.ts), measured against PRD section 2. First and only clean run:
// 11 Sep 2026 at 0293352, after all M4 tuning. It guards against regressions only; never tune on it.
import { describe, expect, it } from "vitest";
import { loadIndex } from "../../src/core/index.ts";
import { fastifyData } from "../helpers/fastify.ts";
import { honoData } from "../helpers/hono.ts";
import { TEST } from "./golden-test.ts";
import { evaluate, table } from "./metrics.ts";

const m = evaluate({ fastify: loadIndex(fastifyData), hono: loadIndex(honoData) }, TEST);
const s = m.summary;
// the first run's numbers: a later change may not fall below them
const FIRST_RUN = { top1: 0.417, recallAt3: 0.633, precisionWhenAnswered: 0.467, answerRate: 0.25, abstainOnUnanswerable: 1 };

describe("test split", () => {
  it("meets the PRD target for abstaining on unanswerable questions (0.90)", () => {
    expect(s.abstainOnUnanswerable).toBeGreaterThanOrEqual(0.9);
  });

  // Missed on the first run; see the M4 report. Each flips to failing (and needs updating) once met.
  it.fails("meets the PRD target for top-1 (0.55)", () => expect(s.top1).toBeGreaterThanOrEqual(0.55));
  it.fails("meets the PRD target for recall@3 (0.75)", () => expect(s.recallAt3).toBeGreaterThanOrEqual(0.75));
  it.fails("meets the PRD target for precision when answered (0.80)", () => expect(s.precisionWhenAnswered).toBeGreaterThanOrEqual(0.8));
  it.fails("meets the PRD target for answer rate (0.60)", () => expect(s.answerRate).toBeGreaterThanOrEqual(0.6));

  it("doesn't fall below its first run", () => {
    for (const [k, min] of Object.entries(FIRST_RUN)) expect.soft(s[k as keyof typeof s], k).toBeGreaterThanOrEqual(min - 0.02);
  });

  it("matches the committed per-question table", async () => {
    await expect(table(m.rows)).toMatchFileSnapshot("./__snapshots__/test-split.txt");
  });
});
