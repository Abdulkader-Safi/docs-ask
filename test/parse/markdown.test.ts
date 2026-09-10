import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blankMdxSyntax, parseDocument } from "../../src/parse/index.ts";
import type { Section } from "../../src/core/index.ts";

const SAMPLE = readFileSync(new URL("../fixtures/api-sample.md", import.meta.url), "utf8");

const outline = (sections: Section[]) =>
  sections.map((s) => ({
    at: `${s.file}:${s.startLine}`,
    path: s.headingPath.join(" > ") || s.title,
    lines: [s.startLine, s.endLine, s.subtreeEndLine],
    depth: s.depth,
    slug: s.slug,
    blocks: s.blocks.map((b) => `${b.type} ${b.startLine}-${b.endLine}`),
  }));

describe("parseDocument on the sample API doc", () => {
  const doc = parseDocument("docs/api.md", SAMPLE);
  const byPath = (p: string) => doc.sections.find((s) => s.headingPath.join(" > ") === p)!;

  it("reads frontmatter without shifting line numbers", () => {
    expect(doc.frontmatter).toEqual({
      title: "Acme API reference",
      description: "Endpoints, auth and errors for the Acme REST API.",
      tags: ["api", "rest"],
    });
    // research.md section 4 "Real output": intro section starts at line 7, after 5 frontmatter lines and a blank
    expect(doc.sections[0]).toMatchObject({ depth: 0, title: "Acme API reference", startLine: 7, endLine: 8 });
  });

  it("matches the section outline in research.md section 4", () => {
    expect(outline(doc.sections).map((s) => `${s.at} ${s.path} ${s.slug}`)).toEqual([
      "docs/api.md:7 Acme API reference ",
      "docs/api.md:10 Authentication authentication",
      "docs/api.md:14 Authentication > Access tokens access-tokens",
      "docs/api.md:23 Authentication > Refresh tokens refresh-tokens",
      "docs/api.md:33 Authentication > Refresh tokens > Examples examples",
      "docs/api.md:42 Rate limits rate-limits",
      "docs/api.md:44 Rate limits > Setext heading below setext-heading-below",
      "docs/api.md:49 Rate limits > Examples examples-1",
    ]);
    expect(byPath("Authentication")).toMatchObject({ endLine: 12, subtreeEndLine: 40 });
    expect(byPath("Authentication > Access tokens").blocks.map((b) => [b.type, b.startLine, b.endLine, b.lang])).toEqual([
      ["paragraph", 16, 16, undefined],
      ["code", 18, 21, "bash"],
    ]);
  });

  it("keeps a source line for every table row, with escaped pipes intact", () => {
    const table = byPath("Authentication > Refresh tokens").blocks.find((b) => b.type === "table")!;
    expect(table.rowLines).toEqual([27, 29, 30, 31]);
    expect(table.rows![0]).toEqual(["Param", "Type", "Required", "Description"]);
    expect(table.rows![3][3]).toBe("Escaped | pipe inside a cell");
  });

  it("gives each top-level list item its own line and splits bullet from numbered lists", () => {
    const [bullets, numbered] = byPath("Authentication > Refresh tokens > Examples").blocks;
    expect(bullets).toMatchObject({ type: "list", ordered: false });
    expect(bullets.items!.map((i) => i.line)).toEqual([35, 36]);
    expect(bullets.items![1].text).toContain("Nested: use a mutex");
    expect(numbered).toMatchObject({ type: "list", ordered: true, items: [{ line: 38 }] });
  });

  it("handles setext headings, HTML blocks and indented code", () => {
    expect(byPath("Rate limits > Setext heading below").depth).toBe(2);
    const blocks = byPath("Rate limits > Examples").blocks;
    expect(blocks.find((b) => b.type === "html")!.text).toBe("raw html block");
    expect(blocks.find((b) => b.type === "code")).toMatchObject({ lang: null, startLine: 55, endLine: 56 });
  });

  it("is stable", () => {
    expect(outline(doc.sections)).toMatchSnapshot();
  });
});

describe("line endings and byte order marks", () => {
  it("gives the same sections for CRLF with a BOM", () => {
    const crlf = "\uFEFF" + SAMPLE.replace(/\n/g, "\r\n");
    expect(outline(parseDocument("docs/api.md", crlf).sections)).toEqual(outline(parseDocument("docs/api.md", SAMPLE).sections));
  });
});

describe("headings that are not sections", () => {
  it("ignores headings inside blockquotes and lists", () => {
    const doc = parseDocument("a.md", "# Top\n\n> ## Warning\n> careful\n\n- ## In a list\n");
    expect(doc.sections.map((s) => s.title)).toEqual(["Top"]);
  });
});

describe("MDX tolerance", () => {
  const MDX = [
    "import Tabs from './Tabs'",
    "export const meta = { a: 1 }",
    "",
    "# Guide {/* hidden */}",
    "",
    "Text with {/* a comment */} inside.",
    "",
    "```js",
    "import x from 'y'",
    "```",
    "",
    "## Next",
  ].join("\n");

  it("blanks ESM lines and comments without changing the line count", () => {
    const out = blankMdxSyntax(MDX);
    expect(out.split("\n")).toHaveLength(MDX.split("\n").length);
    expect(out).not.toContain("import Tabs");
    expect(out).toContain("import x from 'y'"); // code fences are left alone
  });

  it("keeps heading lines true to the source", () => {
    const doc = parseDocument("guide.mdx", MDX);
    expect(doc.sections.map((s) => [s.title, s.startLine])).toEqual([
      ["Guide", 4],
      ["Next", 12],
    ]);
  });
});
