import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import MiniSearch from "minisearch";
import { describe, expect, it } from "vitest";
import { buildIndex, parseDocument } from "../../src/parse/index.ts";
import { FORMAT_VERSION, VERSION } from "../../src/core/version.ts";
import { miniSearchOptions } from "../../src/query/index-options.ts";
import { compileSynonyms, SYNONYMS } from "../../src/query/synonyms.ts";
import { findDocs } from "../../src/node/index.ts";

const FASTIFY = fileURLToPath(new URL("../fixtures/fastify", import.meta.url));
const fastifyDocs = (await findDocs(FASTIFY)).map((f) => parseDocument(f, readFileSync(join(FASTIFY, f), "utf8")));

describe("buildIndex", () => {
  const data = buildIndex(fastifyDocs);

  it("stamps the format and package version", () => {
    expect(data.formatVersion).toBe(FORMAT_VERSION);
    expect(data.packageVersion).toBe(VERSION);
    expect(new Date(data.builtAt).toISOString()).toBe(data.builtAt);
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(VERSION).toBe(pkg.version);
  });

  it("holds every Fastify section with its units, and the synonym table it was built with", () => {
    expect(data.sections).toHaveLength(559);
    expect(data.sections[0].units.length).toBeGreaterThan(0);
    expect(data.config.synonyms).toEqual(SYNONYMS);
    expect(JSON.stringify(data)).not.toContain('"blocks"'); // units only, no raw parser blocks
  });

  it("counts document frequency per term", () => {
    expect(data.df.bodylimit).toBeGreaterThan(1);
    expect(Object.values(data.df).every((n) => Number.isInteger(n) && n >= 1 && n <= 559)).toBe(true);
  });

  it("loads back into MiniSearch with the shared options, with nothing stored on results", () => {
    const ms = MiniSearch.loadJS(data.mini, miniSearchOptions(compileSynonyms(data.config.synonyms)));
    expect(ms.documentCount).toBe(559);
    const [hit] = ms.search("bodylimit", { tokenize: (s) => s.split(" "), processTerm: (t) => t });
    expect(Object.keys(hit).sort()).toEqual(["id", "match", "queryTerms", "score", "terms"]);
    expect(hit.id).toContain("bodylimit");
  });
});

describe("terms that collide with Object.prototype", () => {
  it("counts them as numbers", () => {
    const doc = parseDocument("js.md", "# Classes\n\nThe constructor runs first. Call toString on it.\n\n## More\n\nAnother constructor.\n");
    const { df } = buildIndex([doc]);
    expect(df.constructor).toBe(2);
    expect(df.tostring).toBe(1);
  });
});

describe("extra synonym groups", () => {
  it("are applied at build time and saved in the index", () => {
    const doc = parseDocument("logs.md", "# Logs\n\nHide passwords before logging.\n");
    const extra = { canonical: "redact", aliases: ["hide"], strict: true };
    const data = buildIndex([doc], { synonyms: [extra] });
    expect(data.config.synonyms.at(-1)).toEqual(extra);
    expect(data.df.redact).toBe(1);
    expect(data.df.hide).toBeUndefined();
  });
});
