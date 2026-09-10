// COMPARISON questions: one lookup per side, one quoted sentence each (research.md section 8).
import type { Answer } from "../core/types.ts";
import { pickUnits } from "./extract.ts";
import { checkGates } from "./gates.ts";
import type { LoadedIndex } from "./load.ts";
import { planQuery, retrieve } from "./retrieve.ts";
import { classify, RULES, type Rule } from "./rules.ts";
import type { Weights } from "./weights.ts";

const CMP = [
  /\b(?:difference|differences|diff)\s+between\s+(.+?)\s+(?:and|vs\.?|versus|or)\s+(.+?)\s*\??$/i,
  /^(.+?)\s+(?:vs\.?|versus|compared (?:to|with))\s+(.+?)\s*\??$/i,
  /\bshould i use\s+(.+?)\s+or\s+(.+?)\s*\??$/i,
];

/** "difference between onRequest and preHandler" -> ["onRequest", "preHandler"] */
export function splitComparison(q: string): [string, string] | null {
  for (const re of CMP) {
    const m = q.match(re);
    if (m) return [m[1].trim(), m[2].trim()];
  }
  return null;
}

type Part = NonNullable<Answer["parts"]>[number];

// Each side is really "what is X?", so it's looked up and quoted as a DEFINITION.
const DEFINITION = RULES.find((r) => r.id === "DEFINITION")!;

/** One side, looked up on its own: the best section and its best unit, or null if the gates say no. */
function lookUpSide(idx: LoadedIndex, side: string, rule: Rule, w: Weights): { part: Part; gap: number; coverage: number } | null {
  const plan = planQuery(idx, side);
  // one common word ("return") is too vague to look up on its own (the gate 5 rule)
  if (plan.q.length === 1 && (idx.df.get(plan.q[0]) ?? 0) / idx.sections.length > w.gates.broadShare) return null;
  const ranked = retrieve(idx, plan, rule, w);
  const gate = checkGates(idx, ranked, plan, classify(side), w);
  if (!gate.ok) return null;
  const sec = ranked[0].s;
  // a sentence ending in ":" introduces a code block and says nothing on its own
  const quotable = { ...sec, units: sec.units.filter((u) => !(u.kind === "sentence" && u.text.endsWith(":"))) };
  const picked = pickUnits(idx, quotable, { ...rule, maxSentences: 1 }, plan, w);
  if (!("units" in picked) || !picked.units.length) return null;
  const [u] = picked.units;
  return { part: { id: sec.id, file: sec.file, line: u.line, headingPath: [...sec.headingPath, sec.heading], text: u.text }, gap: gate.gap, coverage: gate.coverage };
}

/** Both sides answered from two different sections, or null to fall back to a single lookup. */
export function compare(idx: LoadedIndex, question: string, w: Weights): Omit<Answer, "candidates" | "qclass"> | null {
  const sides = splitComparison(question);
  if (!sides) return null;
  const [a, b] = sides.map((s) => lookUpSide(idx, s, DEFINITION, w));
  if (!a || !b || a.part.id === b.part.id) return null;
  const high = [a, b].every((x) => x.coverage >= w.gates.highCoverage && x.gap >= w.gates.highGap);
  return {
    confident: true,
    level: high ? "high" : "medium",
    reason: `comparison: ${sides[0]} gap ${(a.gap * 100).toFixed(0)}%, ${sides[1]} gap ${(b.gap * 100).toFixed(0)}%`,
    id: a.part.id,
    file: a.part.file,
    line: a.part.line,
    endLine: a.part.line,
    headingPath: a.part.headingPath,
    text: `${a.part.text}\n${b.part.text}`,
    parts: [a.part, b.part],
  };
}
