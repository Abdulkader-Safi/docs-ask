// Parses both vendored corpora and snapshots every section and unit line. A parser change shows up as a
// readable diff in <corpus>-outline.txt.
//   fastify: Fastify docs at v5.6.0 (MIT), the corpus research.md measured on
//   hono:    Hono website docs at c48b858 (MIT), the second corpus, VitePress-flavoured
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findDocs } from "../../src/node/index.ts";
import { parseDocument, toQaSections } from "../../src/parse/index.ts";

describe.each([
  ["fastify", 30, 559, 3810],
  ["hono", 87, 792, 3827],
])("%s corpus", async (name, fileCount, sectionCount, unitCount) => {
  const root = fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
  const files = await findDocs(root);
  const sections = files.flatMap((f) => toQaSections(parseDocument(f, readFileSync(join(root, f), "utf8"))));

  it("parses into the expected counts", () => {
    expect([files.length, sections.length, sections.reduce((n, s) => n + s.units.length, 0)]).toEqual([fileCount, sectionCount, unitCount]);
  });

  it("keeps every section and unit line stable", async () => {
    const outline = sections
      .map((s) => `${s.file}:${s.line}  ${[...s.headingPath, s.heading].join(" > ")}\n  ${s.units.map((u) => `${u.kind}@${u.line}`).join(" ")}`)
      .join("\n");
    await expect(outline + "\n").toMatchFileSnapshot(`./__snapshots__/${name}-outline.txt`);
  });
});
