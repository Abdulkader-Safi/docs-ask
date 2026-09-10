// Decide whether to answer at all, before extracting anything (research.md section 11, gates 1 to 5).
// A wrong confident answer costs more than "not sure, here are the closest sections".
import type { LoadedIndex } from "./load.ts";
import type { QueryPlan, Ranked } from "./retrieve.ts";
import type { Classification } from "./rules.ts";
import type { Weights } from "./weights.ts";

export type GateResult = { ok: true; gap: number; coverage: number } | { ok: false; reason: string; unknown?: string[] };

export function checkGates(idx: LoadedIndex, ranked: Ranked[], plan: QueryPlan, cls: Classification, w: Weights): GateResult {
  const rule = cls.primary;
  const [top, second] = ranked;
  if (!top) return { ok: false, reason: "no matching section" };

  // 1. the question names an identifier the docs never mention
  const unknown = plan.exact.filter((e) => !idx.df.has(e));
  if (unknown.length) return { ok: false, reason: `not found in docs: ${unknown.join(", ")}`, unknown };

  // A parent or child of the top section, in the same file, isn't a competitor: the gap counts as 100%.
  // ponytail: same as the prototype, which doesn't go on to compare with the third section.
  const related =
    !!second && second.s.file === top.s.file && (second.s.headingPath.includes(top.s.heading) || top.s.headingPath.includes(second.s.heading));
  const gap = second && !related ? (top.score - second.score) / top.score : 1;
  const g = w.gates;

  // 2. the top section misses too much of what was asked
  if (top.idfCoverage < g.minCoverage) return { ok: false, reason: `weak term coverage (${top.idfCoverage.toFixed(2)})` };
  // 3. the top two are too close to call
  if (gap < g.minGap || (gap < g.softGap && top.idfCoverage < g.softCoverage)) {
    return { ok: false, reason: `ambiguous: top two within ${(gap * 100).toFixed(0)}%` };
  }
  // 4. the question type needs evidence the section doesn't have (VALUE is checked while picking units).
  // Only when the type is clear: "can I route by Host header" ties ENDPOINT with YESNO and isn't an endpoint question.
  const typeIsClear = !cls.secondary.some((r) => cls.scores[r.id] === cls.scores[rule.id]);
  if (typeIsClear && rule.id === "EXAMPLE" && !top.s.units.some((u) => u.kind === "code")) {
    return { ok: false, reason: "EXAMPLE question but best section has no code" };
  }
  if (typeIsClear && rule.id === "ENDPOINT" && !top.s.units.some((u) => rule.boosts.sentenceRe!.test(u.text))) {
    return { ok: false, reason: "ENDPOINT question but best section names no endpoint" };
  }
  // 5. a single common word typed on its own ("hooks") is navigation, not a question
  if (plan.words === 1 && plan.q.length === 1 && (idx.df.get(plan.q[0]) ?? 0) / idx.sections.length > g.broadShare && gap < g.broadGap) {
    return { ok: false, reason: `too broad: "${plan.q[0]}" is in ${Math.round((100 * idx.df.get(plan.q[0])!) / idx.sections.length)}% of sections` };
  }
  return { ok: true, gap, coverage: top.idfCoverage };
}
