// Every scoring weight and threshold in the query pipeline, in one place so a sweep script can tune them
// (research.md sections 7 to 11). Per-rule numbers (trigger weights, sentence bonuses) live with the rules.
// Values are the research prototype's; don't change them without measuring on the dev split.
export const WEIGHTS = {
  search: {
    /** sections kept from MiniSearch before reranking */
    topN: 25,
    fieldBoost: { heading: 3, headingPath: 1.5, prose: 1, code: 0.6 },
    /** per-term boost: an identifier from the question, a question-type trigger word, an original term, a loose synonym */
    termBoost: { exact: 2, trigger: 0.3, original: 1, expansion: 0.4 },
    /** prefix-match terms longer than this */
    prefixAbove: 5,
    /** fuzzy-match terms longer than this (never identifiers) */
    fuzzyAbove: 6,
    fuzzy: 0.15,
  },
  rerank: {
    /** section has the unit kinds the question type prefers, when the rule sets no factor of its own */
    sectionHasDefault: 1.2,
    /** heading contains one of the rule's heading terms */
    headingTerm: 1.15,
    /** an identifier from the question is in the heading */
    exactInHeading: 1.5,
    /** an identifier starts a table row or list item (its definition site) */
    definitionSite: 1.4,
    /** no identifier in the question and the heading looks like a signature "(x: T)" */
    signaturePenalty: 0.5,
    /** score *= 1 + jaccard * (overlap of heading terms and question terms) */
    jaccard: 1,
  },
  unit: {
    coverage: 1.0,
    proximity: 0.3,
    position: 0.15,
    type: 1.0,
    lengthPenalty: 0.3,
    /** Luhn cluster: at most this many other words between significant ones */
    luhnGap: 4,
    /** coverage when the heading already matched every question term */
    neutralCoverage: 0.5,
    /** units shorter than this get `shortPenalty` unless they match the answer-type pattern */
    shortTokens: 4,
    shortPenalty: 0.5,
    /** units longer than this are penalised, up to 1 at twice the length */
    longTokens: 45,
    /** score *= 1 - kindStep * (position of the unit kind in the rule's preferred list) */
    kindStep: 0.1,
    defaultSentenceBonus: 0.3,
    /** most ordered-list items quoted for a HOWTO answer */
    maxSteps: 12,
  },
  gates: {
    /** IDF-weighted share of question terms the top section must match */
    minCoverage: 0.5,
    /** (top - second) / top below this is too close to call */
    minGap: 0.05,
    /** ...and below this, too close unless coverage reaches softCoverage */
    softGap: 0.15,
    softCoverage: 0.75,
    /** a confident answer is "high" at this coverage and gap, otherwise "medium" */
    highCoverage: 0.9,
    highGap: 0.3,
    /** gate 5: a one-term question whose term is in more than this share of sections... */
    broadShare: 0.05,
    /** ...and whose top two are closer than this, is navigation, not a question */
    broadGap: 0.3,
  },
  suggest: {
    /** MiniSearch fuzziness for near spellings of an unknown identifier */
    fuzzy: 0.2,
    /** most suggestions returned */
    max: 3,
  },
  /** candidates returned with every answer */
  candidates: 5,
};

export type Weights = typeof WEIGHTS;
export type WeightOverrides = { [G in keyof Weights]?: Weights[G] extends object ? Partial<Weights[G]> : Weights[G] };

/** WEIGHTS with some values replaced, one group at a time. */
export function withWeights(overrides: WeightOverrides = {}): Weights {
  const out = structuredClone(WEIGHTS) as any;
  for (const [group, value] of Object.entries(overrides)) {
    out[group] = typeof value === "object" && value !== null ? { ...out[group], ...value } : value;
  }
  return out;
}
