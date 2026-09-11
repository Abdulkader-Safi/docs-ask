// Near spellings for an identifier the docs never mention (research.md section 11, gate 1).
import type { LoadedIndex } from "./load.ts";
import { rawTokens } from "./text.ts";
import type { Weights } from "./weights.ts";

// Index terms are lower case; answer with the spelling the docs use ("keepAliveTimeout").
const spellings = new WeakMap<LoadedIndex, Map<string, string>>();
function docSpelling(idx: LoadedIndex, term: string): string {
  let map = spellings.get(idx);
  if (!map) {
    map = new Map();
    for (const s of idx.sections)
      for (const text of [s.heading, s.prose, s.code])
        for (const t of rawTokens(text)) if (t.isCodeish && !map.has(t.norm)) map.set(t.norm, t.raw.replace(/\(\)$/, ""));
    spellings.set(idx, map);
  }
  return map.get(term) ?? term;
}

/** Levenshtein edit distance. */
export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

export function suggest(idx: LoadedIndex, term: string, w: Weights): string[] {
  const input = term.toLowerCase();
  // autoSuggest can merge several matching terms into one suggestion; take single terms, closest spelling first
  const hits = idx.ms.autoSuggest(input, { fuzzy: w.suggest.fuzzy, tokenize: (s) => [s], processTerm: (t) => t });
  const terms = [...new Set(hits.flatMap((h) => h.terms))].filter((t) => t !== input);
  terms.sort((a, b) => editDistance(a, input) - editDistance(b, input)); // stable: equal distances keep MiniSearch's order
  return [...new Set(terms.slice(0, w.suggest.max).map((t) => docSpelling(idx, t)))];
}
