// Question -> ranked sections: BM25 through MiniSearch, then rule-aware rerank factors
// (research.md sections 7 and 9). Every factor fixed a real failure in the research prototype.
import type { QaSection } from "../core/types.ts";
import type { LoadedIndex } from "./load.ts";
import { TRIGGER_WORDS, type Rule } from "./rules.ts";
import { queryTerms } from "./text.ts";
import type { Weights } from "./weights.ts";

export interface QueryPlan {
  /** question terms after synonym rewriting, deduplicated */
  q: string[];
  /** identifiers, paths and status codes named in the question */
  exact: string[];
  /** q without trigger words: what the answer must be about */
  content: string[];
  /** q plus loose synonyms */
  expanded: string[];
  /** loose synonym -> the question term it was added for */
  origin: Map<string, string>;
  /** words the user typed, before any stop-word removal */
  words: number;
}

export interface Ranked {
  s: QaSection;
  score: number;
  /** IDF-weighted share of the content terms this section matched */
  idfCoverage: number;
}

export function planQuery(idx: LoadedIndex, question: string): QueryPlan {
  const { terms, exact } = queryTerms(idx.syn.normPhrases(question));
  const q = [...new Set(terms.map(idx.syn.canon))];
  const origin = new Map<string, string>();
  for (const t of q) for (const e of idx.syn.loose.get(t) ?? []) if (!q.includes(e) && !origin.has(e)) origin.set(e, t);
  return {
    q,
    exact,
    origin,
    content: q.filter((t) => !TRIGGER_WORDS.has(t)),
    expanded: [...new Set([...q, ...q.flatMap((t) => idx.syn.loose.get(t) ?? [])])],
    words: question.trim().split(/\s+/).filter(Boolean).length,
  };
}

export function retrieve(idx: LoadedIndex, plan: QueryPlan, rule: Rule, w: Weights): Ranked[] {
  const { q, exact, content, expanded } = plan;
  const original = new Set(q);
  const { termBoost: tb } = w.search;
  const results = idx.ms
    .search(expanded.join(" "), {
      tokenize: (s) => s.split(" "), // query terms are already processed
      processTerm: (t) => t,
      boost: w.search.fieldBoost,
      boostTerm: (t) => (exact.includes(t) ? tb.exact : TRIGGER_WORDS.has(t) ? tb.trigger : original.has(t) ? tb.original : tb.expansion),
      prefix: (t) => t.length > w.search.prefixAbove,
      fuzzy: (t) => (t.length > w.search.fuzzyAbove && !/[\/._]/.test(t) ? w.search.fuzzy : false), // never fuzz identifiers
      combineWith: "OR",
    })
    .slice(0, w.search.topN);

  const qIdf = content.reduce((a, t) => a + idx.idf(t), 0) || 1;
  const r = w.rerank;
  return results
    .map((res) => {
      const s = idx.byId.get(res.id)!;
      let score = res.score;
      const kinds = new Set(s.units.map((u) => u.kind));
      if (rule.boosts.sectionHas?.some((k) => kinds.has(k))) score *= rule.boosts.sectionHasFactor ?? r.sectionHasDefault;
      const headTerms = idx.tokenize(s.heading);
      if (rule.boosts.headingTerms?.some((h) => headTerms.some((t) => t.startsWith(h)))) score *= r.headingTerm;
      if (exact.some((e) => headTerms.includes(e))) score *= r.exactInHeading;
      // definition site: the identifier is the first cell of a table row or the start of a list item
      const definedHere = (e: string) =>
        s.units.some((u) => (u.kind === "tableRow" || u.kind === "list") && u.text.replace(/^[^:]*:\s*/, "").toLowerCase().startsWith(e));
      if (exact.some(definedHere)) score *= r.definitionSite;
      // API-signature headings (TypeScript reference) swamp plain questions
      if (!exact.length && /\(.*:.*\)/.test(s.heading)) score *= r.signaturePenalty;
      // the heading says exactly what was asked: Jaccard overlap of heading terms and question content terms
      const hs = new Set(headTerms);
      const inter = content.filter((t) => hs.has(t)).length;
      score *= 1 + r.jaccard * (inter / (hs.size + content.length - inter || 1));
      if (w.search.groupExpansions) {
        // MiniSearch multiplies by distinct terms matched; count a word and its synonyms as one
        const terms = res.queryTerms as string[];
        const groups = new Set(terms.map((t) => plan.origin.get(t) ?? t)).size;
        if (groups < terms.length) score *= groups / terms.length;
      }
      // a loose synonym that matched covers the question word it was added for
      const matched = new Set((res.queryTerms as string[]).map((t) => plan.origin.get(t) ?? t).filter((t) => content.includes(t)));
      const idfCoverage = [...matched].reduce((a, t) => a + idx.idf(t), 0) / qIdf;
      return { s, score, idfCoverage };
    })
    .sort((a, b) => b.score - a.score);
}
