// Parses all 30 Fastify doc files (v5.6.0, vendored with their MIT licence) and snapshots every
// section and unit line. A parser change shows up as a readable diff in fastify-outline.txt.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { parseDocument, toQaSections } from "../../src/parse/index.ts";

const ROOT = fileURLToPath(new URL("../fixtures/fastify", import.meta.url));
const files = readdirSync(ROOT, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".md"))
  .sort();
const sections = files.flatMap((f) => toQaSections(parseDocument(f, readFileSync(join(ROOT, f), "utf8"))));

it("parses the whole Fastify corpus into the counts research.md reports", () => {
  expect(files).toHaveLength(30);
  expect(sections).toHaveLength(559);
  expect(sections.reduce((n, s) => n + s.units.length, 0)).toBe(3810);
});

it("keeps every section and unit line stable", async () => {
  const outline = sections
    .map((s) => `${s.file}:${s.line}  ${[...s.headingPath, s.heading].join(" > ")}\n  ${s.units.map((u) => `${u.kind}@${u.line}`).join(" ")}`)
    .join("\n");
  await expect(outline + "\n").toMatchFileSnapshot("./__snapshots__/fastify-outline.txt");
});
