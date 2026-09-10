// Question classification rules for software docs.
// ELIZA-style: every rule has weighted triggers; the highest total wins,
// ties broken by `rank`. Weight >= 3 is a "strong" trigger that can win alone.

export type { QClass };

import type { QClass, UnitKind } from '../core/types.ts';

export type AnswerShape =
  | 'steps'            // numbered list, else code block + lead sentence
  | 'definition'       // first 1-2 sentences under the matching heading
  | 'endpoint'         // line/sentence/code containing METHOD /path
  | 'fieldList'        // table rows, definition list or bullet list of params
  | 'valueSentence'    // single sentence containing a number/literal
  | 'location'         // file path + heading path only
  | 'fix'              // table row or sentence with "fix/solve/set/ensure"
  | 'code'             // the code block (+ sentence before it)
  | 'yesNoEvidence'    // one sentence that confirms or denies
  | 'contrast'         // sentence(s) mentioning both compared terms
  | 'snippet';         // best 1-2 sentences

export interface Trigger { re: RegExp; weight: number }

export interface Rule {
  id: QClass;
  rank: number;                     // tie-breaker, higher wins
  triggers: Trigger[];
  preferUnits: UnitKind[];        // in order of preference
  answerShape: AnswerShape;
  boosts: {
    headingTerms?: string[];        // add these (stemmed) to the query, heading field only
    sectionHas?: UnitKind[];       // multiply section score if it contains these blocks
    sectionHasFactor?: number;
    sentenceRe?: RegExp;            // bonus for sentences matching this
    sentenceBonus?: number;
  };
  maxSentences: number;
}

// Reusable fragments
const AUX = String.raw`(?:can|could|does|do|is|are|will|should|may|must|would|has|have)`;
const HTTP_VERB = String.raw`\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b`;
export const NUMBERISH =
  /(?:`[^`]*\d[^`]*`|\b\d+(?:[.,]\d+)?\s*(?:ms|s|sec|seconds?|minutes?|hours?|days?|kb|mb|gb|kib|mib|bytes?|%|px)?\b|\b(?:true|false|null|undefined|none|unlimited|infinity)\b)/i;

