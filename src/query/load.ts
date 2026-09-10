// SerializedIndex -> the internal searchable index (wrapped by DocsIndex). Runs in Node and the browser; the widget fetches the index file,
// so the shape is checked before anything trusts it.
import MiniSearch from "minisearch";
import type { QaSection, SerializedIndex } from "../core/types.ts";
import { FORMAT_VERSION, VERSION } from "../core/version.ts";
import { indexTokenizer, miniSearchOptions } from "./index-options.ts";
import { compileSynonyms, type Synonyms } from "./synonyms.ts";

export interface LoadedIndex {
  ms: MiniSearch<QaSection>;
  sections: QaSection[];
  byId: Map<string, QaSection>;
  /** a Map, not the stored object: terms like "constructor" would hit Object.prototype */
  df: Map<string, number>;
  syn: Synonyms;
  /** the index-time tokenizer (synonyms applied), for scoring headings and units */
  tokenize(text: string): string[];
  /** BM25 inverse document frequency of a term across all sections */
  idf(term: string): number;
  packageVersion: string;
  builtAt: string;
}

const majorMinor = (v: string) => v.split(".").slice(0, 2).join(".");

export function openIndex(data: SerializedIndex): LoadedIndex {
  if (!data || typeof data !== "object" || !Array.isArray(data.sections) || typeof data.mini !== "object" || !data.df || !data.config) {
    throw new Error("docs-ask: this is not a docs-ask index file. Rebuild it with docs-ask build.");
  }
  if (data.formatVersion !== FORMAT_VERSION || majorMinor(String(data.packageVersion)) !== majorMinor(VERSION)) {
    throw new Error(
      `docs-ask: this index was built by docs-ask ${data.packageVersion} (format ${data.formatVersion}), ` +
        `but this is docs-ask ${VERSION} (format ${FORMAT_VERSION}). Rebuild it with docs-ask build.`,
    );
  }
  const syn = compileSynonyms(data.config.synonyms);
  const ms = MiniSearch.loadJS(data.mini, miniSearchOptions(syn));
  const df = new Map(Object.entries(data.df));
  const N = data.sections.length;
  return {
    ms,
    sections: data.sections,
    byId: new Map(data.sections.map((s) => [s.id, s])),
    df,
    syn,
    tokenize: indexTokenizer(syn),
    idf: (t) => {
      const n = df.get(t) ?? 0;
      return Math.log(1 + (N - n + 0.5) / (n + 0.5));
    },
    packageVersion: data.packageVersion,
    builtAt: data.builtAt,
  };
}
