// Parsed docs -> the serialized index the query side loads (PRD section 5, research.md section 7).
import MiniSearch from "minisearch";
import type { ParsedDoc, SerializedIndex, SynonymGroup } from "../core/types.ts";
import { FORMAT_VERSION, VERSION } from "../core/version.ts";
import { indexTokenizer, miniSearchOptions } from "../query/index-options.ts";
import { compileSynonyms, SYNONYMS } from "../query/synonyms.ts";
import { toQaSections } from "./units.ts";

export interface BuildOptions {
  /** extra synonym groups, added to the defaults */
  synonyms?: SynonymGroup[];
}

export function buildIndex(docs: ParsedDoc[], options: BuildOptions = {}): SerializedIndex {
  const groups = [...SYNONYMS, ...(options.synonyms ?? [])];
  const syn = compileSynonyms(groups);
  const sections = docs.flatMap(toQaSections);
  const ms = new MiniSearch(miniSearchOptions(syn));
  ms.addAll(sections);
  const tokenize = indexTokenizer(syn);
  // A Map, not an object: terms like "constructor" would otherwise hit Object.prototype.
  const df = new Map<string, number>();
  for (const s of sections) for (const t of new Set(tokenize(`${s.heading} ${s.prose} ${s.code}`))) df.set(t, (df.get(t) ?? 0) + 1);
  return {
    formatVersion: FORMAT_VERSION,
    packageVersion: VERSION,
    builtAt: new Date().toISOString(),
    sections,
    df: Object.fromEntries(df),
    mini: ms.toJSON(),
    config: { synonyms: groups },
  };
}