export const RULES: Rule[] = [
  {
    id: 'ERROR', rank: 100,
    triggers: [
      { re: /\b[45]\d\ds?\b/, weight: 3 },                                    // 401, 404, 500
      { re: /\b(?:E[A-Z]{3,}|[A-Z]+_ERR_[A-Z_]+|[A-Z][a-zA-Z]*(?:Error|Exception))\b/, weight: 4 }, // ECONNREFUSED, FST_ERR_X, TypeError
      { re: /\b(?:error|errors|exception|stack ?trace|crash(?:es|ing)?|fail(?:s|ed|ing|ure)?|broken|throws?)\b/i, weight: 3 },
      { re: /\b(?:not working|doesn'?t work|does not work|won'?t|can'?t connect|unable to|timed out|times out|hangs?|refused|denied|unauthori[sz]ed|forbidden)\b/i, weight: 3 },
      { re: /\bwhy (?:does|do|is|are|am|did|won'?t|can'?t|isn'?t|doesn'?t)\b/i, weight: 2 },
      { re: /\b(?:too (?:long|slow|many|large|big)|cut off|slow|stuck|freez\w*|hang(?:s|ing)?|leak\w*|missing|empty response|undefined|null)\b/i, weight: 2 },
      { re: /\b(?:fix|troubleshoot|debug|resolve|solve)\b/i, weight: 2 },
    ],
    preferUnits: ['tableRow', 'sentence', 'code', 'list'],
    answerShape: 'fix',
    boosts: {
      headingTerms: ['error', 'troubleshoot', 'faq', 'common', 'issue'],
      sentenceRe: /\b(?:fix|solve|resolv|make sure|ensure|check|increase|set|instead|because|caus|occur|thrown when)\w*/i,
      sentenceBonus: 0.3,
    },
    maxSentences: 2,
  },
  {
    id: 'COMPARISON', rank: 90,
    triggers: [
      { re: /\bdifferen(?:ce|t)s? between\b/i, weight: 5 },
      { re: /\b(?:vs\.?|versus|compared (?:to|with)|comparison)\b/i, weight: 5 },
      { re: /\b(?:instead of|rather than|better|prefer)\b/i, weight: 2 },
      { re: /\bwhen (?:should|do|would) (?:i|you|we) use\b.*\bor\b/i, weight: 4 },
      { re: /\bwhich (?:one|is better|should i (?:use|pick|choose))\b/i, weight: 3 },
    ],
    preferUnits: ['tableRow', 'sentence', 'list'],
    answerShape: 'contrast',
    boosts: {
      headingTerms: ['vs', 'versus', 'comparison', 'difference'],
      sentenceRe: /\b(?:whereas|while|unlike|instead|but|however|differ|compared|only)\b/i,
      sentenceBonus: 0.3,
    },
    maxSentences: 2,
  },
  {
    id: 'PARAMS', rank: 80,
    triggers: [
      { re: /\b(?:param(?:eter)?s?|arguments?|args|options|flags|fields|properties|props|attributes|keys|headers|query ?string|request body|payload|schema)\b/i, weight: 3 },
      { re: /\bwhat (?:does|do) .{1,40}\b(?:accept|take|expect|return)s?\b/i, weight: 3 },
      { re: /\b(?:required|optional) (?:fields?|params?|parameters?|arguments?)\b/i, weight: 4 },
      { re: /\bsignature\b/i, weight: 3 },
    ],
    preferUnits: ['tableRow', 'list', 'code', 'sentence'],
    answerShape: 'fieldList',
    boosts: {
      headingTerms: ['param', 'option', 'argument', 'field', 'propert'],
      sectionHas: ['tableRow', 'list'], sectionHasFactor: 1.3,
    },
    maxSentences: 1,
  },
  {
    id: 'ENDPOINT', rank: 70,
    triggers: [
      { re: /\b(?:endpoints?|routes?|urls?|uris?|api path|base url|webhook url)\b/i, weight: 3 },
      { re: /\bwhich (?:api|call|request|method)\b/i, weight: 3 },
      { re: new RegExp(String.raw`\bwhat (?:http )?(?:verb|method)\b|${HTTP_VERB}`), weight: 2 },
    ],
    preferUnits: ['code', 'sentence', 'tableRow', 'heading'],
    answerShape: 'endpoint',
    boosts: {
      headingTerms: ['endpoint', 'api', 'rout'],
      sentenceRe: new RegExp(String.raw`${HTTP_VERB}\s+\/|(?:^|\s|\x60)\/[a-z0-9_{}:.-]+(?:\/[a-z0-9_{}:.-]*)+`, 'i'),
      sentenceBonus: 0.6,
    },
    maxSentences: 1,
  },
  {
    id: 'VALUE', rank: 60,
    triggers: [
      { re: /\bwhat(?:'s| is| are)? (?:the )?(?:[\w-]+ )?(?:default|max(?:imum)?|min(?:imum)?|limit|size|port|version|value|timeout)s?\b/i, weight: 4 },
      { re: /\bhow (?:long|many|much|big|large|often|fast|old)\b/i, weight: 4 },
      { re: /\bdefaults?\b/i, weight: 2 },
      { re: /\b(?:limits?|maximum|minimum|max|min|timeouts?|ttl|expir(?:y|es|ation)|quota|port|size)\b/i, weight: 2 },
      { re: /\bwhen does .{1,40}\bexpire\b/i, weight: 4 },
    ],
    preferUnits: ['sentence', 'tableRow', 'list', 'code'],
    answerShape: 'valueSentence',
    boosts: {
      headingTerms: ['default', 'limit', 'config'],
      sentenceRe: /\bdefaults?(?: value)?\s*(?::|=|is|of|to)\s*`?[\w.'"-]+|\b(?:limit|max(?:imum)?|timeout|ttl) (?:is|of)\s+`?\d/i,
      sentenceBonus: 0.8,
    },
    maxSentences: 1,
  },
  {
    id: 'EXAMPLE', rank: 55,
    triggers: [
      { re: /\b(?:examples?|sample|snippet|demo)\b/i, weight: 4 },
      { re: /\bshow me\b/i, weight: 4 },
      { re: /\b(?:code|curl|command) (?:for|to)\b/i, weight: 3 },
    ],
    preferUnits: ['code', 'orderedList', 'sentence'],
    answerShape: 'code',
    boosts: { headingTerms: ['example', 'usag'], sectionHas: ['code'], sectionHasFactor: 1.5 },
    maxSentences: 1,
  },
  {
    id: 'LOCATION', rank: 50,
    triggers: [
      { re: /\bwhere (?:is|are|do|does|can|should|would)\b/i, weight: 4 },
      { re: /\bwhich (?:file|folder|directory|page|doc|section)\b/i, weight: 4 },
      { re: /\b(?:documented|located|defined|live[sd]?)\b/i, weight: 2 },
    ],
    preferUnits: ['heading', 'sentence'],
    answerShape: 'location',
    boosts: {
      sentenceRe: /(?:\x60[^\x60]*\/[^\x60]*\x60|\b[\w.-]+\.(?:json|ya?ml|toml|env|ts|js|md|config)\b|\b(?:in|under|inside) (?:the )?\x60)/i,
      sentenceBonus: 0.4,
    },
    maxSentences: 1,
  },
  {
    id: 'HOWTO', rank: 40,
    triggers: [
      { re: /\bhow (?:do|can|should|would) (?:i|we|you|one)\b/i, weight: 4 },
      { re: /\bhow to\b/i, weight: 4 },
      { re: /\b(?:steps? (?:to|for)|way to|guide (?:to|for)|walk ?through|tutorial)\b/i, weight: 4 },
      { re: /^(?:install|set ?up|configure|enable|disable|add|create|register|deploy|run|use|connect|migrate|upgrade)\b/i, weight: 3 }, // imperative queries
      { re: /\b(?:set ?up|install|configure|enable|disable|deploy|migrate|upgrade)\b/i, weight: 1 },
    ],
    preferUnits: ['orderedList', 'code', 'sentence', 'list'],
    answerShape: 'steps',
    boosts: {
      headingTerms: ['how', 'guid', 'get', 'start', 'usag', 'setup', 'install'],
      sectionHas: ['orderedList', 'code'], sectionHasFactor: 1.25,
      sentenceRe: /^(?:to |first|then|next|run|install|add|create|call|use|set|register|pass|import)\b/i,
      sentenceBonus: 0.2,
    },
    maxSentences: 2,
  },
  {
    id: 'YESNO', rank: 30,
    triggers: [
      { re: new RegExp(String.raw`^${AUX}\s+\w`, 'i'), weight: 3 },            // starts with an auxiliary verb
      { re: /\b(?:support(?:s|ed)?|possible|compatible|allowed|able to)\b/i, weight: 2 },
    ],
    preferUnits: ['sentence', 'tableRow'],
    answerShape: 'yesNoEvidence',
    boosts: {
      sentenceRe: /\b(?:supports?|can|cannot|can't|not|only|must|requires?|allows?|possible|available|deprecated|no longer)\b/i,
      sentenceBonus: 0.3,
    },
    maxSentences: 1,
  },
  {
    id: 'DEFINITION', rank: 20,
    triggers: [
      { re: /^(?:what|who)(?:'s| is| are)\b/i, weight: 3 },
      { re: /\bwhat (?:does|do) .{1,40}\b(?:mean|stand for|do)\b/i, weight: 4 },
      { re: /\b(?:define|definition of|meaning of|explain|overview of|purpose of)\b/i, weight: 4 },
      { re: /^(?:[\w.-]+)\??$/i, weight: 3 },                                 // single-term query: "hooks?"
    ],
    preferUnits: ['sentence'],
    answerShape: 'definition',
    boosts: {
      headingTerms: ['overview', 'introduct', 'what', 'concept'],
      sentenceRe: /\b(?:is an?|are|refers? to|means|represents|allows? you to|lets you|is used to|is the)\b/i,
      sentenceBonus: 0.4,
    },
    maxSentences: 2,
  },
  {
    id: 'FALLBACK', rank: 0, triggers: [],
    preferUnits: ['sentence', 'code', 'list', 'tableRow'],
    answerShape: 'snippet', boosts: {}, maxSentences: 2,
  },
];

export interface Classification { primary: Rule; secondary: Rule[]; scores: Record<string, number> }

export function classify(question: string): Classification {
  const q = question.trim();
  const scored = RULES.filter(r => r.id !== 'FALLBACK').map(r => ({
    rule: r,
    score: r.triggers.reduce((s, t) => s + (t.re.test(q) ? t.weight : 0), 0),
  }));
  const hits = scored.filter(x => x.score >= 3)
    .sort((a, b) => b.score - a.score || b.rule.rank - a.rule.rank);
  const fallback = RULES.find(r => r.id === 'FALLBACK')!;
  return {
    primary: hits[0]?.rule ?? fallback,
    secondary: hits.slice(1).map(h => h.rule),
    scores: Object.fromEntries(scored.map(x => [x.rule.id, x.score])),
  };
}

// Words the classifier already consumed (stemmed): they say what KIND of answer is wanted, not WHICH section
// holds it, so search weights them down and coverage leaves them out (research.md section 8).
export const TRIGGER_WORDS = new Set(['default', 'exampl', 'differ', 'between', 'vs', 'versus', 'error', 'fix', 'step', 'endpoint', 'paramet', 'option', 'mean', 'support', 'limit', 'document', 'locat', 'long', 'mani', 'much', 'big', 'often']);
