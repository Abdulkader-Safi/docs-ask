// Pick the one or two answer units inside the winning section (research.md section 10).
import type { QaSection, Unit, UnitKind } from "../core/types.ts";
import type { LoadedIndex } from "./load.ts";
import type { QueryPlan } from "./retrieve.ts";
import { NUMBERISH, TRIGGER_WORDS, type Rule } from "./rules.ts";
import type { Weights } from "./weights.ts";

/**
 * Luhn (1958): a cluster is a run of significant words with at most `gap` other words between them;
 * its factor is (significant words)^2 / span. Returns the best cluster's factor.
 */
export function luhn(sig: boolean[], gap: number): number {
  let best = 0, start = -1, last = -1, count = 0;
  sig.forEach((isSig, i) => {
    if (!isSig) return;
    if (start === -1 || i - last - 1 > gap) { start = i; count = 0; }
    count++;
    last = i;
    best = Math.max(best, (count * count) / (last - start + 1));
  });
  return best;
}

/** How well one unit answers: coverage of the terms the heading didn't already match, nearness, position, answer type, length. */
export function scoreUnit(idx: LoadedIndex, text: string, q: string[], rule: Rule, posInSection: number, headingTerms: string[], w: Weights) {
  const u = w.unit;
  const toks = idx.tokenize(text);
  // residual query: terms the heading already answered don't need repeating in the unit
  const residual = q.filter((t) => !headingTerms.includes(t) && !TRIGGER_WORDS.has(t));
  const qset = new Set(residual);
  const present = new Set(toks.filter((t) => qset.has(t)));
  const total = residual.reduce((s, t) => s + idx.idf(t), 0) || 1;
  const coverage = residual.length ? [...present].reduce((s, t) => s + idx.idf(t), 0) / total : u.neutralCoverage;
  const proximity = Math.min(1, luhn(toks.map((t) => qset.has(t)), u.luhnGap) / Math.max(1, residual.length));
  const position = 1 / (1 + posInSection);
  const type = rule.boosts.sentenceRe?.test(text) ? (rule.boosts.sentenceBonus ?? u.defaultSentenceBonus) : 0;
  const n = toks.length;
  const lengthPenalty = n < u.shortTokens && !type ? u.shortPenalty : n > u.longTokens ? Math.min(1, (n - u.longTokens) / u.longTokens) : 0;
  const score = u.coverage * coverage + u.proximity * proximity + u.position * position + u.type * type - u.lengthPenalty * lengthPenalty;
  return { score, coverage, proximity, position, type, lengthPenalty };
}

export type Picked = { units: Unit[] } | { noValue: true };

export function pickUnits(idx: LoadedIndex, sec: QaSection, rule: Rule, plan: QueryPlan, w: Weights): Picked {
  if (rule.answerShape === "location") return { units: [] }; // file and heading path only
  const want: UnitKind | null = rule.answerShape === "code" ? "code" : rule.answerShape === "steps" ? "orderedList" : null;
  if (want && sec.units.some((u) => u.kind === want)) {
    const i = sec.units.findIndex((u) => u.kind === want);
    const lead = sec.units.slice(0, i).reverse().find((u) => u.kind === "sentence");
    const body = sec.units.filter((u) => u.kind === want).slice(0, want === "code" ? 1 : w.unit.maxSteps);
    return { units: [...(lead ? [lead] : []), ...body] };
  }
  let pool = sec.units.filter((u) => u.kind !== "heading" && rule.preferUnits.includes(u.kind));
  // a value is a number or literal, or a "default is `X`" sentence (string defaults such as `"Secure Area"`)
  const hasValue = (u: Unit) => NUMBERISH.test(u.text) || rule.boosts.sentenceRe!.test(u.text);
  if (rule.id === "VALUE" && !pool.some(hasValue)) return { noValue: true };
  // research.md: a VALUE answer is a sentence or item containing a value. "The minimum size in bytes to
  // compress. Defaults to 1024 bytes." is one line; without this the first sentence won on word overlap.
  if (rule.id === "VALUE") pool = pool.filter(hasValue);
  const headingTerms = idx.tokenize(sec.heading);
  const scored = pool
    .map((u, i) => ({ u, total: scoreUnit(idx, u.text, plan.q, rule, i, headingTerms, w).score * (1 - rule.preferUnits.indexOf(u.kind) * w.unit.kindStep) }))
    .sort((a, b) => b.total - a.total);
  // an identifier from the question must appear in the unit, unless the heading already names it
  const needExact = plan.exact.filter((e) => !headingTerms.includes(e));
  const withExact = scored.filter((x) => needExact.some((e) => x.u.text.toLowerCase().includes(e)));
  const ranked = withExact.length ? withExact : scored;
  const n = ranked[0]?.u.kind === "tableRow" ? 1 : rule.maxSentences; // a table-row answer is always one row
  return { units: ranked.slice(0, n).map((x) => x.u).sort((a, b) => a.line - b.line) };
}
