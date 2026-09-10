// The one place MiniSearch is configured. MiniSearch doesn't serialize functions, so build and load
// must pass exactly these options (research.md section 7, "Serialization").
import type { Options } from "minisearch";
import type { QaSection } from "../core/types.ts";
import type { Synonyms } from "./synonyms.ts";
import { indexTerms } from "./text.ts";

export const FIELDS = ["heading", "headingPath", "prose", "code"] as const;

export const indexTokenizer = (syn: Synonyms) => (text: string) => indexTerms(syn.normPhrases(text)).map(syn.canon);

export function miniSearchOptions(syn: Synonyms): Options<QaSection> {
  return {
    idField: "id",
    fields: [...FIELDS],
    // No storeFields: sections live next to the index in SerializedIndex, so nothing gets spread onto
    // search results (a stored field called `score` once overwrote the real score).
    extractField: (doc, field) => (field === "headingPath" ? doc.headingPath.join(" ") : (doc as any)[field]),
    tokenize: indexTokenizer(syn),
    processTerm: (term) => term,
  };
}
