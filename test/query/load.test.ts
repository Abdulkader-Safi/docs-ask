import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import MiniSearch from "minisearch";
import { afterAll, describe, expect, it } from "vitest";
import { VERSION } from "../../src/core/index.ts";
import { openIndex as loadIndex } from "../../src/query/load.ts";
import { findDocs, readIndex, writeIndex } from "../../src/node/index.ts";
import { buildIndex, parseDocument, toQaSections } from "../../src/parse/index.ts";
import { miniSearchOptions } from "../../src/query/index-options.ts";
import { compileSynonyms } from "../../src/query/synonyms.ts";
import { queryTerms } from "../../src/query/text.ts";

const FASTIFY = new URL("../fixtures/fastify/", import.meta.url).pathname;
const docs = (await findDocs(FASTIFY)).map((f) => parseDocument(f, readFileSync(join(FASTIFY, f), "utf8")));
const data = buildIndex(docs);
const tmp = mkdtempSync(join(tmpdir(), "docs-ask-index-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const QUESTIONS = [
  "what is the default bodyLimit",
  "how do I set a different log level for one route",
  "FST_ERR_CTP_BODY_TOO_LARGE",
  "how do I sign in with a token", // strict synonym
  "how do I remove a route", // loose synonym
];
// Search the way ask() will: processed query terms, the section 7 field boosts.
const search = (ms: MiniSearch<any>, q: string) => {
  const syn = compileSynonyms(data.config.synonyms);
  const terms = [...new Set(queryTerms(syn.normPhrases(q)).terms.map(syn.canon))];
  return ms
    .search(terms.join(" "), {
      tokenize: (s) => s.split(" "),
      processTerm: (t) => t,
      boost: { heading: 3, headingPath: 1.5, prose: 1, code: 0.6 },
      combineWith: "OR",
    })
    .slice(0, 10)
    .map((r) => `${r.id} ${r.score.toFixed(9)}`);
};

describe("round trip", () => {
  const live = new MiniSearch(miniSearchOptions(compileSynonyms(data.config.synonyms)));
  live.addAll(docs.flatMap(toQaSections));

  it("gives the same results as a MiniSearch that was never serialized", () => {
    const loaded = loadIndex(data);
    for (const q of QUESTIONS) expect(search(loaded.ms, q), q).toEqual(search(live, q));
  });

  it.each([["docs-index.json"], ["docs-index.json.gz"]])("survives writing to %s and reading back", async (name) => {
    const path = join(tmp, name);
    const bytes = await writeIndex(data, path);
    expect(bytes).toBeGreaterThan(0);
    const back = loadIndex(await readIndex(path));
    for (const q of QUESTIONS) expect(search(back.ms, q), q).toEqual(search(live, q));
    expect(back.sections).toEqual(data.sections);
    expect(back.idf("bodylimit")).toBe(loadIndex(data).idf("bodylimit"));
  });

  it("gzips on request and reads gzip by content, not by name", async () => {
    const path = join(tmp, "plain-name.json");
    const gz = await writeIndex(data, path, { gzip: true });
    expect(gz).toBeLessThan(JSON.stringify(data).length / 3);
    expect(loadIndex(await readIndex(path)).sections).toHaveLength(559);
  });
});

describe("the loaded index", () => {
  const idx = loadIndex(data);

  it("finds sections by id and computes IDF", () => {
    expect(idx.byId.get("Reference/Server.md#bodylimit")?.heading).toBe("bodyLimit");
    expect(idx.idf("bodylimit")).toBeGreaterThan(idx.idf("the"));
    expect(idx.idf("never-seen")).toBeGreaterThan(idx.idf("bodylimit"));
  });

  it("reads df back into a Map, so 'constructor' is a count", async () => {
    const doc = parseDocument("js.md", "# Classes\n\nThe constructor runs first.\n");
    const path = join(tmp, "proto.json");
    await writeIndex(buildIndex([doc]), path);
    const loaded = loadIndex(await readIndex(path));
    expect(loaded.df.get("constructor")).toBe(1);
    expect(loaded.df.get("tostring")).toBeUndefined();
  });
});

describe("version checks", () => {
  it("accepts a different patch version", () => {
    expect(() => loadIndex({ ...data, packageVersion: VERSION.replace(/\d+$/, "99") })).not.toThrow();
  });

  it("refuses a different minor version, and says how to fix it", () => {
    expect(() => loadIndex({ ...data, packageVersion: "0.2.0" })).toThrow(
      `docs-ask: this index was built by docs-ask 0.2.0 (format 1), but this is docs-ask ${VERSION} (format 1). Rebuild it with docs-ask build.`,
    );
  });

  it("refuses a different format version", () => {
    expect(() => loadIndex({ ...data, formatVersion: 2 })).toThrow(/format 2\).*Rebuild it with docs-ask build/);
  });

  it("refuses something that isn't an index", () => {
    expect(() => loadIndex({} as any)).toThrow("docs-ask: this is not a docs-ask index file. Rebuild it with docs-ask build.");
    expect(() => loadIndex(null as any)).toThrow(/not a docs-ask index/);
  });
});
