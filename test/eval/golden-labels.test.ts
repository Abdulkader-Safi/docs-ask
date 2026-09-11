// Checks the golden sets themselves, without asking anything: every labelled section exists, questions
// don't repeat across sets, and the test split meets PRD section 2's size. Never runs ask() on TEST.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findDocs } from "../../src/node/index.ts";
import { parseDocument, toQaSections } from "../../src/parse/index.ts";
import { DEV, type Corpus, type Golden } from "./golden.ts";
import { TEST } from "./golden-test.ts";

const sectionKeys = async (corpus: Corpus) => {
  const root = fileURLToPath(new URL(`../fixtures/${corpus}`, import.meta.url));
  const files = await findDocs(root);
  return new Set(files.flatMap((f) => toQaSections(parseDocument(f, readFileSync(join(root, f), "utf8"))).map((s) => `${s.file}|${s.heading}`)));
};
const SECTIONS = { fastify: await sectionKeys("fastify"), hono: await sectionKeys("hono") };

describe.each([
  ["dev", DEV],
  ["test", TEST],
] as [string, Golden[]][])("%s set", (_name, set) => {
  it("labels only sections that exist in the question's corpus", () => {
    const missing = set.flatMap((g) => (g.accept ?? []).filter((a) => !SECTIONS[g.corpus ?? "fastify"].has(`${a.file}|${a.heading}`)).map((a) => `${g.q} -> ${a.file} | ${a.heading}`));
    expect(missing).toEqual([]);
  });

  it("gives answerable questions at least one accepted section, and unanswerable ones none", () => {
    expect(set.filter((g) => (g.unanswerable ? !!g.accept?.length : !g.accept?.length)).map((g) => g.q)).toEqual([]);
  });
});

describe("the sets together", () => {
  it("never repeat a question", () => {
    const all = [...DEV, ...TEST].map((g) => g.q.toLowerCase());
    expect(all.filter((q, i) => all.indexOf(q) !== i)).toEqual([]);
  });

  it.skipIf(TEST.length === 0)("meet the PRD's test split size: 60+ answerable and 8+ unanswerable, over both corpora", () => {
    const answerable = TEST.filter((g) => !g.unanswerable);
    expect(answerable.length).toBeGreaterThanOrEqual(60);
    expect(TEST.filter((g) => g.unanswerable).length).toBeGreaterThanOrEqual(8);
    expect(new Set(TEST.map((g) => g.corpus ?? "fastify"))).toEqual(new Set(["fastify", "hono"]));
  });
});
