// The whole question pipeline: classify, retrieve and rerank, gate, then quote (research.md section 12).
import type { Answer, QaSection, SerializedIndex, Unit } from "../core/types.ts";
import { compare } from "./compare.ts";
import { pickUnits } from "./extract.ts";
import { checkGates } from "./gates.ts";
import { openIndex, type LoadedIndex } from "./load.ts";
import { planQuery, retrieve } from "./retrieve.ts";
import { classify } from "./rules.ts";
import { suggest } from "./suggest.ts";
import { withWeights, type WeightOverrides } from "./weights.ts";

export interface AskOptions {
  /** candidates to return (default WEIGHTS.candidates, 5) */
  topK?: number;
  /** tune without forking: any weight or threshold */
  weights?: WeightOverrides;
}

const quote = (units: Unit[]) => units.map((u) => (u.kind === "code" ? "```" + (u.lang ?? "") + "\n" + u.text + "\n```" : u.text)).join("\n");

export function ask(idx: LoadedIndex, question: string, options: AskOptions = {}): Answer {
  const w = withWeights(options.weights);
  const cls = classify(question);
  const rule = cls.primary;
  const plan = planQuery(idx, question);
  const ranked = retrieve(idx, plan, rule, w);
  const candidates = ranked.slice(0, options.topK ?? w.candidates).map(({ s, score }) => ({
    id: s.id,
    file: s.file,
    line: s.line,
    headingPath: [...s.headingPath, s.heading],
    score: +score.toFixed(2),
  }));
  const notSure = (reason: string, extra: Partial<Answer> = {}): Answer => ({ confident: false, qclass: rule.id, reason, candidates, ...extra });

  if (rule.id === "COMPARISON") {
    const both = compare(idx, question, w);
    if (both) return { ...both, qclass: rule.id, candidates };
  }
  const gate = checkGates(idx, ranked, plan, cls, w);
  if (!gate.ok) {
    const suggestions = [...new Set((gate.unknown ?? []).flatMap((t) => suggest(idx, t, w)))];
    return notSure(gate.reason, suggestions.length ? { suggestions } : {});
  }
  const sec = ranked[0].s;
  const picked = pickUnits(idx, sec, rule, plan, w);
  if ("noValue" in picked) return notSure("VALUE question but best section has no value", { file: sec.file, line: sec.line });

  const { units } = picked;
  const high = gate.coverage >= w.gates.highCoverage && gate.gap >= w.gates.highGap;
  return {
    confident: true,
    level: high ? "high" : "medium",
    qclass: rule.id,
    reason: `gap ${(gate.gap * 100).toFixed(0)}%, coverage ${gate.coverage.toFixed(2)}`,
    id: sec.id,
    file: sec.file,
    line: units[0]?.line ?? sec.line,
    endLine: units.at(-1)?.line ?? sec.line,
    headingPath: [...sec.headingPath, sec.heading],
    text: quote(units),
    units,
    candidates,
  };
}

/** A loaded index you can ask questions (PRD section 5). */
export class DocsIndex {
  readonly #idx: LoadedIndex;
  readonly #defaults: AskOptions;

  constructor(idx: LoadedIndex, defaults: AskOptions = {}) {
    this.#idx = idx;
    this.#defaults = defaults;
  }

  ask(question: string, options: AskOptions = {}): Answer {
    return ask(this.#idx, question, { ...this.#defaults, ...options });
  }

  /** a section by id, as returned in answers and candidates */
  get(id: string): QaSection | undefined {
    return this.#idx.byId.get(id);
  }

  /** near spellings of a term, as the docs spell them */
  suggest(term: string): string[] {
    return suggest(this.#idx, term, withWeights(this.#defaults.weights));
  }

  get sectionCount(): number {
    return this.#idx.sections.length;
  }
}

/** Load a serialized index (from docs-ask build or buildIndex) and get something to ask. */
export function loadIndex(data: SerializedIndex, options: AskOptions = {}): DocsIndex {
  return new DocsIndex(openIndex(data), options);
}
