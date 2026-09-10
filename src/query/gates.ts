// Decide whether to answer at all, before extracting anything (research.md section 11, gates 1 to 3).
// A wrong confident answer costs more than "not sure, here are the closest sections".
import type { LoadedIndex } from "./load.ts";
import type { QueryPlan, Ranked } from "./retrieve.ts";
import type { Weights } from "./weights.ts";

export type GateResult = { ok: true; gap: number; coverage: number } | { ok: false; reason: string; unknown?: string[] };

export function checkGates(idx: LoadedIndex, ranked: Ranked[], plan: QueryPlan, w: Weights): GateResult {
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
  return { ok: true, gap, coverage: top.idfCoverage };
}
