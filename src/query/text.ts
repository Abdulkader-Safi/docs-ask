import { stem } from 'porter2';

// Question-only stop words: removed from the QUERY, never from the index.
export const QUESTION_STOPWORDS = new Set((
  'a an the and or of to in on at for from by with about into over as ' +
  'i me my we our you your it its this that these those there here ' +
  'what whats which who whom whose where when why how ' +
  'do does did done doing is are was were be been being am ' +
  'can could should would will shall may might must ' +
  'have has had get gets got please tell show find ' +
  'use using used way ways need want trying try ' +
  'some any all one thing something possible able myself yourself ourselves'
).split(/\s+/));
// Words that look like stop words but carry the question's meaning in docs.
// Kept out of the list on purpose: not, no, without, only, default, before, after, first.

// Upper-case HTTP verbs survive stop-word removal ("GET /users"), lower-case "get" doesn't.
const HTTP_VERB_WORD = /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/;
const SHORT_KEEP = /^(?:[45]\d\d|[123]\d\d|id|ip|io|db|ui|os|js|ts|ci|cd|v\d+)$/i;

// Tokens that must survive as a single unit.
const SPECIAL = new RegExp([
  String.raw`(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)(?=\s+\/)`, // verb before a path
  String.raw`[a-z]+\/[a-z0-9.+-]+(?=[\s,.?!)]|$)`,                  // MIME types: text/csv, application/json
  String.raw`(?<![\w.])\/[A-Za-z0-9_{}:.\-]+(?:\/[A-Za-z0-9_{}:.\-]*)*`, // /auth/refresh and /api/v1/apps/:id, but not the /csv inside text/csv
  String.raw`--?[A-Za-z][\w-]*`,                                       // --force, -f
  String.raw`[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+(?:\(\))?`,         // fastify.register, reply.send()
  String.raw`[A-Za-z]+(?:_[A-Za-z0-9]+)+`,                             // snake_case, FST_ERR_X
  String.raw`[a-z]+(?:[A-Z][a-z0-9]*)+`,                               // camelCase
  String.raw`[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+`,                       // PascalCase
  String.raw`v?\d+(?:\.\d+)+`,                                         // 5.6.0
  String.raw`[A-Za-z0-9]+(?:'[a-z]+)?`,                                // plain words, numbers, don't
].join('|'), 'g');

export function splitIdentifier(tok: string): string[] {
  return tok
    .replace(/^--?/, '')
    .replace(/\(\)$/, '')
    .split(/[\/._\-{}:]+/)
    .flatMap(p => p.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').split(' '))
    .filter(Boolean);
}

export type Tok = { raw: string; norm: string; isCodeish: boolean };

export function rawTokens(text: string): Tok[] {
  const out: Tok[] = [];
  text = text.replace(/\b([1-5]\d\d)s\b/g, '$1'); // "404s" -> "404"
  text = text.replace(/\b(ca|wo|do|does|did|is|are|was|should|could|would)n't\b/gi, (_m, a) => `${a.toLowerCase() === 'ca' ? 'can' : a.toLowerCase() === 'wo' ? 'will' : a} not`);
  for (const m of text.matchAll(SPECIAL)) {
    const raw = m[0];
    const isCodeish = /[\/._]|[a-z][A-Z]|^--?[a-z]|[A-Z][a-z]+[A-Z]/.test(raw) && !/^v?\d+(?:\.\d+)+$/.test(raw);
    out.push({ raw, norm: raw.toLowerCase().replace(/\(\)$/, ''), isCodeish });
  }
  return out;
}

export function stemWord(w: string): string {
  return /^[a-z]+$/.test(w) && w.length > 3 ? stem(w) : w;
}

// Index-time: emit whole identifier + its stemmed parts. No stop word removal.
export function indexTerms(text: string): string[] {
  const terms: string[] = [];
  for (const t of rawTokens(text)) {
    if (t.isCodeish) {
      terms.push(t.norm);
      for (const p of splitIdentifier(t.raw)) terms.push(stemWord(p.toLowerCase()));
    } else {
      terms.push(stemWord(t.norm));
    }
  }
  return terms;
}

// Query-time: same, but drop question stop words (unless nothing would remain).
export function queryTerms(question: string): { terms: string[]; exact: string[] } {
  const toks = rawTokens(question);
  const exact = toks.filter(t => t.isCodeish || /^[45]\d\d$/.test(t.raw)).map(t => t.norm);
  let kept = toks.filter(t => t.isCodeish || HTTP_VERB_WORD.test(t.raw) || SHORT_KEEP.test(t.raw) || !QUESTION_STOPWORDS.has(t.norm));
  if (kept.length === 0) kept = toks;
  const terms = new Set<string>();
  for (const t of kept) {
    if (t.isCodeish) {
      terms.add(t.norm);
      for (const p of splitIdentifier(t.raw)) {
        const w = p.toLowerCase();
        if (!QUESTION_STOPWORDS.has(w)) terms.add(stemWord(w));
      }
    } else terms.add(stemWord(t.norm));
  }
  return { terms: [...terms], exact };
}
