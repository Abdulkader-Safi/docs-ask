import { stemWord } from './text.ts';

// Hand-made alias table. `canonical` is what gets indexed.
// strict: true  -> canonicalize at index AND query time (true synonyms)
// strict: false -> expand at query time only, with lower weight (related terms)
import type { SynonymGroup } from '../core/types.ts';
export type { SynonymGroup };

export const SYNONYMS: SynonymGroup[] = [
  { canonical: 'login',   aliases: ['log in', 'sign in', 'signin', 'logon', 'authenticate', 'authentication', 'auth'], strict: true },
  { canonical: 'logout',  aliases: ['log out', 'sign out', 'signout'], strict: true },
  { canonical: 'signup',  aliases: ['sign up', 'register account', 'create account'], strict: true },
  { canonical: 'config',  aliases: ['configuration', 'configure', 'settings', 'setting', 'options'], strict: false },
  { canonical: 'delete',  aliases: ['remove', 'destroy', 'drop', 'erase'], strict: false },
  { canonical: 'create',  aliases: ['add', 'new', 'make', 'insert'], strict: false },
  { canonical: 'update',  aliases: ['edit', 'modify', 'change', 'patch'], strict: false },
  { canonical: 'install', aliases: ['set up', 'setup', 'installation'], strict: false },
  { canonical: 'env',     aliases: ['environment variable', 'environment variables', 'env var', 'env vars'], strict: true },
  { canonical: 'token',   aliases: ['access token', 'jwt', 'bearer token'], strict: false },
  { canonical: 'error',   aliases: ['exception', 'failure', 'fault'], strict: false },
  { canonical: 'db',      aliases: ['database'], strict: true },
  { canonical: 'repo',    aliases: ['repository'], strict: true },
];

/** A synonym table compiled for the tokenizer. Build it once and share it between index and query. */
export interface Synonyms {
  /** rewrite strict multi-word aliases ("sign in") to their canonical word, before tokenizing */
  normPhrases(text: string): string;
  /** map a strict single-word alias (stemmed) to its canonical term */
  canon(term: string): string;
  /** loose groups: stemmed term -> related stemmed terms, added to the query at low weight */
  loose: Map<string, string[]>;
}

// Same rules as the research prototype: strict aliases are rewritten at index and query time, loose
// ones only expand the query. Loose multi-word aliases are skipped (they'd need phrase matching).
export function compileSynonyms(groups: SynonymGroup[] = SYNONYMS): Synonyms {
  const phraseRules: [RegExp, string][] = [];
  const strictMap = new Map<string, string>();
  const loose = new Map<string, string[]>();
  for (const g of groups) {
    const c = stemWord(g.canonical);
    for (const a of g.aliases) {
      if (a.includes(' ')) { if (g.strict) phraseRules.push([new RegExp(`\\b${a}\\b`, 'gi'), g.canonical]); continue; }
      const s = stemWord(a);
      if (g.strict) strictMap.set(s, c);
      else loose.set(s, [...(loose.get(s) ?? []), c]);
    }
    if (!g.strict) loose.set(c, [...(loose.get(c) ?? []), ...g.aliases.filter(a => !a.includes(' ')).map(stemWord)]);
  }
  return {
    normPhrases: (t) => phraseRules.reduce((acc, [re, c]) => acc.replace(re, c), t),
    canon: (term) => strictMap.get(term) ?? term,
    loose,
  };
}
