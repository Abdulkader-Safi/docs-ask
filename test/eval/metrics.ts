// Accuracy metrics from research.md section 20. `rank` is the position of the first accepted section
// among the candidates (0 when it isn't there).
import type { Answer, DocsIndex } from "../../src/core/index.ts";
import { classify } from "../../src/query/rules.ts";
import type { Corpus, Golden } from "./golden.ts";

export interface Row { corpus: Corpus; q: string; rank: number; confident: boolean; answerOk: boolean; classOk: boolean; unanswerable: boolean; answer: Answer }

const accepted = (g: Golden, file?: string, heading?: string) => !!g.accept?.some((a) => a.file === file && a.heading === heading);

/** `docs` is one index, or one per corpus for sets that span both. */
export function evaluate(docs: DocsIndex | Record<Corpus, DocsIndex>, golden: Golden[], k = 10) {
  const pick = (g: Golden) => ("ask" in docs ? docs : docs[g.corpus ?? "fastify"]) as DocsIndex;
  const rows: Row[] = golden.map((g) => {
    const a = pick(g).ask(g.q, { topK: k });
    const rank = g.unanswerable ? 0 : a.candidates.findIndex((c) => accepted(g, c.file, c.headingPath.at(-1))) + 1;
    const answerOk = g.unanswerable
      ? !a.confident
      : a.confident &&
        // a comparison answer quotes two sections; it counts if either is an accepted one
        (a.parts ?? [a]).some((p) => accepted(g, p.file, p.headingPath?.at(-1))) &&
        (!g.contains || !!a.text?.includes(g.contains));
    return { corpus: g.corpus ?? "fastify", q: g.q, rank, confident: a.confident, answerOk, classOk: !g.qclass || classify(g.q).primary.id === g.qclass, unanswerable: !!g.unanswerable, answer: a };
  });
  const ans = rows.filter((r) => !r.unanswerable);
  const una = rows.filter((r) => r.unanswerable);
  const answered = ans.filter((r) => r.confident);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const round = (x: number) => Math.round(x * 1000) / 1000;
  return {
    rows,
    summary: {
      top1: round(mean(ans.map((r) => (r.rank === 1 ? 1 : 0)))),
      recallAt3: round(mean(ans.map((r) => (r.rank >= 1 && r.rank <= 3 ? 1 : 0)))),
      mrr: round(mean(ans.map((r) => (r.rank ? 1 / r.rank : 0)))),
      /** confident and right */
      answerAccuracy: round(mean(ans.map((r) => (r.answerOk ? 1 : 0)))),
      /** of the answers given, how many were right */
      precisionWhenAnswered: round(mean(answered.map((r) => (r.answerOk ? 1 : 0)))),
      answerRate: round(answered.length / (ans.length || 1)),
      abstainOnUnanswerable: round(mean(una.map((r) => (r.answerOk ? 1 : 0)))),
      classifierAccuracy: round(mean(rows.map((r) => (r.classOk ? 1 : 0)))),
    },
  };
}

/** One readable line per question, for the committed snapshot. */
export const table = (rows: Row[]) =>
  rows
    .map((r) => {
      const a = r.answer;
      const where = a.confident ? `${a.file}:${a.line} ${a.headingPath!.at(-1)}` : a.reason;
      return `${r.answerOk ? "ok  " : "FAIL"} rank=${r.rank} ${r.confident ? "ans" : "abs"} [${r.corpus}] ${r.q}\n     -> ${where}`;
    })
    .join("\n") + "\n";
