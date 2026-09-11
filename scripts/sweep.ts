// Grid search of the gate thresholds on the DEV golden set (research.md section 11, "Calibrate the thresholds").
// Never runs the test split. Usage: node scripts/sweep.ts [--min-answer-rate 0.65]
//
// Picks the best precision when answered, subject to every unanswerable question abstaining and a
// minimum answer rate. research.md suggests 0.8; the default here is 0.65, a margin over the PRD's
// test-split target of 0.60, because precision (target 0.80) is the number still short.
import { parseArgs } from "node:util";
import { loadIndex } from "../src/core/index.ts";
import { fastifyData } from "../test/helpers/fastify.ts";
import { honoData } from "../test/helpers/hono.ts";
import { DEV } from "../test/eval/golden.ts";
import { evaluate } from "../test/eval/metrics.ts";

const { values } = parseArgs({ options: { "min-answer-rate": { type: "string", default: "0.65" } } });
const minAnswerRate = Number(values["min-answer-rate"]);
const range = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => +(from + i * step).toFixed(2));

const rows = [];
for (const minCoverage of range(0.3, 0.8, 0.05)) {
  for (const minGap of [0.02, 0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3]) {
    const weights = { gates: { minCoverage, minGap } };
    const s = evaluate({ fastify: loadIndex(fastifyData, { weights }), hono: loadIndex(honoData, { weights }) }, DEV).summary;
    rows.push({ minCoverage, minGap, ...s });
  }
}
const ok = rows.filter((r) => r.abstainOnUnanswerable === 1 && r.answerRate >= minAnswerRate);
ok.sort((a, b) => b.precisionWhenAnswered - a.precisionWhenAnswered || b.answerRate - a.answerRate);
console.table(ok.slice(0, 12).map(({ minCoverage, minGap, precisionWhenAnswered, answerRate, answerAccuracy, top1, recallAt3 }) => ({ minCoverage, minGap, precisionWhenAnswered, answerRate, answerAccuracy, top1, recallAt3 })));
const best = ok[0];
console.log(best ? `best: minCoverage ${best.minCoverage}, minGap ${best.minGap} -> precision ${best.precisionWhenAnswered}, answer rate ${best.answerRate}` : "no setting meets the constraints");
