# Markdown docs Q&A without an LLM: build research

A small TypeScript package that answers questions about a repo's markdown docs with no language model. It reads the docs into heading sections, searches them with BM25, sorts the question into a type with hand-written rules, and quotes the one or two sentences (or the code block, table row or list item) that answer it, with `file:line`. When it isn't sure, it says so and lists the closest sections.

v1 ships four surfaces from one package: a library, a CLI, an MCP server for Claude Code and Cowork, and a drop-in browser widget. English only. MIT on npm.

This file is the build manual. It goes with `prd.md` (the contract). Every version number was read from the npm registry on 10 Sep 2026. Every code block was run, either in a research scratch build or in the research prototype.

## How to read this

- Sections 1 to 3 are the short version: decisions, what already exists, and how the pipeline works.
- Sections 4 to 12 walk through the pipeline stage by stage, each with tested code.
- Sections 13 to 19 cover the four surfaces and how to package and publish them.
- Section 20 covers testing and the measured accuracy, including a held-out run that shows where it really stands.
- Section 21 lists what it can't do. Read it before promising anything in the README.
- Sections 22 and 23 list checked versions and links.

Words used throughout:

- A section is a heading plus everything under it until the next heading.
- An answer unit is one sentence, list item, table row or code block inside a section. Answers are made of these.
- BM25 is the word-matching score search engines used before AI. Rare words that appear often in a short section score highest.
- Stemming cuts words to a root so "configured" and "configuration" both become `configur`.
- IDF measures how rare a word is across all sections. Rare words count for more.
- MCP (Model Context Protocol) is the standard way Claude Code and Cowork call outside tools.

---

## 1. Decisions at a glance

| Layer               | Choice                                                 | Why                                                                                                                                                           | Version (10 Sep 2026)               |
| ------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Markdown parser     | `markdown-it`                                          | Line numbers on every block, GFM tables built in, 7 to 14x faster than the remark/mdast stack with identical line numbers on 1,573 real blocks, no DOM needed | 15.0.1                              |
| Frontmatter         | regex + `js-yaml`, blanked not deleted                 | `gray-matter` crashes without Node's `Buffer` in the browser                                                                                                  | js-yaml 5.4.1                       |
| Heading slugs       | `github-slugger`                                       | Same anchors GitHub renders, handles duplicates                                                                                                               | 2.0.0 (ISC licence, MIT-compatible) |
| Sentence splitting  | `Intl.Segmenter` + a masking guard                     | Built into Node and every modern browser, zero bytes                                                                                                          | built in                            |
| Search / ranking    | `MiniSearch`                                           | 5.9 KB gz, BM25+, field and term boosts, custom tokenizer, compact JSON serialization, MIT, zero deps                                                         | 7.2.0                               |
| Stemmer             | `porter2` (Snowball English)                           | The `stemmer` package is original Porter and turns "use" into "us" and "news" into "new"                                                                      | 2.0.0                               |
| Stop words          | Hand-written question list, query side only            | Library lists drop "get", "before", "not"                                                                                                                     | none                                |
| Question types      | 10 regex rule groups with weights (ELIZA-style)        | Tested 37/37 on a labelled set                                                                                                                                | none                                |
| Answer picking      | Residual coverage + Luhn proximity + answer-type regex | Handles "how long is keepAliveTimeout" where the answer repeats none of the words                                                                             | none                                |
| MCP                 | `@modelcontextprotocol/server` v2 + `zod` 4            | v2 shipped 27 Jul 2026; `server.tool()` is gone, use `registerTool`                                                                                           | 2.0.0 / 4.6.1                       |
| CLI args and colour | `node:util` `parseArgs` + `styleText`                  | Zero dependencies, both stable in Node 22                                                                                                                     | built in                            |
| Build               | `tsdown`                                               | tsup's README now says it is unmaintained and points to tsdown                                                                                                | 0.23.0                              |
| Tests               | `vitest` (+ `happy-dom` for the widget)                | Snapshot files make weight tuning reviewable                                                                                                                  | 5.0.0 / 20.14.3                     |
| Package checks      | `publint` + `@arethetypeswrong/cli`                    | Catch broken `exports` before publishing                                                                                                                      | 0.3.24 / 0.18.5                     |
| Node target         | `>=22.17.0`                                            | `fs.glob` stable, `styleText` stable, `require(esm)` works; Node 20 reached end of life 30 Apr 2026                                                           | 22 / 24 / 26 in CI                  |
| Repo shape          | One package, four entry points                         | One core, one version, one publish                                                                                                                            | none                                |
| npm name            | `docs-ask`                                             | Held by a 0.0.1 placeholder Safi published on 10 Sep 2026. Repo: `github.com/Abdulkader-Safi/docs-ask`                                                          | settled                             |

---

## 2. What already exists

Nothing found combines rule-based question types, section retrieval, a single extracted answer with `file:line`, and an explicit "not sure". Every no-LLM tool stops at ranked pages or chunks. Every tool that writes an answer uses a model.

| Tool                         | What it does                                                                                                   | Answer or search                        | Status (10 Sep 2026)                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| VitePress local search       | Splits pages by heading, MiniSearch with fields title/titles/text, boosts 4/2/1, fuzzy 0.2, prefix on          | Search                                  | Active (vitepress 1.6.4). Proof the section + MiniSearch design works in production |
| Pagefind                     | Build-time index of static HTML, WASM, section results                                                         | Search                                  | v1.5.2, MIT, active. Searching only runs in the browser                             |
| Algolia DocSearch            | Hosted crawler and search, free for open source                                                                | Search, plus "Ask AI" which uses an LLM | v5, `@docsearch/js` 5.1.0                                                           |
| tobi/qmd                     | Markdown search CLI + MCP. `search` is BM25 on SQLite FTS5 with no model; `query` needs about 1.6 GB of models | Snippets, not answers                   | `@tobilu/qmd` 2.8.3, MIT, very popular. Closest competitor for the MCP surface      |
| arabold/docs-mcp-server      | Indexes library docs, embeddings optional                                                                      | Chunks                                  | MIT, active                                                                         |
| cskwork/keyword-rag-mcp      | BM25 over .md chunks as MCP tools                                                                              | Chunks                                  | MIT, small, not on npm                                                              |
| Context7                     | Hosted docs snippets for agents                                                                                | Chunks, cloud                           | `@upstash/context7-mcp` 4.0.7                                                       |
| Stork                        | Rust/WASM static search                                                                                        | Search                                  | Wound down, last release Jan 2023                                                   |
| Lunr.js                      | Client-side full-text                                                                                          | Search                                  | No release since Aug 2020                                                           |
| ELIZA (1966) and AIML (2001) | Keyword ranks and pattern/template rules                                                                       | Pattern chat                            | Historical. The rule design in section 8 is the same idea                           |

Where this package fits: qmd already covers "BM25 search over markdown from an MCP server". The difference here is the answer step (one quoted answer with a line number and an honest abstain), the zero-install browser widget, and a package small enough to read in an afternoon. The README should say that plainly and link qmd for people who want embeddings.

---

## 3. How the pipeline works

```text
BUILD (Node, once per docs change)
  *.md files
    -> Stage 1  parse: markdown-it tokens -> sections (heading path, start line, blocks)
    -> Stage 2  answer units: sentences, list items, table rows, code blocks (each with its own line)
    -> Stage 3  terms: tokenizer keeps identifiers, stems words, applies strict synonyms
    -> Stage 4  MiniSearch index (fields: heading, headingPath, prose, code) + document-frequency map
    -> optional: serialize to docs-index.json for the widget or a fast MCP start

ASK (Node or browser, per question, about 2 ms on 559 sections)
  question
    -> Stage 5  classify: HOWTO / VALUE / ERROR / ... -> answer shape + preferred unit kinds
    -> Stage 3  query terms: drop question words, keep identifiers, stem, expand loose synonyms
    -> Stage 6  retrieve top 25 sections with BM25, rerank with rule boosts
    -> Stage 8  confidence gates: unknown identifier? weak coverage? top two too close? -> "not sure"
    -> Stage 7  pick 1 or 2 answer units inside the winning section
  -> { confident, qclass, file, line, headingPath, text, candidates[top 5] }
```

One question traced through the prototype, on the Fastify docs:

1. "What is the default bodyLimit?"
2. Stage 5: VALUE scores 6 ("what is the default" 4 + "default" 2), DEFINITION scores 3. VALUE wins. Answer shape: one sentence containing a value.
3. Stage 3: query terms `default`, `bodylimit`, `bodi`, `limit`. `bodyLimit` is an exact identifier.
4. Stage 6: `Reference/Server.md > bodyLimit` scores 1099.5 after the "identifier in heading" boost. Next best is 121.5.
5. Stage 8: identifier exists in the docs, coverage 1.00, gap 89%. Confident.
6. Stage 7: the heading already contains `bodylimit`, so the unit doesn't need to repeat it. The unit `Default: \`1048576\` (1MiB)` matches the VALUE regex and wins.
7. Output: `Reference/Server.md:224  Factory > bodyLimit` / `Default: \`1048576\` (1MiB)`.

---

## 4. Stage 1: read markdown into sections

### Parser choice

| Option                                    | Version              | Size min+gz (measured)      | Line numbers                                                                                        | GFM tables | Parse 1 MB of small files |
| ----------------------------------------- | -------------------- | --------------------------- | --------------------------------------------------------------------------------------------------- | ---------- | ------------------------- |
| **markdown-it**                           | 15.0.1 (27 Aug 2026) | 41.2 KB                     | Yes, `token.map = [start0, endExclusive]` on every block token, including table rows and list items | Built in   | 312 ms                    |
| mdast-util-from-markdown + GFM extensions | 2.0.3                | 22.6 KB (browser condition) | Best: line plus column offset on every node                                                         | Yes        | 3,995 ms                  |
| unified + remark-parse + remark-gfm       | 11.0.5               | 32.2 KB                     | Same as mdast                                                                                       | Yes        | slower than mdast         |
| marked (`Lexer.lex`)                      | 18.0.12              | 12.9 KB                     | None                                                                                                | Yes        | 209 ms                    |

Size method: esbuild 0.28.2 `--bundle --minify --format=esm --platform=browser`, then `gzip -9`.

The same section parser was built twice (markdown-it and mdast) and run on eight real docs (Node's 308 KB `fs.md`, the prettier and vite option pages, four project readmes, a GitHub REST doc with frontmatter, a Next.js `.mdx` page). Result: zero differences in line numbers or text across 1,573 blocks. markdown-it took 81 ms on `fs.md`, mdast took 794 ms. Pick mdast later only if you need column offsets, real MDX parsing or remark plugins.

The parser is only needed at build time and in the Node surfaces. The widget loads a prebuilt index and never ships markdown-it (see section 17).

### Section model

Flat array, one entry per heading, with its ancestors in `headingPath`:

- `endLine` stops at the next heading of any level. Index this range, so a parent section doesn't repeat its children's text and distort BM25.
- `subtreeEndLine` stops at the next heading of the same or higher level. Use it for "show the whole section".
- Content before the first heading becomes an intro section with depth 0, titled from frontmatter `title` or the file name.

### Rules the parser must follow

1. Strip a leading BOM (`\uFEFF`). markdown-it reads `\uFEFF# Title` as a paragraph.
2. Frontmatter must start at byte 0. Parse it with `js-yaml`, then replace the block with the same number of newlines. Deleting it shifts every line number. Without this, markdown-it reads frontmatter as a horizontal rule plus a setext heading.
3. Create `MarkdownIt({ html: true })`. The default `html: false` turns `<div>` blocks into paragraph text with raw tags.
4. Trim trailing blank lines from `token.map` ends. List maps include the blank line after the list.
5. One `GithubSlugger` instance per file, called in document order. Duplicates become `examples`, `examples-1`. Empty headings fall back to `section-<line>`.
6. For `.mdx`, blank `import`/`export` blocks (they run until a blank line) and `{/* */}` comments without deleting lines. Real MDX parsing (`micromark-extension-mdxjs`) costs 97 KB gz and throws on ordinary `<br>`.
7. Walk files with `fs.glob` (stable since Node 22.17.0) and filter with the `ignore` package (7.0.9) against `.gitignore`. `fs.glob` does not read `.gitignore`. Pass `ignore` POSIX-style relative paths only; it throws on `./x`.
8. Headings inside blockquotes or lists (`> ## Warning`) are not sections.

### Types (`shared.ts`)

```ts
// Shared types and dependency-free helpers (no parser imports, safe to bundle anywhere).

export type BlockType =
  "paragraph" | "code" | "list" | "table" | "blockquote" | "html";

export interface Block {
  type: BlockType;
  /** Plain text. Soft line breaks kept as "\n" so line = startLine + newlines before offset. Inline code keeps backticks. */
  text: string;
  startLine: number;
  endLine: number;
  lang?: string | null;
  /** table only: rows[0] is the header row */
  rows?: string[][];
  /** table only: source line of each entry in rows */
  rowLines?: number[];
  /** list only: numbered list */
  ordered?: boolean;
  /** list only: one entry per top-level item, with its own source line */
  items?: { text: string; line: number }[];
}

export interface Section {
  id: string;
  file: string;
  slug: string;
  headingPath: string[];
  depth: number; // 0 = intro (content before first heading)
  title: string;
  parentId: string | null;
  /** heading line (or first block line for intro) */
  startLine: number;
  /** last line of this section's OWN content (stops at the next heading of any level) */
  endLine: number;
  /** last line including child sections (stops at next heading of same or higher level) */
  subtreeEndLine: number;
  blocks: Block[];
  /** own blocks joined, for indexing */
  text: string;
}

export interface ParsedDoc {
  file: string;
  frontmatter: Record<string, unknown>;
  frontmatterError?: string;
  sections: Section[];
}

export interface ParseOptions {
  /** Blank out MDX import/export lines and {expressions}. Default: true when file ends in .mdx */
  mdx?: boolean;
}

/**
 * Cheap MDX tolerance without an MDX parser: blank (not delete) ESM lines and {expressions}
 * so every line number stays identical. JSX tags on their own line already parse as html blocks.
 */
export function blankMdxSyntax(src: string): string {
  const lines = src.split(/\r?\n|\r/);
  let fence: string | null = null;
  let inEsm = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (line.trim().startsWith(fence)) fence = null;
      continue;
    }
    if (fence) continue;
    if (inEsm || /^(import|export)\s/.test(line)) {
      // MDX rule: an ESM block starts with import/export at column 0 and runs until a blank line
      inEsm = line.trim() !== "";
      lines[i] = "";
      continue;
    }
    lines[i] = line.replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) =>
      " ".repeat(m.length),
    );
  }
  return lines.join("\n");
}

export function citation(s: Section, line = s.startLine): string {
  return `${s.file}:${line}  ${s.headingPath.join(" > ") || s.title}`;
}
```

### Parser (`md-parse.ts`)

Tested on a sample API doc with frontmatter, nested headings, a setext heading, a duplicate heading name, a GFM table with an escaped pipe, nested lists, an HTML block and a CRLF + BOM variant (5/5 tests pass), then on the 30 Fastify doc files in the prototype.

```ts
// RECOMMENDED: markdown source -> flat heading sections with exact line ranges, built on markdown-it tokens.
// token.map = [startLine 0-based, endLine exclusive]; endLine is trimmed of trailing blank lines below.
import MarkdownIt from "markdown-it";
import type { Token } from "markdown-it";
import GithubSlugger from "github-slugger";
import { load as parseYaml } from "js-yaml";
import {
  blankMdxSyntax,
  type Block,
  type Section,
  type ParsedDoc,
  type ParseOptions,
} from "./shared.ts";
export * from "./shared.ts";

const md = new MarkdownIt({ html: true }); // default preset: tables + strikethrough on, linkify off

export function parseMarkdown(
  filePath: string,
  source: string,
  options: ParseOptions = {},
): Section[] {
  return parseDocument(filePath, source, options).sections;
}

export function parseDocument(
  filePath: string,
  source: string,
  options: ParseOptions = {},
): ParsedDoc {
  const file = filePath.replace(/\\/g, "/").replace(/^\.\//, "");
  let src = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source; // markdown-it does NOT strip BOM
  const doc: ParsedDoc = { file, frontmatter: {}, sections: [] };
  // Frontmatter: blank it with the same number of newlines so token.map stays true to the file.
  const fm =
    /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(src);
  if (fm) {
    try {
      const data = parseYaml(fm[1]);
      if (data && typeof data === "object" && !Array.isArray(data))
        doc.frontmatter = data as Record<string, unknown>;
    } catch (e) {
      doc.frontmatterError = (e as Error).message;
    }
    src = fm[0].replace(/[^\r\n]/g, "") + src.slice(fm[0].length);
  }
  if (options.mdx ?? /\.mdx$/i.test(file)) src = blankMdxSyntax(src);
  const lines = src.split(/\r\n|\r|\n/);
  const lastLine = (map: [number, number]) => {
    let e = map[1];
    while (e > map[0] + 1 && !lines[e - 1]?.trim()) e--;
    return e;
  };

  const tokens = md.parse(src, {});
  const slugger = new GithubSlugger();
  const stack: Section[] = [];
  let current: Section | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.level !== 0 || t.nesting === -1 || !t.map) continue;
    const close = t.nesting === 1 ? findClose(tokens, i) : i;
    if (t.type === "heading_open") {
      const depth = Number(t.tag.slice(1));
      const title = inlineText(tokens[i + 1])
        .replace(/\s+/g, " ")
        .trim();
      while (stack.length && stack[stack.length - 1].depth >= depth)
        stack.pop();
      const parent = stack[stack.length - 1] ?? null;
      const slug =
        slugger.slug(title) || slugger.slug(`section-${t.map[0] + 1}`);
      current = {
        id: `${file}#${slug}`,
        file,
        slug,
        headingPath: [...(parent?.headingPath ?? []), title],
        depth,
        title,
        parentId: parent?.id ?? null,
        startLine: t.map[0] + 1,
        endLine: lastLine(t.map),
        subtreeEndLine: lastLine(t.map),
        blocks: [],
        text: "",
      };
      stack.push(current);
      doc.sections.push(current);
    } else {
      const block = toBlock(tokens, i, close, lastLine);
      if (block) {
        if (!current) {
          const title =
            typeof doc.frontmatter.title === "string"
              ? doc.frontmatter.title
              : file.split("/").pop()!;
          current = {
            id: file,
            file,
            slug: "",
            headingPath: [],
            depth: 0,
            title,
            parentId: null,
            startLine: block.startLine,
            endLine: block.endLine,
            subtreeEndLine: block.endLine,
            blocks: [],
            text: "",
          };
          doc.sections.push(current);
        }
        current.blocks.push(block);
        current.endLine = Math.max(current.endLine, block.endLine);
      }
    }
    i = close;
  }
  const byId = new Map(doc.sections.map((s) => [s.id, s]));
  for (const s of doc.sections) {
    s.text = s.blocks.map((b) => b.text).join("\n\n");
    s.subtreeEndLine = Math.max(s.subtreeEndLine, s.endLine);
  }
  for (let i = doc.sections.length - 1; i >= 0; i--) {
    const s = doc.sections[i];
    const p = s.parentId ? byId.get(s.parentId) : undefined;
    if (p) p.subtreeEndLine = Math.max(p.subtreeEndLine, s.subtreeEndLine);
  }
  return doc;
}

function findClose(tokens: Token[], open: number): number {
  let depth = 0;
  for (let j = open; j < tokens.length; j++) {
    depth += tokens[j].nesting;
    if (depth === 0) return j;
  }
  return tokens.length - 1;
}

function toBlock(
  tokens: Token[],
  i: number,
  close: number,
  lastLine: (m: [number, number]) => number,
): Block | null {
  const t = tokens[i];
  const startLine = t.map![0] + 1,
    endLine = lastLine(t.map!);
  switch (t.type) {
    case "paragraph_open":
      return {
        type: "paragraph",
        text: inlineText(tokens[i + 1]).trim(),
        startLine,
        endLine,
      };
    case "fence":
      return {
        type: "code",
        text: t.content.replace(/\n$/, ""),
        lang: t.info.trim().split(/\s+/)[0] || null,
        startLine,
        endLine,
      };
    case "code_block":
      return {
        type: "code",
        text: t.content.replace(/\n$/, ""),
        lang: null,
        startLine,
        endLine,
      };
    case "html_block": {
      const text = t.content
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<[^>]+>/g, "")
        .trim();
      return text ? { type: "html", text, startLine, endLine } : null;
    }
    case "bullet_list_open":
    case "ordered_list_open": {
      // one entry per top-level item, with its own source line, so answers can cite a single item
      const items: { text: string; line: number }[] = [];
      for (let j = i + 1; j < close; j++) {
        if (
          tokens[j].type !== "list_item_open" ||
          tokens[j].level !== t.level + 1
        )
          continue;
        const itemClose = findClose(tokens, j);
        const text = listText(
          [t, ...tokens.slice(j, itemClose + 1), tokens[close]],
          0,
          itemClose - j + 2,
          0,
        ).replace(/^(?:-|\d+\.) /, "");
        items.push({ text, line: tokens[j].map![0] + 1 });
        j = itemClose;
      }
      return {
        type: "list",
        text: listText(tokens, i, close, 0),
        ordered: t.type === "ordered_list_open",
        items,
        startLine,
        endLine,
      };
    }
    case "blockquote_open": {
      const parts: string[] = [];
      for (let j = i + 1; j < close; j++)
        if (tokens[j].type === "inline")
          parts.push(inlineText(tokens[j]).trim());
      return { type: "blockquote", text: parts.join("\n"), startLine, endLine };
    }
    case "table_open": {
      const rows: string[][] = [],
        rowLines: number[] = [];
      for (let j = i; j < close; j++) {
        if (tokens[j].type === "tr_open") {
          rows.push([]);
          rowLines.push(tokens[j].map![0] + 1);
        }
        if (tokens[j].type === "inline")
          rows[rows.length - 1].push(inlineText(tokens[j]).trim());
      }
      const [header, ...body] = rows;
      const text = body
        .map((r) =>
          r.map((c, k) => `${header[k] ?? `col${k + 1}`}: ${c}`).join("; "),
        )
        .join("\n");
      return { type: "table", text, rows, rowLines, startLine, endLine };
    }
    default:
      return null;
  }
}

function listText(
  tokens: Token[],
  open: number,
  close: number,
  indent: number,
): string {
  const out: string[] = [];
  let n = Number(tokens[open].attrGet("start") ?? 1);
  for (let j = open + 1; j < close; j++) {
    const t = tokens[j];
    if (t.type !== "list_item_open") continue;
    const itemClose = findClose(tokens, j);
    const bullet = tokens[open].type === "ordered_list_open" ? `${n++}.` : "-";
    const parts: string[] = [];
    for (let k = j + 1; k < itemClose; k++) {
      const c = tokens[k];
      if (c.type === "bullet_list_open" || c.type === "ordered_list_open") {
        const e = findClose(tokens, k);
        parts.push("\n" + listText(tokens, k, e, indent + 1));
        k = e;
      } else if (c.type === "inline")
        parts.push(inlineText(c).replace(/\n/g, " "));
      else if (c.type === "fence" || c.type === "code_block")
        parts.push("\n" + c.content.replace(/\n$/, ""));
    }
    out.push(
      `${"  ".repeat(indent)}${bullet} ${parts.join(" ").replace(/ \n/g, "\n")}`,
    );
    j = itemClose;
  }
  return out.join("\n");
}

function inlineText(t: Token | undefined): string {
  let s = "";
  for (const c of t?.children ?? []) {
    if (c.type === "text") s += c.content;
    else if (c.type === "code_inline") s += "`" + c.content + "`";
    else if (c.type === "softbreak" || c.type === "hardbreak") s += "\n";
    else if (c.type === "image") s += c.content;
  }
  return s;
}
```

Real output on the sample doc (trimmed):

```text
docs/api.md:7   Acme API reference                          [lines 7-8]   depth=0
docs/api.md:10  Authentication                              [lines 10-12, subtree to 40]
docs/api.md:14  Authentication > Access tokens              [lines 14-21]
   paragraph  16-16
   code       18-21 lang=bash
docs/api.md:23  Authentication > Refresh tokens             [lines 23-31, subtree to 40]
   paragraph  25-25
   table      27-31 rowLines=27,29,30,31
docs/api.md:33  Authentication > Refresh tokens > Examples  [lines 33-40]   #examples
docs/api.md:49  Rate limits > Examples                      [lines 49-60]   #examples-1
```

`rowLines` and list `items[].line` let an answer cite the exact row or item, for example `docs/api.md:30` for one parameter.

---

## 5. Stage 2: split sections into answer units

Answers are built from units, never from whole paragraphs. Each unit keeps its own line number.

| Block           | Becomes                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| paragraph, html | one `sentence` unit per sentence                                                                              |
| list            | one `list` or `orderedList` unit per top-level item                                                           |
| table           | one `tableRow` unit per body row, written as `Header: cell \| Header: cell` so column names become searchable |
| code            | one `code` unit, language kept                                                                                |
| blockquote      | one `blockquote` unit                                                                                         |
| heading         | one `heading` unit (used by LOCATION answers)                                                                 |

### Sentence splitting

`Intl.Segmenter('en', { granularity: 'sentence' })` is in Node 16+, Chrome/Edge 87, Safari 14.1 and Firefox 125. Output was byte-identical on Node 20, 22 and 24.

What it gets right: version numbers (`v2.1`), file names (`docs/errors.md`), URLs, `1,000`, `U.S. guide`. A dot with no space after it, or followed by a lowercase letter, never breaks.

What it gets wrong, tested:

```text
"Use v2.1 of the API. Call e.g. POST /auth/refresh. See docs/errors.md for 401s."
  raw    -> "Use v2.1 of the API. " | "Call e.g. " | "POST /auth/refresh. " | "See docs/errors.md for 401s."
"Dr. Smith wrote the U.S. guide. It is great."
  raw    -> "Dr. " | "Smith wrote the U.S. guide. " | "It is great."
```

It breaks after abbreviations such as `e.g.` or `Dr.` before a capital letter, and treats every `\n` as a hard break. ICU's abbreviation extension (`en-u-ss-standard`) is ignored by V8. The guard masks inline code and URLs with same-length filler, does the same for abbreviations so offsets survive, then slices the original text:

```ts
// Sentence splitting on Intl.Segmenter with a same-length "protect" pass so offsets and line numbers survive.
export interface Sentence {
  text: string;
  /** char offset in the input */
  start: number;
  /** 0-based count of "\n" before start: add to block.startLine */
  lineOffset: number;
}

// Abbreviations that almost never end an English sentence. Case-sensitive on purpose: "Ms." yes, "500 ms." no.
// "etc." deliberately left out (it often ends a sentence).
const ABBREV =
  /\b(?:[eE]\.g|[iI]\.e|vs|cf|approx|incl|Dr|Mr|Mrs|Ms|Prof)\.(?=\s)/g;
const INLINE_CODE = /(`+)[\s\S]*?\1/g;
const URL_RE = /\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g;

let segmenter: Intl.Segmenter | null = null;

export function splitSentences(text: string): Sentence[] {
  // 1. Mask: inside protected spans turn . ! ? and whitespace into "_" (same length, so indices stay valid).
  let masked = text;
  const mask = (re: RegExp) => {
    masked = masked.replace(re, (m) => m.replace(/[.!?\s]/g, "_"));
  };
  mask(INLINE_CODE);
  mask(URL_RE);
  mask(ABBREV);
  // 2. Soft line breaks are hard sentence breaks in UAX #29 (LF = ParaSep). Treat them as spaces.
  masked = masked.replace(/\n/g, " ");

  segmenter ??= new Intl.Segmenter("en", { granularity: "sentence" });
  const out: Sentence[] = [];
  for (const seg of segmenter.segment(masked)) {
    // 3. Slice the ORIGINAL text by index: masking is undone for free.
    const raw = text.slice(seg.index, seg.index + seg.segment.length);
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const start = seg.index + (raw.length - raw.trimStart().length);
    out.push({
      text: trimmed.replace(/\s*\n\s*/g, " "),
      start,
      lineOffset: countNewlines(text, start),
    });
  }
  return out;
}

function countNewlines(s: string, end: number): number {
  let n = 0;
  for (let i = 0; i < end; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
}
```

Guarded output:

```text
"Use v2.1 of the API." | "Call e.g. POST /auth/refresh." | "See docs/errors.md for 401s."
"Set `a. B` first." | "Then call `client.auth.refresh()`." | "It returns a Promise."
"Dr. Smith wrote the U.S. guide." | "It is great."
```

Run it on paragraph and blockquote text only. Lists split by item, tables by row. A Node built with `--without-intl` has no `Intl`; keep a regex fallback for that case.

### The adapter (tested in the prototype)

The QA layer works on its own two types, `Unit` and `QaSection`. They are different from the parser's `Block` and `Section` in `shared.ts`, so they get different names. One more difference to watch: the parser's `Section.headingPath` ends with the section's own heading, while `QaSection.headingPath` holds the ancestors only and the heading sits in `heading`.

```ts
// Adapter: markdown-it section parser (research-md) -> answer units used by the QA layer.
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { parseDocument } from "./md-parse.ts";
import { splitSentences } from "./sentences.ts";
import type { BlockKind } from "./rules.ts";

/** One answer unit: a sentence, list item, table row, code block, blockquote or heading. */
export interface Unit {
  kind: BlockKind;
  text: string;
  line: number;
  lang?: string;
}

export interface QaSection {
  id: string;
  file: string;
  heading: string; // this section's heading, backticks removed
  headingPath: string[]; // ancestors only, NOT including `heading`
  line: number;
  blocks: Unit[];
  prose: string; // non-code, non-heading units joined, for the index
  code: string; // code units joined, for the index
}

export function parseFile(root: string, path: string): QaSection[] {
  const file = relative(root, path);
  const doc = parseDocument(file, readFileSync(path, "utf8"));
  return doc.sections
    .map((sec) => {
      const heading = sec.depth === 0 ? file : sec.title.replace(/`/g, "");
      const blocks: Unit[] =
        sec.depth === 0
          ? []
          : [{ kind: "heading", text: heading, line: sec.startLine }];
      for (const b of sec.blocks) {
        if (b.type === "paragraph" || b.type === "html") {
          for (const s of splitSentences(b.text))
            blocks.push({
              kind: "sentence",
              text: s.text,
              line: b.startLine + s.lineOffset,
            });
        } else if (b.type === "code")
          blocks.push({
            kind: "code",
            text: b.text,
            line: b.startLine,
            lang: b.lang ?? undefined,
          });
        else if (b.type === "list")
          for (const it of b.items ?? [])
            blocks.push({
              kind: b.ordered ? "orderedList" : "list",
              text: it.text,
              line: it.line,
            });
        else if (b.type === "table") {
          const [hdr, ...rows] = b.rows ?? [];
          rows.forEach((r, k) =>
            blocks.push({
              kind: "tableRow",
              text: r.map((c, i) => `${hdr[i] ?? ""}: ${c}`).join(" | "),
              line: b.rowLines![k + 1],
            }),
          );
        } else if (b.type === "blockquote")
          blocks.push({ kind: "blockquote", text: b.text, line: b.startLine });
      }
      return {
        id: sec.id,
        file,
        heading,
        headingPath: sec.headingPath
          .slice(0, -1)
          .map((h) => h.replace(/`/g, "")),
        line: sec.startLine,
        blocks,
        prose: blocks
          .filter((x) => x.kind !== "code" && x.kind !== "heading")
          .map((x) => x.text)
          .join("\n"),
        code: blocks
          .filter((x) => x.kind === "code")
          .map((x) => x.text)
          .join("\n"),
      };
    })
    .filter((s) => s.blocks.length > 0);
}
```

---

## 6. Stage 3: turn text into search terms

### Why MiniSearch's default tokenizer is wrong for docs

MiniSearch 7.2.0 splits on `/[\n\r\p{Z}\p{P}]+/u`. Tested on `POST /auth/refresh --force snake_case camelCase 401 v5.6.0 fastify.register()`:

```text
['POST','auth','refresh','force','snake','case','camelCase','401','v5','6','0','fastify','register','']
```

Paths, flags, dotted names and versions are lost. `snake_case` is split, `camelCase` is not. The fix is a custom `tokenize` that emits the whole identifier and its parts, with `processTerm: t => t` because the tokenizer already normalises.

### Stop words: question side only

Remove question scaffolding ("how do I", "what is the") from the query. Never remove words from the index: BM25's IDF already makes common words weigh little, and docs need words like "get" (HTTP GET), "before", "after", "not". Keep `not`, `no`, `without` and `only` in queries even though bag-of-words scoring can't use them yet (section 21).

A test with MiniSearch showed why this matters: with no stop words and prefix/fuzzy on every term, "a" and "i" matched "access", "an" and "id", so "how do I refresh a token" ranked "Getting an access token" above "Refreshing tokens".

### Stemming: use Porter2, not Porter

The `stemmer` npm package (2.0.1) implements the original 1980 Porter algorithm. `porter2` (2.0.0, 17 Jun 2026, MIT) implements Snowball English.

| Word                                   | Porter (`stemmer`) | Porter2 (`porter2`) | Note                       |
| -------------------------------------- | ------------------ | ------------------- | -------------------------- |
| news                                   | new                | news                | Porter collides with "new" |
| use / used                             | us                 | use                 | Porter collides with "us"  |
| dying                                  | dy                 | die                 |                            |
| authorization                          | author             | author              | Both collide with "author" |
| settings                               | set                | set                 | Both collide with "set"    |
| validation                             | valid              | valid               | Both merge with "valid"    |
| configuration / configure / configured | configur           | configur            | Good                       |

Never stem identifiers, tokens of three characters or fewer, or code. Words where both stemmers collide (authorization, settings, validation) should go through the synonym table or a small protected list.

### Tokenizer (`text.ts`)

```ts
import { stem } from "porter2";

// Question-only stop words: removed from the QUERY, never from the index.
export const QUESTION_STOPWORDS = new Set(
  (
    "a an the and or of to in on at for from by with about into over as " +
    "i me my we our you your it its this that these those there here " +
    "what whats which who whom whose where when why how " +
    "do does did done doing is are was were be been being am " +
    "can could should would will shall may might must " +
    "have has had get gets got please tell show find " +
    "use using used way ways need want trying try " +
    "some any all one thing something possible able myself yourself ourselves"
  ).split(/\s+/),
);
// Words that look like stop words but carry the question's meaning in docs.
// Kept out of the list on purpose: not, no, without, only, default, before, after, first.

// Upper-case HTTP verbs survive stop-word removal ("GET /users"), lower-case "get" doesn't.
const HTTP_VERB_WORD = /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/;
const SHORT_KEEP =
  /^(?:[45]\d\d|[123]\d\d|id|ip|io|db|ui|os|js|ts|ci|cd|v\d+)$/i;

// Tokens that must survive as a single unit.
const SPECIAL = new RegExp(
  [
    String.raw`(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)(?=\s+\/)`, // verb before a path
    String.raw`[a-z]+\/[a-z0-9.+-]+(?=[\s,.?!)]|$)`, // MIME types: text/csv, application/json
    String.raw`(?<![\w.])\/[A-Za-z0-9_{}:.\-]+(?:\/[A-Za-z0-9_{}:.\-]*)*`, // /auth/refresh and /api/v1/apps/:id, but not the /csv inside text/csv
    String.raw`--?[A-Za-z][\w-]*`, // --force, -f
    String.raw`[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+(?:\(\))?`, // fastify.register, reply.send()
    String.raw`[A-Za-z]+(?:_[A-Za-z0-9]+)+`, // snake_case, FST_ERR_X
    String.raw`[a-z]+(?:[A-Z][a-z0-9]*)+`, // camelCase
    String.raw`[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+`, // PascalCase
    String.raw`v?\d+(?:\.\d+)+`, // 5.6.0
    String.raw`[A-Za-z0-9]+(?:'[a-z]+)?`, // plain words, numbers, don't
  ].join("|"),
  "g",
);

export function splitIdentifier(tok: string): string[] {
  return tok
    .replace(/^--?/, "")
    .replace(/\(\)$/, "")
    .split(/[\/._\-{}:]+/)
    .flatMap((p) =>
      p
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .split(" "),
    )
    .filter(Boolean);
}

export type Tok = { raw: string; norm: string; isCodeish: boolean };

export function rawTokens(text: string): Tok[] {
  const out: Tok[] = [];
  text = text.replace(/\b([1-5]\d\d)s\b/g, "$1"); // "404s" -> "404"
  text = text.replace(
    /\b(ca|wo|do|does|did|is|are|was|should|could|would)n't\b/gi,
    (_m, a) =>
      `${a.toLowerCase() === "ca" ? "can" : a.toLowerCase() === "wo" ? "will" : a} not`,
  );
  for (const m of text.matchAll(SPECIAL)) {
    const raw = m[0];
    const isCodeish =
      /[\/._]|[a-z][A-Z]|^--?[a-z]|[A-Z][a-z]+[A-Z]/.test(raw) &&
      !/^v?\d+(?:\.\d+)+$/.test(raw);
    out.push({ raw, norm: raw.toLowerCase().replace(/\(\)$/, ""), isCodeish });
  }
  return out;
}

export function stemWord(w: string): string {
  return /^[a-z]+$/.test(w) && w.length > 3 ? stem(w) : w;
}

// Index-time: emit whole identifier + its stemmed parts. No stop word removal.
export function indexTerms(text: string): string[] {
  const terms: string[] = [];
  for (const t of rawTokens(text)) {
    if (t.isCodeish) {
      terms.push(t.norm);
      for (const p of splitIdentifier(t.raw))
        terms.push(stemWord(p.toLowerCase()));
    } else {
      terms.push(stemWord(t.norm));
    }
  }
  return terms;
}

// Query-time: same, but drop question stop words (unless nothing would remain).
export function queryTerms(question: string): {
  terms: string[];
  exact: string[];
} {
  const toks = rawTokens(question);
  const exact = toks
    .filter((t) => t.isCodeish || /^[45]\d\d$/.test(t.raw))
    .map((t) => t.norm);
  let kept = toks.filter(
    (t) =>
      t.isCodeish ||
      HTTP_VERB_WORD.test(t.raw) ||
      SHORT_KEEP.test(t.raw) ||
      !QUESTION_STOPWORDS.has(t.norm),
  );
  if (kept.length === 0) kept = toks;
  const terms = new Set<string>();
  for (const t of kept) {
    if (t.isCodeish) {
      terms.add(t.norm);
      for (const p of splitIdentifier(t.raw)) {
        const w = p.toLowerCase();
        if (!QUESTION_STOPWORDS.has(w)) terms.add(stemWord(w));
      }
    } else terms.add(stemWord(t.norm));
  }
  return { terms: [...terms], exact };
}
```

Tested output:

```text
"How do I call POST /auth/refresh with --force?"
  terms [call, post, /auth/refresh, auth, refresh, --force, forc]   exact [/auth/refresh, --force]
"what is the default bodyLimit in fastify.listen()"
  terms [default, bodylimit, bodi, limit, fastify.listen, fastifi, listen]
"how do I parse a custom content type like text/csv"
  terms [pars, custom, content, type, like, text/csv, text, csv]   exact [text/csv]
```

The `text/csv` case was a real bug found in the held-out run: the path pattern read `/csv` as a URL path. The MIME-type pattern and the `(?<![\w.])` lookbehind fix it.

Three more fixes came from the doc review on 10 Sep 2026:

- "404s" used to stay one token, so it missed both the ERROR trigger and any "404" synonym. `rawTokens` now turns a status code with a plural `s` into the bare code, and the ERROR trigger in section 8 accepts `404s`.
- "what does GET /users return" used to drop `GET`, because `get` is a question stop word. Upper-case HTTP verbs are now kept. Lower-case "get" is still dropped.
- "myself", "yourself" and "ourselves" are now question stop words.

Measured in the prototype: the tuned set didn't move (top-1 0.692, recall@3 0.808), 37/37 question types and 33/33 tests still pass. On the held-out set one question changed, "how do I handle 404s myself", which now answers with `Server.md > setNotFoundHandler` at rank 1. That lifts held-out top-1 to 0.57 and recall@3 to 0.79, but the fix was found by reading that held-out question, so the number is no longer clean. Quote 0.50 and 0.71 as the honest held-out figures.

### Synonyms: two modes

MiniSearch multiplies a section's summed score by the number of distinct query terms it matched. So adding synonyms to the query inflates sections that happen to use several of them. Measured: doc A says "login" three times, doc B says "sign in", "authenticate" and "signin" once each.

| Query                            | Doc A | Doc B    |
| -------------------------------- | ----- | -------- |
| "login"                          | 1.43  | no match |
| "login signin authenticate"      | 1.43  | 4.21     |
| same, alias terms boosted at 0.4 | 1.43  | 1.68     |

So true synonyms are rewritten to one canonical word at both index and query time (strict), and related words are added to the query only, at low weight (loose).

|                            | Strict: rewrite at index and query time         | Loose: add to query only         |
| -------------------------- | ----------------------------------------------- | -------------------------------- |
| Score inflation            | None                                            | Yes, reduce with `boostTerm` 0.4 |
| Changing the table         | Needs a re-index                                | Instant                          |
| Exact wording ranks higher | No, "auth" and "login" become the same term     | Yes                              |
| A bad entry hurts          | Every query                                     | Only queries that use it         |
| Use for                    | Real synonyms, abbreviations, spelling variants | Related verbs, project jargon    |

```ts
// Hand-made alias table. `canonical` is what gets indexed.
// strict: true  -> canonicalize at index AND query time (true synonyms)
// strict: false -> expand at query time only, with lower weight (related terms)
export interface SynonymGroup {
  canonical: string;
  aliases: string[];
  strict: boolean;
}

export const SYNONYMS: SynonymGroup[] = [
  {
    canonical: "login",
    aliases: [
      "log in",
      "sign in",
      "signin",
      "logon",
      "authenticate",
      "authentication",
      "auth",
    ],
    strict: true,
  },
  {
    canonical: "logout",
    aliases: ["log out", "sign out", "signout"],
    strict: true,
  },
  {
    canonical: "signup",
    aliases: ["sign up", "register account", "create account"],
    strict: true,
  },
  {
    canonical: "config",
    aliases: ["configuration", "configure", "settings", "setting", "options"],
    strict: false,
  },
  {
    canonical: "delete",
    aliases: ["remove", "destroy", "drop", "erase"],
    strict: false,
  },
  {
    canonical: "create",
    aliases: ["add", "new", "make", "insert"],
    strict: false,
  },
  {
    canonical: "update",
    aliases: ["edit", "modify", "change", "patch"],
    strict: false,
  },
  {
    canonical: "install",
    aliases: ["set up", "setup", "installation"],
    strict: false,
  },
  {
    canonical: "env",
    aliases: [
      "environment variable",
      "environment variables",
      "env var",
      "env vars",
    ],
    strict: true,
  },
  {
    canonical: "token",
    aliases: ["access token", "jwt", "bearer token"],
    strict: false,
  },
  {
    canonical: "error",
    aliases: ["exception", "failure", "fault"],
    strict: false,
  },
  { canonical: "db", aliases: ["database"], strict: true },
  { canonical: "repo", aliases: ["repository"], strict: true },
];
```

The held-out run needed one more entry the table didn't have: "How do I hide passwords in logs?" found the "Log Redaction" section but abstained, because "hide" never appears near "redact". Users must be able to extend this table per repo (PRD: `docs-ask.config.json` or a `synonyms` option).

---

## 7. Stage 4: the search index

### Library choice

|                              | MiniSearch                                             | Orama                                    | FlexSearch                       | Lunr                    | Fuse.js                      |
| ---------------------------- | ------------------------------------------------------ | ---------------------------------------- | -------------------------------- | ----------------------- | ---------------------------- |
| Latest                       | 7.2.0 (16 Sep 2025)                                    | 3.1.18 (Dec 2025; v3.2.0 tag not on npm) | 0.8.212                          | 2.3.9 (2020, abandoned) | 7.5.0                        |
| Min+gz measured              | **5.9 KB**                                             | 22.1 KB                                  | 17.5 KB full                     | 8.9 KB                  | 9.5 KB                       |
| Ranking                      | BM25+ (k 1.2, b 0.7, d 0.5)                            | BM25                                     | Position slots, no numeric score | BM25                    | Fuzzy distance               |
| Custom term hook             | `tokenize` + `processTerm`, index and query can differ | Tokenizer config                         | Encoder                          | Pipeline                | Same at index and query      |
| Serialize                    | `JSON.stringify` then `loadJSON` / `loadJS`            | `save` / `load`                          | Split across keys                | `Index.load`            | Documents shipped separately |
| Index JSON, same 10 sections | 5.8 KB                                                 | 24 KB                                    | 30 KB                            |                         |                              |
| Licence                      | MIT                                                    | Apache-2.0                               | Apache-2.0                       | MIT                     | Apache-2.0                   |

MiniSearch wins on size, licence match and the per-term hooks. Its one weakness is a slow release pace (last release and commit both 16 Sep 2025); it is mature rather than abandoned. Runner-up: Orama, if filters or vector search are ever needed. FlexSearch returns no score, which the confidence gates need.

### Configuration used in the prototype

```ts
// ---------- index ----------
export const tokenizeIndex = (t: string) =>
  indexTerms(normPhrases(t)).map(canon);

export function buildIndex(root: string) {
  const sections = walk(root).flatMap((p) => parseFile(root, p));
  const byId = new Map(sections.map((s) => [s.id, s]));
  const df = new Map<string, number>();
  for (const s of sections)
    for (const t of new Set(tokenizeIndex(`${s.heading} ${s.prose} ${s.code}`)))
      df.set(t, (df.get(t) ?? 0) + 1);
  const ms = new MiniSearch<any>({
    idField: "id",
    fields: ["heading", "headingPath", "prose", "code"],
    extractField: (d, f) =>
      f === "headingPath" ? d.headingPath.join(" ") : d[f],
    tokenize: tokenizeIndex,
    processTerm: (t) => t,
  });
  ms.addAll(sections);
  const N = sections.length;
  const idf = (t: string) => {
    const n = df.get(t) ?? 0;
    return Math.log(1 + (N - n + 0.5) / (n + 0.5));
  };
  return { ms, sections, byId, df, idf };
}
export type Index = ReturnType<typeof buildIndex>;
```

Search call (inside `ask()`):

```ts
const results = idx.ms
  .search(expanded.join(" "), {
    tokenize: (s: string) => s.split(" "), // query terms are already processed
    processTerm: (t: string) => t,
    boost: { heading: 3, headingPath: 1.5, prose: 1, code: 0.6 },
    boostTerm: (t: string) =>
      exact.includes(t)
        ? 2
        : TRIGGER_WORDS.has(t)
          ? 0.3
          : original.has(t)
            ? 1
            : 0.4,
    prefix: (t: string) => t.length > 5,
    fuzzy: (t: string) => (t.length > 6 && !/[\/._]/.test(t) ? 0.15 : false), // never fuzz identifiers
    combineWith: "OR",
  })
  .slice(0, 25);
```

### How MiniSearch scores (for tuning)

```text
idf   = ln(1 + (N - n + 0.5) / (n + 0.5))
term  = idf * (d + tf * (k + 1) / (tf + k * (1 - b + b * fieldLen / avgFieldLen)))     k=1.2  b=0.7  d=0.5
score = sum(term * termBoost * fieldBoost * docBoost) * distinctQueryTermsMatched
```

Raw scores depend on the corpus and on how many terms matched, so never compare them across questions. All thresholds in section 11 are ratios.

### Serialization

- Build in Node: `JSON.stringify(ms)`. Load anywhere: `MiniSearch.loadJSON(json, options)` or `MiniSearch.loadJS(parsedObject, options)`.
- Functions are not saved. Pass the same `tokenize`, `processTerm` and `extractField` when loading. In the prototype, loading without them still answered correctly because `ask()` passes its query options on every call, but adding or removing documents after load would silently use the wrong tokenizer. Share one options module between build and load.
- Store a `formatVersion` and the package version in the index file, and refuse to load a mismatch with a clear message ("rebuild with docs-ask build").
- Stored field names must not be `id`, `score`, `terms`, `queryTerms` or `match`. MiniSearch spreads stored fields onto results and a field called `score` overwrote the real score in testing.
- Per-call search options replace constructor options shallowly. Passing `{ boost: {...} }` replaces the whole boost object.
- `autoSuggest`, `terms` and `match` return stems ("configur"). Compare stemmed forms when highlighting.

### Measured size and speed

| Corpus                                     | Sections | Index JSON (gz)                  | Sections with units (gz) | Build    | One `ask()`                            |
| ------------------------------------------ | -------- | -------------------------------- | ------------------------ | -------- | -------------------------------------- |
| Fastify docs, 30 files, 564 KB of markdown | 559      | 439 KB (108 KB)                  | 1,125 KB (176 KB)        | 606 ms   | 2.0 ms                                 |
| Vitest docs, 227 files, 1.45 MB            | 2,121    | 3,049 KB (758 KB) with full text |                          | 1,088 ms | 5.2 ms                                 |
| Synthetic, 2,000 sections                  | 2,000    | 620 KB gz without body           |                          |          | 3.3 ms, 30 ms with fuzzy on every term |

Fuzzy matching is the expensive part. Gate it by term length, or run it only when exact terms find nothing.

---

## 8. Stage 5: sort the question into a type

This is the if/switch part, done as data. The idea comes from 1990s question answering. The TREC QA track (1999 to 2002) and Jurafsky and Martin's classic QA chapter describe the same three steps: work out what kind of answer the question wants, find passages, then pull out the span of that kind. Li and Roth (2002) gave the standard question taxonomy.

| Docs type  | Li and Roth origin | Wants                                                       |
| ---------- | ------------------ | ----------------------------------------------------------- |
| HOWTO      | DESC:manner        | Numbered steps, or a code block with the sentence before it |
| DEFINITION | DESC:definition    | First one or two sentences under the matching heading       |
| ERROR      | DESC:reason        | Table row with a fix, or a cause/fix sentence               |
| VALUE      | NUM:*              | One sentence or item containing a number or literal         |
| LOCATION   | LOC:other          | File and heading path only                                  |
| ENDPOINT   | ENTY:term          | The line with `METHOD /path`                                |
| PARAMS     | ENTY:other         | Table rows or bullet items of fields                        |
| EXAMPLE    | new                | The code block                                              |
| YESNO      | new                | One sentence that confirms or denies                        |
| COMPARISON | new                | One sentence per side                                       |
| FALLBACK   | none               | Best one or two sentences                                   |

How the rules work, ELIZA-style: every type has regex triggers with weights. A type's score is the sum of the weights that matched. A type needs 3 or more to count. Highest score wins; `rank` breaks ties. Weak triggers (weight 1 or 2) like a bare "limit" only win when they stack, which is what stops "How do I set the body limit?" becoming VALUE.

```ts
// Question classification rules for software docs.
// ELIZA-style: every rule has weighted triggers; the highest total wins,
// ties broken by `rank`. Weight >= 3 is a "strong" trigger that can win alone.

export type QClass =
  | "ERROR"
  | "COMPARISON"
  | "PARAMS"
  | "ENDPOINT"
  | "VALUE"
  | "EXAMPLE"
  | "LOCATION"
  | "HOWTO"
  | "YESNO"
  | "DEFINITION"
  | "FALLBACK";

export type BlockKind =
  | "code"
  | "orderedList"
  | "list"
  | "tableRow"
  | "sentence"
  | "heading"
  | "blockquote";

export type AnswerShape =
  | "steps" // numbered list, else code block + lead sentence
  | "definition" // first 1-2 sentences under the matching heading
  | "endpoint" // line/sentence/code containing METHOD /path
  | "fieldList" // table rows, definition list or bullet list of params
  | "valueSentence" // single sentence containing a number/literal
  | "location" // file path + heading path only
  | "fix" // table row or sentence with "fix/solve/set/ensure"
  | "code" // the code block (+ sentence before it)
  | "yesNoEvidence" // one sentence that confirms or denies
  | "contrast" // sentence(s) mentioning both compared terms
  | "snippet"; // best 1-2 sentences

export interface Trigger {
  re: RegExp;
  weight: number;
}

export interface Rule {
  id: QClass;
  rank: number; // tie-breaker, higher wins
  triggers: Trigger[];
  preferBlocks: BlockKind[]; // in order of preference
  answerShape: AnswerShape;
  boosts: {
    headingTerms?: string[]; // add these (stemmed) to the query, heading field only
    sectionHas?: BlockKind[]; // multiply section score if it contains these blocks
    sectionHasFactor?: number;
    sentenceRe?: RegExp; // bonus for sentences matching this
    sentenceBonus?: number;
  };
  maxSentences: number;
}

// Reusable fragments
const AUX = String.raw`(?:can|could|does|do|is|are|will|should|may|must|would|has|have)`;
const HTTP_VERB = String.raw`\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b`;
export const NUMBERISH =
  /(?:`[^`]*\d[^`]*`|\b\d+(?:[.,]\d+)?\s*(?:ms|s|sec|seconds?|minutes?|hours?|days?|kb|mb|gb|kib|mib|bytes?|%|px)?\b|\b(?:true|false|null|undefined|none|unlimited|infinity)\b)/i;

export const RULES: Rule[] = [
  {
    id: "ERROR",
    rank: 100,
    triggers: [
      { re: /\b[45]\d\ds?\b/, weight: 3 }, // 401, 404, 500, "404s"
      {
        re: /\b(?:E[A-Z]{3,}|[A-Z]+_ERR_[A-Z_]+|[A-Z][a-zA-Z]*(?:Error|Exception))\b/,
        weight: 4,
      }, // ECONNREFUSED, FST_ERR_X, TypeError
      {
        re: /\b(?:error|errors|exception|stack ?trace|crash(?:es|ing)?|fail(?:s|ed|ing|ure)?|broken|throws?)\b/i,
        weight: 3,
      },
      {
        re: /\b(?:not working|doesn'?t work|does not work|won'?t|can'?t connect|unable to|timed out|times out|hangs?|refused|denied|unauthori[sz]ed|forbidden)\b/i,
        weight: 3,
      },
      {
        re: /\bwhy (?:does|do|is|are|am|did|won'?t|can'?t|isn'?t|doesn'?t)\b/i,
        weight: 2,
      },
      {
        re: /\b(?:too (?:long|slow|many|large|big)|cut off|slow|stuck|freez\w*|hang(?:s|ing)?|leak\w*|missing|empty response|undefined|null)\b/i,
        weight: 2,
      },
      { re: /\b(?:fix|troubleshoot|debug|resolve|solve)\b/i, weight: 2 },
    ],
    preferBlocks: ["tableRow", "sentence", "code", "list"],
    answerShape: "fix",
    boosts: {
      headingTerms: ["error", "troubleshoot", "faq", "common", "issue"],
      sentenceRe:
        /\b(?:fix|solve|resolv|make sure|ensure|check|increase|set|instead|because|caus|occur|thrown when)\w*/i,
      sentenceBonus: 0.3,
    },
    maxSentences: 2,
  },
  {
    id: "COMPARISON",
    rank: 90,
    triggers: [
      { re: /\bdifferen(?:ce|t)s? between\b/i, weight: 5 },
      {
        re: /\b(?:vs\.?|versus|compared (?:to|with)|comparison)\b/i,
        weight: 5,
      },
      { re: /\b(?:instead of|rather than|better|prefer)\b/i, weight: 2 },
      {
        re: /\bwhen (?:should|do|would) (?:i|you|we) use\b.*\bor\b/i,
        weight: 4,
      },
      {
        re: /\bwhich (?:one|is better|should i (?:use|pick|choose))\b/i,
        weight: 3,
      },
    ],
    preferBlocks: ["tableRow", "sentence", "list"],
    answerShape: "contrast",
    boosts: {
      headingTerms: ["vs", "versus", "comparison", "difference"],
      sentenceRe:
        /\b(?:whereas|while|unlike|instead|but|however|differ|compared|only)\b/i,
      sentenceBonus: 0.3,
    },
    maxSentences: 2,
  },
  {
    id: "PARAMS",
    rank: 80,
    triggers: [
      {
        re: /\b(?:param(?:eter)?s?|arguments?|args|options|flags|fields|properties|props|attributes|keys|headers|query ?string|request body|payload|schema)\b/i,
        weight: 3,
      },
      {
        re: /\bwhat (?:does|do) .{1,40}\b(?:accept|take|expect|return)s?\b/i,
        weight: 3,
      },
      {
        re: /\b(?:required|optional) (?:fields?|params?|parameters?|arguments?)\b/i,
        weight: 4,
      },
      { re: /\bsignature\b/i, weight: 3 },
    ],
    preferBlocks: ["tableRow", "list", "code", "sentence"],
    answerShape: "fieldList",
    boosts: {
      headingTerms: ["param", "option", "argument", "field", "propert"],
      sectionHas: ["tableRow", "list"],
      sectionHasFactor: 1.3,
    },
    maxSentences: 1,
  },
  {
    id: "ENDPOINT",
    rank: 70,
    triggers: [
      {
        re: /\b(?:endpoints?|routes?|urls?|uris?|api path|base url|webhook url)\b/i,
        weight: 3,
      },
      { re: /\bwhich (?:api|call|request|method)\b/i, weight: 3 },
      {
        re: new RegExp(
          String.raw`\bwhat (?:http )?(?:verb|method)\b|${HTTP_VERB}`,
        ),
        weight: 2,
      },
    ],
    preferBlocks: ["code", "sentence", "tableRow", "heading"],
    answerShape: "endpoint",
    boosts: {
      headingTerms: ["endpoint", "api", "rout"],
      sentenceRe: new RegExp(
        String.raw`${HTTP_VERB}\s+\/|(?:^|\s|\x60)\/[a-z0-9_{}:.-]+(?:\/[a-z0-9_{}:.-]*)+`,
        "i",
      ),
      sentenceBonus: 0.6,
    },
    maxSentences: 1,
  },
  {
    id: "VALUE",
    rank: 60,
    triggers: [
      {
        re: /\bwhat(?:'s| is| are)? (?:the )?(?:[\w-]+ )?(?:default|max(?:imum)?|min(?:imum)?|limit|size|port|version|value|timeout)s?\b/i,
        weight: 4,
      },
      { re: /\bhow (?:long|many|much|big|large|often|fast|old)\b/i, weight: 4 },
      { re: /\bdefaults?\b/i, weight: 2 },
      {
        re: /\b(?:limits?|maximum|minimum|max|min|timeouts?|ttl|expir(?:y|es|ation)|quota|port|size)\b/i,
        weight: 2,
      },
      { re: /\bwhen does .{1,40}\bexpire\b/i, weight: 4 },
    ],
    preferBlocks: ["sentence", "tableRow", "list", "code"],
    answerShape: "valueSentence",
    boosts: {
      headingTerms: ["default", "limit", "config"],
      sentenceRe:
        /\bdefaults?(?: value)?\s*(?::|=|is|of|to)\s*`?[\w.'"-]+|\b(?:limit|max(?:imum)?|timeout|ttl) (?:is|of)\s+`?\d/i,
      sentenceBonus: 0.8,
    },
    maxSentences: 1,
  },
  {
    id: "EXAMPLE",
    rank: 55,
    triggers: [
      { re: /\b(?:examples?|sample|snippet|demo)\b/i, weight: 4 },
      { re: /\bshow me\b/i, weight: 4 },
      { re: /\b(?:code|curl|command) (?:for|to)\b/i, weight: 3 },
    ],
    preferBlocks: ["code", "orderedList", "sentence"],
    answerShape: "code",
    boosts: {
      headingTerms: ["example", "usag"],
      sectionHas: ["code"],
      sectionHasFactor: 1.5,
    },
    maxSentences: 1,
  },
  {
    id: "LOCATION",
    rank: 50,
    triggers: [
      { re: /\bwhere (?:is|are|do|does|can|should|would)\b/i, weight: 4 },
      {
        re: /\bwhich (?:file|folder|directory|page|doc|section)\b/i,
        weight: 4,
      },
      { re: /\b(?:documented|located|defined|live[sd]?)\b/i, weight: 2 },
    ],
    preferBlocks: ["heading", "sentence"],
    answerShape: "location",
    boosts: {
      sentenceRe:
        /(?:\x60[^\x60]*\/[^\x60]*\x60|\b[\w.-]+\.(?:json|ya?ml|toml|env|ts|js|md|config)\b|\b(?:in|under|inside) (?:the )?\x60)/i,
      sentenceBonus: 0.4,
    },
    maxSentences: 1,
  },
  {
    id: "HOWTO",
    rank: 40,
    triggers: [
      { re: /\bhow (?:do|can|should|would) (?:i|we|you|one)\b/i, weight: 4 },
      { re: /\bhow to\b/i, weight: 4 },
      {
        re: /\b(?:steps? (?:to|for)|way to|guide (?:to|for)|walk ?through|tutorial)\b/i,
        weight: 4,
      },
      {
        re: /^(?:install|set ?up|configure|enable|disable|add|create|register|deploy|run|use|connect|migrate|upgrade)\b/i,
        weight: 3,
      }, // imperative queries
      {
        re: /\b(?:set ?up|install|configure|enable|disable|deploy|migrate|upgrade)\b/i,
        weight: 1,
      },
    ],
    preferBlocks: ["orderedList", "code", "sentence", "list"],
    answerShape: "steps",
    boosts: {
      headingTerms: ["how", "guid", "get", "start", "usag", "setup", "install"],
      sectionHas: ["orderedList", "code"],
      sectionHasFactor: 1.25,
      sentenceRe:
        /^(?:to |first|then|next|run|install|add|create|call|use|set|register|pass|import)\b/i,
      sentenceBonus: 0.2,
    },
    maxSentences: 2,
  },
  {
    id: "YESNO",
    rank: 30,
    triggers: [
      { re: new RegExp(String.raw`^${AUX}\s+\w`, "i"), weight: 3 }, // starts with an auxiliary verb
      {
        re: /\b(?:support(?:s|ed)?|possible|compatible|allowed|able to)\b/i,
        weight: 2,
      },
    ],
    preferBlocks: ["sentence", "tableRow"],
    answerShape: "yesNoEvidence",
    boosts: {
      sentenceRe:
        /\b(?:supports?|can|cannot|can't|not|only|must|requires?|allows?|possible|available|deprecated|no longer)\b/i,
      sentenceBonus: 0.3,
    },
    maxSentences: 1,
  },
  {
    id: "DEFINITION",
    rank: 20,
    triggers: [
      { re: /^(?:what|who)(?:'s| is| are)\b/i, weight: 3 },
      { re: /\bwhat (?:does|do) .{1,40}\b(?:mean|stand for|do)\b/i, weight: 4 },
      {
        re: /\b(?:define|definition of|meaning of|explain|overview of|purpose of)\b/i,
        weight: 4,
      },
      { re: /^(?:[\w.-]+)\??$/i, weight: 3 }, // single-term query: "hooks?"
    ],
    preferBlocks: ["sentence"],
    answerShape: "definition",
    boosts: {
      headingTerms: ["overview", "introduct", "what", "concept"],
      sentenceRe:
        /\b(?:is an?|are|refers? to|means|represents|allows? you to|lets you|is used to|is the)\b/i,
      sentenceBonus: 0.4,
    },
    maxSentences: 2,
  },
  {
    id: "FALLBACK",
    rank: 0,
    triggers: [],
    preferBlocks: ["sentence", "code", "list", "tableRow"],
    answerShape: "snippet",
    boosts: {},
    maxSentences: 2,
  },
];

export interface Classification {
  primary: Rule;
  secondary: Rule[];
  scores: Record<string, number>;
}

export function classify(question: string): Classification {
  const q = question.trim();
  const scored = RULES.filter((r) => r.id !== "FALLBACK").map((r) => ({
    rule: r,
    score: r.triggers.reduce((s, t) => s + (t.re.test(q) ? t.weight : 0), 0),
  }));
  const hits = scored
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score || b.rule.rank - a.rule.rank);
  const fallback = RULES.find((r) => r.id === "FALLBACK")!;
  return {
    primary: hits[0]?.rule ?? fallback,
    secondary: hits.slice(1).map((h) => h.rule),
    scores: Object.fromEntries(scored.map((x) => [x.rule.id, x.score])),
  };
}
```

Tested decisions (37/37 on a labelled set; the set was written while tuning, so expect lower on new phrasings):

| Question                                               | Result                         |
| ------------------------------------------------------ | ------------------------------ |
| What is the default bodyLimit?                         | VALUE (6) beats DEFINITION (3) |
| How do I set the body limit?                           | HOWTO (4) beats VALUE (2)      |
| How do I fix FST_ERR_CTP_BODY_TOO_LARGE                | ERROR, secondary HOWTO         |
| What parameters does POST /api/v1/apps accept?         | PARAMS                         |
| Can I see an example of a route schema?                | EXAMPLE beats YESNO            |
| Why is my request taking too long and getting cut off? | ERROR                          |
| hooks                                                  | DEFINITION                     |

Two lessons from the prototype:

1. Trigger words say what kind of answer is wanted, not which section holds it. After classifying, weight them at 0.3 in search and leave them out of coverage. The prototype's list of stemmed trigger words: `default, exampl, differ, between, vs, versus, error, fix, step, endpoint, paramet, option, mean, support, limit, document, locat, long, mani, much, big, often`.
2. COMPARISON needs two lookups, one per side. Tested splitter:

```ts
const CMP = [
  /\b(?:difference|differences|diff)\s+between\s+(.+?)\s+(?:and|vs\.?|versus|or)\s+(.+?)\s*\??$/i,
  /^(.+?)\s+(?:vs\.?|versus|compared (?:to|with))\s+(.+?)\s*\??$/i,
  /\bshould i use\s+(.+?)\s+or\s+(.+?)\s*\??$/i,
];
// "difference between onRequest and preHandler" -> ["onRequest", "preHandler"]
// "reply.send vs return" -> ["reply.send", "return"]
export function splitComparison(q: string): [string, string] | null {
  const m = CMP.map((r) => q.match(r)).find(Boolean);
  return m ? [m[1], m[2]] : null;
}

// ENDPOINT line matcher for code blocks and prose.
// Tested on "POST /api/v1/apps HTTP/1.1" and "curl -X POST https://x/api".
export const ENDPOINT_LINE =
  /^\s*(?:curl\s+(?:-\w+\s+)*-X\s+)?(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(?:https?:\/\/[^\/\s]+)?(\/[^\s?#"]*)/m;
```

The prototype does not yet run the two-lookup comparison. It is listed in the PRD as a v1 task.

---

## 9. Stage 6: find and rerank sections

BM25 gives the top 25 sections. Then each score is multiplied by rule-aware factors. Every factor below fixed a real failure in the prototype.

```text
sectionScore = bm25
  * (section contains the rule's preferred unit kinds ? rule.sectionHasFactor : 1)
  * (heading contains one of rule.headingTerms ? 1.15 : 1)
  * (1 + Jaccard(heading terms, question content terms))
  * (an exact identifier from the question is in the heading ? 1.5 : 1)
  * (the identifier starts a table row or list item ? 1.4 : 1)
  * (question has no identifiers and heading looks like a signature "(x: T)" ? 0.5 : 1)
```

- Jaccard overlap fixed "What is encapsulation?", which tied at 1% with "Decorators and Encapsulation" until the heading that says exactly "Encapsulation" got the bonus (gap after: 35%).
- The signature penalty fixed "How do I register a plugin?", which kept returning a TypeScript reference heading `fastify.FastifyRegister(plugin: FastifyPlugin, ...)`.
- The table-row factor moved "How do I fix FST_ERR_CTP_BODY_TOO_LARGE" to the Errors.md row that has a "How to solve" column.

Parent and child sections from the same file are not competitors. The gap check in section 11 ignores them.

---

## 10. Stage 7: pick the answer inside the section

### Ideas used

- Luhn (1958) scored sentences by clusters of significant words: words no more than four apart form a cluster, and a cluster scores `(significant words)^2 / cluster length`. Here the significant words are the query terms, which gives a cheap nearness score.
- Residual coverage: only count query terms the heading didn't already match. For "how long is keepAliveTimeout", the heading matched `keepAliveTimeout` and the answer unit is `Default: \`72000\` (72 seconds)`, which repeats none of the words. With plain coverage a sentence mentioning `server.keepAliveTimeout` won. With residual coverage plus the VALUE regex, the right unit scores 1.45 against 0.58.
- Only require an identifier inside the unit if the heading doesn't already contain it.
- TextRank (2004) was considered and dropped: it ignores the question, and "first sentence under the heading" does the same job for definitions.

### Formula

```text
R    = query content terms not in the section heading and not trigger words
C    = sum of idf(t) for t in R found in the unit / sum of idf(t) for t in R     (0.5 if R is empty)
P    = min(1, luhn(unit, gap 4) / |R|)
Pos  = 1 / (1 + position of the unit in the section)
T    = rule.sentenceBonus if rule.sentenceRe matches the unit, else 0
L    = 0.5 if under 4 tokens and T is 0; min(1, (tokens - 45) / 45) if over 45; else 0
Pref = 1 - 0.1 * index of the unit kind in rule.preferBlocks

unitScore = Pref * (1.0*C + 0.3*P + 0.15*Pos + 1.0*T - 0.3*L)
```

Shape overrides come first: HOWTO takes the ordered list (up to 12 items) with the sentence before it when the section has one, EXAMPLE takes the first code block with its lead sentence, LOCATION returns no text. A table row answer is always a single row. Units are returned in document order.

### Code (`pipeline.ts`, scoring part)

```ts
// ---------- sentence scoring ----------
// Words the classifier already consumed; they say what KIND of answer, not WHICH section.
export const TRIGGER_WORDS = new Set([
  "default",
  "exampl",
  "differ",
  "between",
  "vs",
  "versus",
  "error",
  "fix",
  "step",
  "endpoint",
  "paramet",
  "option",
  "mean",
  "support",
  "limit",
  "document",
  "locat",
  "long",
  "mani",
  "much",
  "big",
  "often",
]);

export const W = {
  coverage: 1.0,
  proximity: 0.3,
  position: 0.15,
  type: 1.0,
  lengthPenalty: 0.3,
};

export function luhn(sig: boolean[], gap = 4): number {
  // Luhn (1958): a cluster is a run of significant words with at most `gap`
  // non-significant words between them; its factor is sig^2 / span.
  let best = 0,
    start = -1,
    last = -1,
    count = 0;
  sig.forEach((isSig, i) => {
    if (!isSig) return;
    if (start === -1 || i - last - 1 > gap) {
      start = i;
      count = 0;
    }
    count++;
    last = i;
    best = Math.max(best, (count * count) / (last - start + 1));
  });
  return best;
}

export function scoreSentence(
  text: string,
  qAll: string[],
  idf: (t: string) => number,
  rule: Rule,
  posInSection: number,
  headingTerms: string[] = [],
) {
  const toks = tokenizeIndex(text);
  // residual query: terms the heading already answered do not need to be repeated in the sentence
  const residual = qAll.filter(
    (t) => !headingTerms.includes(t) && !TRIGGER_WORDS.has(t),
  );
  const q = residual.length ? residual : [];
  const qset = new Set(q);
  const present = new Set(toks.filter((t) => qset.has(t)));
  const total = q.reduce((s, t) => s + idf(t), 0) || 1;
  const coverage = q.length
    ? [...present].reduce((s, t) => s + idf(t), 0) / total
    : 0.5; // neutral when heading covered it
  const proximity = Math.min(
    1,
    luhn(toks.map((t) => qset.has(t))) / Math.max(1, q.length),
  );
  const position = 1 / (1 + posInSection);
  const type = rule.boosts.sentenceRe?.test(text)
    ? (rule.boosts.sentenceBonus ?? 0.3)
    : 0;
  const n = toks.length;
  const lengthPenalty =
    n < 4 && !type ? 0.5 : n > 45 ? Math.min(1, (n - 45) / 45) : 0;
  const score =
    W.coverage * coverage +
    W.proximity * proximity +
    W.position * position +
    W.type * type -
    W.lengthPenalty * lengthPenalty;
  return { score, coverage, proximity, position, type, lengthPenalty };
}
```

---

## 11. Stage 8: know when to say "not sure"

TREC 2001 stopped guaranteeing that every question had an answer, and the 2002 overview noted systems "had trouble recognizing when there was no answer". Docs Q&A has the same problem. A wrong confident answer costs more than "not sure, here are the three closest sections", so the gates run before extraction.

Gates, in order:

1. Unknown identifier. The question names something (`keepAliveTimout`, `text/csv`) that never appears in the docs. Abstain and suggest near spellings with `ms.autoSuggest(term, { fuzzy: 0.2 })` (the suggestion part is not in the prototype yet).
2. Weak coverage. IDF-weighted share of the question's content terms found in the top section is below 0.5.
3. Too close to call. `(top - second) / top` is below 0.05, or below 0.15 with coverage under 0.75. Parent/child sections of the same file are skipped when finding "second".
4. Shape evidence missing. VALUE with no number or literal in the section, ENDPOINT with no `METHOD /path` line, EXAMPLE with no code block.
5. Too broad. A one-word question whose term appears in more than 5% of sections with a gap under 0.3 is navigation, not a question.

The refusal still returns candidates. Real output for "how do I turn on logging", where the right sections came second and third:

```text
No confident answer (weak term coverage 0.24). Closest sections:
  1. Reference/Logging.md:232  Logging > Log Redaction
  2. Reference/Logging.md:16   Logging > Enable Logging > Basic logging setup
  3. Reference/Logging.md:5    Logging > Enable Logging
```

Calibrate the thresholds, don't guess them:

- Put 10 to 15% unanswerable questions in the golden set. Abstaining on those counts as correct.
- Sweep minimum coverage over 0.3 to 0.8 and minimum gap over 0.02 to 0.3 on a dev split.
- Pick the pair with the best precision when answered, subject to answer rate at least 0.8 and 100% abstain on unanswerable.
- Per-type thresholds are allowed: VALUE and ENDPOINT can be stricter because they have shape evidence, HOWTO looser.

Gates 1 to 3 plus the VALUE shape check are in the prototype. Gates 4 (ENDPOINT, EXAMPLE) and 5 are specified here and in the PRD but not yet implemented.

---

## 12. The whole `ask()` function

The prototype's `ask()` ties stages 3 and 5 to 8 together. It is one file for the spike; the PRD splits it into modules.

````ts
// ---------- ask ----------
export interface Answer {
  confident: boolean;
  qclass: string;
  reason: string;
  file?: string;
  line?: number;
  headingPath?: string[];
  text?: string;
  candidates: { file: string; line: number; heading: string; score: number }[];
}

export function ask(idx: Index, question: string, opts = { k: 5 }): Answer {
  const cls = classify(question);
  const rule = cls.primary;
  const { terms: rawQ, exact } = queryTerms(normPhrases(question));
  const q = [...new Set(rawQ.map(canon))];
  const exactWanted = exact;
  const original = new Set(q);
  const expanded = [
    ...new Set([...q, ...q.flatMap((t) => looseMap.get(t) ?? [])]),
  ];
  const results = idx.ms
    .search(expanded.join(" "), {
      tokenize: (s: string) => s.split(" "),
      processTerm: (t: string) => t,
      boost: { heading: 3, headingPath: 1.5, prose: 1, code: 0.6 },
      boostTerm: (t: string) =>
        exact.includes(t)
          ? 2
          : TRIGGER_WORDS.has(t)
            ? 0.3
            : original.has(t)
              ? 1
              : 0.4,
      prefix: (t: string) => t.length > 5,
      fuzzy: (t: string) => (t.length > 6 && !/[\/._]/.test(t) ? 0.15 : false),
      combineWith: "OR",
    })
    .slice(0, 25);

  const content = q.filter((t) => !TRIGGER_WORDS.has(t));
  const qIdf = content.reduce((a, t) => a + idx.idf(t), 0) || 1;
  const reranked = results
    .map((r) => {
      const s = idx.byId.get(r.id)!;
      let score = r.score;
      const kinds = new Set(s.blocks.map((b) => b.kind));
      if (rule.boosts.sectionHas?.some((k) => kinds.has(k)))
        score *= rule.boosts.sectionHasFactor ?? 1.2;
      const headTerms = tokenizeIndex(s.heading);
      if (
        rule.boosts.headingTerms?.some((h) =>
          headTerms.some((t) => t.startsWith(h)),
        )
      )
        score *= 1.15;
      if (exact.some((e) => headTerms.includes(e))) score *= 1.5;
      // "definition site": identifier is the first cell of a table row or the start of a list item
      if (
        exact.some((e) =>
          s.blocks.some(
            (b) =>
              (b.kind === "tableRow" || b.kind === "list") &&
              b.text
                .replace(/^[^:]*:\s*/, "")
                .toLowerCase()
                .startsWith(e),
          ),
        )
      )
        score *= 1.4;
      // API-signature headings (TypeScript reference) swamp plain questions
      if (!exact.length && /\(.*:.*\)/.test(s.heading)) score *= 0.5;
      // heading says exactly what was asked: Jaccard overlap of heading terms and query content terms
      const hs = new Set(headTerms),
        inter = content.filter((t) => hs.has(t)).length;
      const jaccard = inter / (hs.size + content.length - inter || 1);
      score *= 1 + jaccard;
      const matched = new Set(
        (r.queryTerms as string[]).filter((t) => content.includes(t)),
      );
      const idfCoverage =
        [...matched].reduce((a, t) => a + idx.idf(t), 0) / qIdf;
      return { s, score, idfCoverage };
    })
    .sort((a, b) => b.score - a.score);

  const candidates = reranked
    .slice(0, opts.k)
    .map((x) => ({
      file: x.s.file,
      line: x.s.line,
      heading: x.s.heading,
      score: +x.score.toFixed(2),
    }));
  const top = reranked[0],
    second = reranked[1];
  const noAnswer = (reason: string): Answer => ({
    confident: false,
    qclass: rule.id,
    reason,
    candidates,
  });
  if (!top) return noAnswer("no matching section");

  const unknown = exact.filter((e) => !idx.df.has(e));
  if (unknown.length)
    return noAnswer(`not found in docs: ${unknown.join(", ")}`);

  const related =
    !!second &&
    second.s.file === top.s.file &&
    (second.s.headingPath.includes(top.s.heading) ||
      top.s.headingPath.includes(second.s.heading));
  const gap = second && !related ? (top.score - second.score) / top.score : 1;
  if (top.idfCoverage < 0.5)
    return noAnswer(`weak term coverage (${top.idfCoverage.toFixed(2)})`);
  if (gap < 0.05 || (gap < 0.15 && top.idfCoverage < 0.75))
    return noAnswer(`ambiguous: top two within ${(gap * 100).toFixed(0)}%`);

  const sec = top.s;
  let picked: Unit[] = [];
  if (rule.answerShape !== "location") {
    const want: BlockKind | null =
      rule.answerShape === "code"
        ? "code"
        : rule.answerShape === "steps"
          ? "orderedList"
          : null;
    if (want && sec.blocks.some((b) => b.kind === want)) {
      const i = sec.blocks.findIndex((b) => b.kind === want);
      const lead = sec.blocks
        .slice(0, i)
        .reverse()
        .find((b) => b.kind === "sentence");
      picked = [
        ...(lead ? [lead] : []),
        ...sec.blocks
          .filter((b) => b.kind === want)
          .slice(0, want === "code" ? 1 : 12),
      ];
    } else {
      const pool = sec.blocks.filter(
        (b) => b.kind !== "heading" && rule.preferBlocks.includes(b.kind),
      );
      const scored = pool
        .map((b, i) => {
          const s = scoreSentence(
            b.text,
            q,
            idx.idf,
            rule,
            i,
            tokenizeIndex(sec.heading),
          );
          return {
            b,
            total: s.score * (1 - rule.preferBlocks.indexOf(b.kind) * 0.1),
          };
        })
        .sort((a, b) => b.total - a.total);
      if (rule.id === "VALUE" && !pool.some((b) => NUMBERISH.test(b.text)))
        return {
          ...noAnswer("VALUE question but best section has no value"),
          file: sec.file,
          line: sec.line,
        };
      const secHead = tokenizeIndex(sec.heading);
      const needExact = exactWanted.filter((e) => !secHead.includes(e)); // heading already names it? then don't force it
      const withExact = scored.filter((x) =>
        needExact.some((e) => x.b.text.toLowerCase().includes(e)),
      );
      const ranked = withExact.length ? withExact : scored;
      const n = ranked[0]?.b.kind === "tableRow" ? 1 : rule.maxSentences;
      picked = ranked
        .slice(0, n)
        .map((x) => x.b)
        .sort((a, b) => a.line - b.line);
    }
  }
  return {
    confident: true,
    qclass: rule.id,
    reason: `gap ${(gap * 100).toFixed(0)}%, coverage ${top.idfCoverage.toFixed(2)}`,
    file: sec.file,
    line: picked[0]?.line ?? sec.line,
    headingPath: [...sec.headingPath, sec.heading],
    text: picked
      .map((b) =>
        b.kind === "code"
          ? "```" + (b.lang ?? "") + "\n" + b.text + "\n```"
          : b.text,
      )
      .join("\n"),
    candidates,
  };
}
````

---

## 13. Output format

The same `Answer` object feeds all four surfaces. This is the target shape for v1. The prototype already returns `confident`, `qclass`, `reason`, `file`, `line`, `headingPath`, `text` and a simpler `candidates` list (file, line, heading, score).

```ts
export interface Answer {
  confident: boolean;
  level?: "high" | "medium"; // high: coverage >= 0.9 and gap >= 0.3
  qclass: QClass; // HOWTO, VALUE, ...
  reason: string; // "gap 89%, coverage 1.00" or why it abstained
  id?: string; // "Reference/Server.md#bodylimit"
  file?: string; // repo-relative, forward slashes
  line?: number; // line of the first answer unit
  endLine?: number;
  headingPath?: string[]; // ["Factory", "bodyLimit"]
  text?: string; // markdown of the picked units, code fenced
  units?: { kind: BlockKind; text: string; line: number }[];
  candidates: {
    id: string;
    file: string;
    line: number;
    headingPath: string[];
    score: number;
  }[]; // top 5, always present
  suggestions?: string[]; // near spellings when an identifier was unknown
}
```

Real answers from the prototype:

````text
Q: What is the default bodyLimit?
   VALUE, gap 89%, coverage 1.00
   Reference/Server.md:224  Factory > bodyLimit
   Default: `1048576` (1MiB)

Q: How do I fix FST_ERR_CTP_BODY_TOO_LARGE
   ERROR, gap 19%, coverage 1.00
   Reference/Errors.md:300  Errors > Fastify Error Codes
   Code: FST_ERR_CTP_BODY_TOO_LARGE | Description: The request body is larger than the provided limit. | How to solve: Increase the limit in the Fastify server instance setting: bodyLimit | Discussion: #1168

Q: how do I set a different log level for one route
   HOWTO, gap 55%, coverage 1.00
   Reference/Routes.md:505  Routes > Custom Log Level
   Different log levels can be set for routes in Fastify by passing the `logLevel` option to the plugin or route with the desired value.
   ```js
   fastify.register(require('./routes/user'), { logLevel: 'warn' })
   ...
````

Target CLI rendering (spec, not yet built):

```text
$ docs-ask ask "what is the default bodyLimit?"
Reference/Server.md:224  Factory > bodyLimit                      VALUE · high
Default: `1048576` (1MiB)

Also: Reference/ContentTypeParser.md:181  Custom Parser Options
      Reference/Server.md:2094  initialConfig
```

Exit codes: `0` confident answer, `2` not sure (candidates printed), `1` usage or build error. `--json` prints the `Answer` object.

---

## 14. Surface 1: the library

Target public API (spec):

```ts
// "docs-ask": browser-safe query side. No node:* imports anywhere under src/core or src/query.
export function loadIndex(
  data: SerializedIndex,
  options?: AskOptions,
): DocsIndex;
export class DocsIndex {
  ask(question: string, options?: { topK?: number }): Answer;
  get(id: string): Section | undefined;
  suggest(term: string): string[];
}

// "docs-ask/parse": markdown -> sections -> index. Works in the browser too, but pulls in markdown-it (60 KB gz).
export function parseDocument(file: string, source: string): ParsedDoc;
export function buildIndex(
  docs: ParsedDoc[],
  options?: BuildOptions,
): SerializedIndex;

// "docs-ask/node": filesystem helpers.
export function indexDirectory(
  root: string,
  options?: { include?: string[]; exclude?: string[] },
): Promise<SerializedIndex>;
export function loadDocs(root: string): Promise<DocsIndex>; // build in memory, or read docs-index.json if fresh
export function writeIndex(
  data: SerializedIndex,
  out: string,
  opts?: { gzip?: boolean },
): Promise<number>;

// "docs-ask/mcp"
export function createDocsMcpServer(index: DocsIndex): McpServer;

// "docs-ask/widget": registers <docs-ask>
export class DocsAskElement extends HTMLElement {}
```

`AskOptions` carries user synonyms, weight overrides and gate thresholds, so a repo can tune without forking. All weights live in one exported object so a sweep script can grid-search them (section 20).

Measured bundle sizes (esbuild, min+gz): query side (MiniSearch + rules + tokenizer + porter2 + synonyms) 11.5 KB; parse side (markdown-it + js-yaml + github-slugger + sentence splitter) 60.0 KB. Keeping them in separate entry points is what keeps the widget small.

---

## 15. Surface 2: the CLI

`node:util` gives both pieces with no dependencies:

- `parseArgs`: stable since Node 20.0.0. Negative options (`--no-x`) since 22.4.0.
- `styleText`: stable since 22.13.0. Respects `NO_COLOR`, `FORCE_COLOR` and non-TTY output since 22.8.0.

Commander 15.0.0 is 203 KB unpacked and needs Node 22.12; not worth it for three subcommands.

Use one bin with subcommands: `docs-ask ask`, `docs-ask build`, `docs-ask mcp`. A second bin called `docs-ask-mcp` breaks `npx -y docs-ask-mcp`, because npx looks for a package with that name.

Tested skeleton (it was written against a simpler index that returns hits; swap in the real `Answer`):

```ts
import { parseArgs, styleText } from "node:util";
import { resolve } from "node:path";
import { indexDirectory, writeIndex } from "../node/index.ts";
import { DocsIndex } from "../core/index.ts";

const HELP = `Usage:
  docs-ask ask "<question>" [--dir docs] [--top 3] [--json]
  docs-ask build [--dir docs] [--out docs-index.json] [--gzip]
  docs-ask mcp [dir]            (stdio MCP server; dir defaults to $CLAUDE_PROJECT_DIR or cwd)`;

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      dir: { type: "string", short: "d", default: "." },
      top: { type: "string", short: "k", default: "3" },
      out: { type: "string", short: "o", default: "docs-index.json" },
      gzip: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
  });
  const [cmd, ...rest] = positionals;
  if (values.help || !cmd) {
    console.log(HELP);
    return cmd ? 0 : 1;
  }
  if (cmd === "mcp") {
    const { runStdio } = await import("../mcp/stdio.ts"); // lazy: plain CLI never loads the MCP SDK
    await runStdio(
      resolve(rest[0] ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd()),
    );
    return 0; // stdin stays open, process keeps serving
  }
  const root = resolve(values.dir);

  if (cmd === "build") {
    const data = await indexDirectory(root);
    const bytes = await writeIndex(data, values.out, { gzip: values.gzip });
    console.log(
      `${styleText("green", "ok")} ${data.sections.length} sections, ${bytes} bytes -> ${values.out}`,
    );
    return 0;
  }
  if (cmd === "ask") {
    const question = rest.join(" ");
    if (!question) {
      console.error(styleText("red", "error: missing question"), `\n${HELP}`);
      return 1;
    }
    const index = new DocsIndex(await indexDirectory(root));
    const hits = index.ask(question, Number(values.top));
    if (values.json) {
      console.log(JSON.stringify(hits, null, 2));
      return hits.length ? 0 : 2; // same exit codes with or without --json
    }
    if (!hits.length) {
      console.log(styleText("yellow", "No match."));
      return 2;
    }
    for (const h of hits) {
      console.log(
        `${styleText(["bold", "cyan"], `${h.file}:${h.line}`)} ${styleText("bold", h.heading)} ${styleText("dim", `(${h.score})`)}`,
      );
      console.log(`  ${h.snippet}\n`);
    }
    return 0;
  }
  console.error(
    styleText("red", `error: unknown command "${cmd}"`),
    `\n${HELP}`,
  );
  return 1;
}
```

```ts
// src/cli/bin.ts
#!/usr/bin/env node
import { main } from './main.ts';

main().then(code => { process.exitCode = code; }, err => { console.error(err); process.exitCode = 1; });
```

tsdown keeps the shebang and marks the output executable. `package.json`: `"bin": { "docs-ask": "./dist/cli-bin.mjs" }`.

Real run of the packed tarball against the Vitest repo docs (227 files):

```text
$ npx docs-ask ask "how do I mock a module?" --dir $DOCS --top 3
api/vi.md:17 vi.mock (110.29)
guide/mocking.md:152 Mock part of a module (107.19)
guide/mocking/modules.md:30 Mocking a Module (100.5)
$ npx docs-ask build --dir $DOCS --out idx.json
ok 2121 sections, 3124044 bytes -> idx.json
$ npx docs-ask frob
error: unknown command "frob"          (exit 1)
```

---

## 16. Surface 3: the MCP server

### SDK facts (checked 10 Sep 2026)

- The TypeScript SDK v2 is split into `@modelcontextprotocol/server` and `@modelcontextprotocol/client` (both 2.0.0, 27 Jul 2026) and implements spec 2026-07-28.
- It needs `zod ^4.2.0` (zod 3 dropped) and Node 20+. v1 (`@modelcontextprotocol/sdk` 1.30.0) gets fixes for at least six months.
- `server.tool()` is removed. Use `registerTool(name, { title, description, inputSchema: z.object(...), outputSchema, annotations }, handler)`.
- `serveStdio(factory)` comes from the `/stdio` subpath. Its default `legacy: 'serve'` also answers 2025-era clients. Tested: the server negotiated both `2025-11-25` and `2026-07-28`.
- With `outputSchema`, the handler must return `structuredContent`; the SDK validates it. Also return a text block.
- Bad arguments come back as `isError: true` before the handler runs.
- The handler context moved from `extra` to `ctx` (`ctx.mcpReq.signal`). `McpError` is now `ProtocolError`.
- Annotation defaults are `readOnlyHint: false`, `destructiveHint: true`, `openWorldHint: true`, so set them explicitly.

### Claude Code behaviour to design around

- Claude Code sets `CLAUDE_PROJECT_DIR` in the server's environment. Use it as the default docs root.
- Tool output over 10,000 tokens triggers a warning; the default cap is 25,000 (`MAX_MCP_OUTPUT_TOKENS`).
- Tool descriptions and server `instructions` are cut at 2 KB each. With tool search on (the default), only tool names and server instructions load at session start, so the `instructions` string matters.
- Startup: indexing 227 pages in memory took 1.26 s from spawn to the `initialize` reply. Load `docs-index.json` when it is newer than the docs, or index lazily on the first call.

### Tools

- `ask_docs(question, topK = 3)`: returns the answer text with `file:line` first, then candidate ids. Read-only, idempotent, not open-world.
- `get_section(id)`: full section text, capped at 8,000 characters. Unknown id returns `isError` with "Call ask_docs first".

Tested server factory (again against the simpler hits index; the real one returns `Answer`):

```ts
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { DocsIndex } from "../core/index.ts";

const Hit = z.object({
  id: z.string(),
  file: z.string(),
  line: z.number().int(),
  heading: z.string(),
  snippet: z.string(),
  score: z.number(),
});

/** Side-effect free factory: exported as "docs-ask/mcp" so others can embed the tools. */
export function createDocsMcpServer(index: DocsIndex): McpServer {
  const server = new McpServer(
    { name: "docs-ask", version: "0.1.0" },
    {
      instructions:
        "Answers questions about this repository's markdown documentation with file:line citations. Search here before reading docs files by hand.",
    },
  );
  server.registerTool(
    "ask_docs",
    {
      title: "Ask the repo docs",
      description:
        'Search this repo\'s markdown docs. Returns up to topK sections as "file:line heading [id]" plus a 200-char snippet. Call get_section(id) for full text.',
      inputSchema: z.object({
        question: z
          .string()
          .min(2)
          .describe(
            'Question in plain words, e.g. "how do I refresh a token?"',
          ),
        topK: z
          .number()
          .int()
          .min(1)
          .max(10)
          .default(3)
          .describe("Max sections (default 3)"),
      }),
      outputSchema: z.object({ hits: z.array(Hit) }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ question, topK }) => {
      const hits = index.ask(question, topK);
      const text = hits.length
        ? hits
            .map(
              (h) =>
                `${h.file}:${h.line} ${h.heading} [${h.id}]\n  ${h.snippet}`,
            )
            .join("\n")
        : "No matching sections.";
      return { content: [{ type: "text", text }], structuredContent: { hits } };
    },
  );
  server.registerTool(
    "get_section",
    {
      title: "Get one doc section",
      description:
        "Full markdown of one section by id from ask_docs. Truncated at 8000 chars.",
      inputSchema: z.object({
        id: z.string().describe("Section id from ask_docs"),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      const s = index.get(id);
      if (!s)
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown id "${id}". Call ask_docs first to get valid ids.`,
            },
          ],
        };
      return {
        content: [
          {
            type: "text",
            text: `${s.file}:${s.line}\n## ${s.heading}\n\n${s.text.slice(0, 8000)}`,
          },
        ],
      };
    },
  );
  return server;
}
```

```ts
// src/mcp/stdio.ts
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadDocs } from "../node/index.ts";
import { createDocsMcpServer } from "./server.ts";

/** Start the stdio MCP server. stdout carries JSON-RPC, so log to stderr only. */
export async function runStdio(root: string) {
  const index = await loadDocs(root);
  console.error(`[docs-ask] indexed ${root}`);
  const handle = serveStdio(() => createDocsMcpServer(index));
  process.on("SIGINT", () => void handle.close());
}
```

Log to stderr only. stdout carries JSON-RPC.

### Testing it

```bash
# Headless, no Claude needed (Inspector 2.6.0 needs Node >= 22.19)
npx -y @modelcontextprotocol/inspector@2.6.0 --cli npx docs-ask mcp ./docs \
  --method tools/call --tool-name ask_docs --tool-arg question="how do I refresh a token?" --tool-arg topK=1
```

The Inspector does not pass environment variables like `CLAUDE_PROJECT_DIR`, so give the docs folder as an argument. Install the package locally first; the Inspector swallows `npx -y`.

### Registering in Claude Code

```bash
claude mcp add docs-ask -- npx -y docs-ask mcp                   # local scope: this project, stored in ~/.claude.json
claude mcp add --scope project docs-ask -- npx -y docs-ask mcp   # writes .mcp.json at the repo root, shared through git
claude mcp add --scope user docs-ask -- npx -y docs-ask mcp      # every project
claude mcp list        # inside a session: /mcp
```

Options like `--scope` and `--env` go before `--`. Everything after `--` is passed to the server.

`.mcp.json` equivalent:

```json
{
  "mcpServers": {
    "docs-ask": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "docs-ask", "mcp", "${CLAUDE_PROJECT_DIR:-.}"]
    }
  }
}
```

---

## 17. Surface 4: the browser widget

### Pattern

- A custom element: `<docs-ask index="/docs-index.json" base-url="/docs/"></docs-ask>`. Open Shadow DOM, no framework.
- Fetch the index on first focus, not on page load.
- Shortcuts: `/` (ignored while typing in a field) and Cmd/Ctrl+K.
- Accessibility follows the WAI-ARIA combobox pattern: `role=combobox`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, and `role=option` inside `role=listbox`. The input and list must share one shadow root, because ARIA id references don't cross shadow boundaries.
- Selecting a result fires `docs-ask:select` with `composed: true` and navigates to `base-url + file#slug` if `base-url` is set.
- Safe to import during server rendering: `const Base = globalThis.HTMLElement ?? class {}`.
- Styling through `::part(input)` and `::part(listbox)`, plus system colours (`Canvas`, `Highlight`) so it follows light and dark mode.

### Index for the web

The widget needs units to show real answers, not only links. Measured on Fastify (30 files): index 108 KB gz plus sections with units 176 KB gz. For a 227-page site, full text pushed the index to 758 KB gz, and a snippet-only variant was 488 KB gz. So `docs-ask build --target web` should write:

- the MiniSearch JSON,
- sections with their units (no raw markdown),
- the document-frequency map for IDF,
- `formatVersion` and the package version.

Let the host's HTTP compression shrink the `.json`. Use `DecompressionStream('gzip')` only for a raw `.json.gz` served without `Content-Encoding`. It is Baseline widely available since Nov 2025 (Chrome 80, Firefox 113, Safari 16.4). Brotli is not.

### Tested skeleton

Tested in happy-dom: nothing fetched before focus, Ctrl+K focuses, ArrowDown sets `aria-activedescendant`, a `.json.gz` index is decompressed. The IIFE build was 21.4 KB, 7.4 KB gz with MiniSearch bundled. With the real query pipeline, expect about 15 KB gz (11.5 KB measured for the query side alone).

```ts
// <docs-ask index="/docs-index.json"> : zero-dependency custom element (core bundled in IIFE build).
import { DocsIndex, type Hit, type SerializedIndex } from "../core/index.ts";

async function fetchIndex(url: string): Promise<DocsIndex> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`docs-ask: ${res.status} loading ${url}`);
  // Prefer HTTP Content-Encoding (browser decodes transparently). Raw .gz files need manual inflate.
  const body =
    url.endsWith(".gz") && !res.headers.get("content-encoding")
      ? res.body!.pipeThrough(new DecompressionStream("gzip"))
      : res.body!;
  return new DocsIndex((await new Response(body).json()) as SerializedIndex);
}

const CSS = `:host{display:inline-block;position:relative;font:inherit}
input{font:inherit;padding:.4em .6em;min-width:16em}
ul{position:absolute;z-index:10;left:0;right:0;margin:0;padding:0;list-style:none;background:Canvas;color:CanvasText;border:1px solid GrayText;max-height:60vh;overflow:auto}
li{padding:.4em .6em;cursor:pointer}li[aria-selected=true]{background:Highlight;color:HighlightText}
small{display:block;opacity:.75}`;

// SSR-safe: importing in Node (Astro, Next) must not throw.
const Base = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

export class DocsAskElement extends Base {
  #index?: Promise<DocsIndex>;
  #hits: Hit[] = [];
  #active = -1;
  #input!: HTMLInputElement;
  #list!: HTMLUListElement;

  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}</style>
      <input part="input" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false"
        aria-controls="lb" aria-label="${this.getAttribute("label") ?? "Search docs"}" placeholder="Ask the docs (/)">
      <ul part="listbox" id="lb" role="listbox" hidden></ul>`;
    this.#input = root.querySelector("input")!;
    this.#list = root.querySelector("ul")!;
    this.#input.addEventListener("focus", () => this.load(), { once: true }); // lazy: fetch on first focus
    this.#input.addEventListener("input", () => this.search());
    this.#input.addEventListener("keydown", (e) => this.onKey(e));
    this.#list.addEventListener("mousedown", (e) => {
      const li = (e.target as Element).closest("li");
      if (li) {
        e.preventDefault();
        this.pick(Number(li.dataset.i));
      }
    });
    document.addEventListener("keydown", this.#globalKey);
  }
  disconnectedCallback() {
    document.removeEventListener("keydown", this.#globalKey);
  }

  #globalKey = (e: KeyboardEvent) => {
    const typing = (e.target as HTMLElement)?.closest?.(
      "input,textarea,[contenteditable]",
    );
    if (
      (e.key === "/" && !typing) ||
      (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))
    ) {
      e.preventDefault();
      this.#input.focus();
    }
  };

  load() {
    return (this.#index ??= fetchIndex(
      this.getAttribute("index") ?? "/docs-index.json",
    ));
  }

  async search() {
    const q = this.#input.value.trim();
    this.#hits =
      q.length < 2
        ? []
        : (await this.load()).ask(q, Number(this.getAttribute("top") ?? 3));
    this.#active = -1;
    this.render();
  }

  render() {
    const open = this.#hits.length > 0;
    this.#list.hidden = !open;
    this.#input.setAttribute("aria-expanded", String(open));
    this.#list.replaceChildren(
      ...this.#hits.map((h, i) => {
        const li = document.createElement("li");
        li.id = `opt-${i}`;
        li.dataset.i = String(i);
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", String(i === this.#active));
        li.textContent = h.heading;
        const small = document.createElement("small");
        small.textContent = `${h.file}:${h.line}`;
        li.append(small);
        return li;
      }),
    );
    if (this.#active >= 0)
      this.#input.setAttribute("aria-activedescendant", `opt-${this.#active}`);
    else this.#input.removeAttribute("aria-activedescendant");
  }

  onKey(e: KeyboardEvent) {
    const n = this.#hits.length;
    if (e.key === "ArrowDown" && n) {
      e.preventDefault();
      this.#active = (this.#active + 1) % n;
      this.render();
    } else if (e.key === "ArrowUp" && n) {
      e.preventDefault();
      this.#active = (this.#active - 1 + n) % n;
      this.render();
    } else if (e.key === "Enter" && this.#active >= 0) {
      e.preventDefault();
      this.pick(this.#active);
    } else if (e.key === "Escape") {
      this.#hits = [];
      this.render();
    }
  }

  pick(i: number) {
    const hit = this.#hits[i];
    this.dispatchEvent(
      new CustomEvent("docs-ask:select", {
        detail: hit,
        bubbles: true,
        composed: true,
      }),
    );
    const base = this.getAttribute("base-url");
    if (base)
      location.href = `${base}${hit.file.replace(/\.mdx?$/, "")}#${hit.id.split("#")[1]}`;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("docs-ask")) {
  customElements.define("docs-ask", DocsAskElement);
}
```

Usage:

```html
<script src="https://cdn.jsdelivr.net/npm/docs-ask@0.1/dist/docs-ask-widget.iife.js"></script>
<docs-ask index="/docs-index.json" base-url="/docs/"></docs-ask>
```

---

## 18. Packaging and repo layout

### One package, not a monorepo

```text
docs-ask/
  src/core/       types, serialized index format, version checks          (browser-safe)
  src/query/      tokenizer, synonyms, rules, rerank, extract, gates, ask (browser-safe)
  src/parse/      markdown-it parser, sentence splitter, buildIndex      (browser-safe, heavy)
  src/node/       fs.glob walk, .gitignore, read/write index, config file
  src/cli/        main.ts, bin.ts
  src/mcp/        server.ts, stdio.ts
  src/widget/     custom element
  test/           fixtures (Fastify docs pinned at v5.6.0 + a second corpus), unit tests, golden eval
  scripts/        fetch-corpus.sh, sweep.ts
  tsdown.config.ts  tsconfig.json  vitest.config.ts  .github/workflows/{ci,release}.yml
```

One build emits shared chunks, so users never load two copies of the core (which would break `instanceof`). Installing brings in `minisearch`, `markdown-it`, `js-yaml`, `github-slugger`, `porter2`, `ignore`, `zod` and `@modelcontextprotocol/server`. Widget users on the CDN install nothing. If widget-only npm users complain about the MCP SDK, make it an optional peer dependency later.

Add a test that fails if anything reachable from `src/core`, `src/query` or `src/widget` imports `node:`.

### Build config

Tested with the five entries it had in the research package. The `parse` entry was added afterwards and hasn't been built yet. The query side has no entry of its own: `src/core/index.ts` re-exports `loadIndex` and `DocsIndex` from `src/query`, so it ships as `.`.

```ts
import { defineConfig } from "tsdown";

export default defineConfig([
  // 1) npm entries, ESM only. One build so core is emitted once as a shared chunk.
  {
    entry: {
      index: "src/core/index.ts", // "."        browser + node safe, re-exports src/query
      parse: "src/parse/index.ts", // "./parse"  markdown -> index, browser-safe but heavy
      node: "src/node/index.ts", // "./node"   fs helpers
      mcp: "src/mcp/server.ts", // "./mcp"    createDocsMcpServer()
      "cli-bin": "src/cli/bin.ts", // bin docs-ask (ask | build | mcp)
      widget: "src/widget/index.ts", // "./widget" for bundler users
    },
    format: "esm",
    platform: "node",
    target: "node22",
    dts: true,
    publint: true,
    attw: { profile: "esm-only" },
  },
  // 2) Drop-in <script> build for the widget: everything bundled, minified, no Node.
  {
    entry: { "docs-ask-widget": "src/widget/index.ts" },
    format: "iife",
    platform: "browser",
    target: "es2022",
    globalName: "DocsAsk",
    minify: true,
    dts: false,
    clean: false,
    deps: { alwaysBundle: [/.*/] },
    outExtensions: () => ({ js: ".js" }),
  },
]);
```

Build output in the research package: widget IIFE 21.43 KB (7.34 KB gz), ESM total 15 KB, attw "No problems found", publint "No issues found".

TypeScript 7.0.2 (the Go compiler) passed `tsc --noEmit`. tsdown warns that TypeScript 7 has no stable API yet but produced correct declarations. If declaration output breaks, pin `typescript@6.0.3` for the build.

### `package.json`

The `exports` block was tested with publint and attw in the research package. `./parse`, the full dependency list and the repo URLs were added afterwards.

```json
{
  "name": "docs-ask",
  "version": "0.1.0",
  "description": "Answer questions about a repo's markdown docs without an LLM: library, CLI, MCP server, web widget",
  "keywords": ["markdown", "docs", "search", "mcp", "cli", "web-component"],
  "license": "MIT",
  "author": "Abdulkader Safi",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Abdulkader-Safi/docs-ask.git"
  },
  "homepage": "https://github.com/Abdulkader-Safi/docs-ask#readme",
  "bugs": "https://github.com/Abdulkader-Safi/docs-ask/issues",
  "type": "module",
  "sideEffects": ["./dist/widget.mjs", "./dist/docs-ask-widget.iife.js"],
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "default": "./dist/index.mjs"
    },
    "./parse": {
      "types": "./dist/parse.d.mts",
      "default": "./dist/parse.mjs"
    },
    "./node": {
      "types": "./dist/node.d.mts",
      "node": "./dist/node.mjs"
    },
    "./mcp": {
      "types": "./dist/mcp.d.mts",
      "node": "./dist/mcp.mjs"
    },
    "./widget": {
      "types": "./dist/widget.d.mts",
      "browser": "./dist/widget.mjs",
      "default": "./dist/widget.mjs"
    },
    "./package.json": "./package.json"
  },
  "bin": {
    "docs-ask": "./dist/cli-bin.mjs"
  },
  "jsdelivr": "./dist/docs-ask-widget.iife.js",
  "unpkg": "./dist/docs-ask-widget.iife.js",
  "files": ["dist"],
  "engines": {
    "node": ">=22.17.0"
  },
  "scripts": {
    "build": "tsdown",
    "typecheck": "tsc -p .",
    "test": "vitest run",
    "lint": "publint && attw --pack . --profile esm-only",
    "prepublishOnly": "npm run typecheck && npm test && npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^2.0.0",
    "github-slugger": "^2.0.0",
    "ignore": "^7.0.9",
    "js-yaml": "^5.4.1",
    "markdown-it": "^15.0.1",
    "minisearch": "^7.2.0",
    "porter2": "^2.0.0",
    "zod": "^4.6.1"
  },
  "devDependencies": {
    "@arethetypeswrong/cli": "^0.18.5",
    "@types/node": "^24.13.4",
    "happy-dom": "^20.14.3",
    "publint": "^0.3.24",
    "tsdown": "^0.23.0",
    "typescript": "^7.0.2",
    "vitest": "^5.0.0"
  }
}
```

Notes on `exports`:

- The first matching condition wins. Put `types` first.
- `.` has no conditions: same code in Node and the browser.
- `./node` and `./mcp` have only a `node` condition and no `default`, so a browser bundler fails loudly instead of quietly bundling `fs`.
- The IIFE is not in `exports` (attw flagged it). The `jsdelivr` and `unpkg` fields point the bare CDN URL at it.
- ESM-only is fine: `require(esm)` works without a flag since Node 22.12.
- `engines.node` is `>=22.17.0` because `fs.glob` became stable in 22.17.0.

### `tsconfig.json` (tested)

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["es2023", "dom", "dom.iterable"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "isolatedDeclarations": false,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  },
  "include": ["src", "test", "tsdown.config.ts", "vitest.config.ts"]
}
```

`.ts` import extensions let `node src/cli/bin.ts` run directly: type stripping is on by default since Node 22.18.0.

---

## 19. Publishing

npm trusted publishing (OIDC from GitHub Actions) is the standard now:

- Needs npm 11.5.1+ and Node 22.14+. Node 22 bundles npm 10.9.8, so run the publish job on Node 24 (bundles npm 11.19.0).
- Provenance is added automatically for a public repo and package. No `--provenance` flag, no token.
- `repository.url` in `package.json` must exactly match the GitHub repo.
- The package must exist on npm before trust can be set up. That step is done: Safi published a `0.0.1` placeholder by hand on 10 Sep 2026. Next, run `npm trust github docs-ask --file release.yml --repo Abdulkader-Safi/docs-ask --allow-publish`, then turn on "Require two-factor authentication and disallow tokens".
- `npm trust` needs npm 11.15.0 or newer. Node 22 bundles npm 10.9.8, so run it as `npx npm@11 trust ...` or from Node 24.

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ["v*"]
permissions:
  id-token: write # OIDC for npm trusted publishing (provenance is automatic)
  contents: read
jobs:
  publish:
    runs-on: ubuntu-latest # GitHub-hosted runner required
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: "24" # bundles npm 11.19 (trusted publishing needs npm >= 11.5.1, Node >= 22.14)
          registry-url: "https://registry.npmjs.org"
          package-manager-cache: false
      - run: npm ci
      - run: npm run typecheck && npm test && npm run build && npm run lint
      - run: npm publish # no NODE_AUTH_TOKEN, no --provenance flag needed
```

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: ["22", "24", "26"]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: "${{ matrix.node }}" }
      - run: npm ci
      - run: npm run typecheck && npm run build && npm test && npm run lint
```

Releases: for one package, `npm version patch && git push --follow-tags` triggers the workflow. Add release-please (17.11.2) later if generated changelogs are wanted. Changesets (3.0.2) mainly pays off in monorepos.

Node lines on 10 Sep 2026: 20 is end of life (30 Apr 2026); 22 is maintenance LTS until 30 Apr 2027; 24 is active LTS; 26 becomes LTS on 28 Oct 2026.

---

## 20. Testing and measuring accuracy

A no-model system is only as good as its rules and weights, and every weight change can fix one question and break two. So accuracy is a test that runs on every commit.

### Golden question set

```ts
export interface Golden {
  q: string;
  accept?: { file: string; heading: string }[]; // several right sections are allowed
  qclass?: QClass; // expected question type
  contains?: string; // the answer text must include this
  unanswerable?: boolean; // right behaviour is "not sure"
  split?: "dev" | "test"; // tune on dev only
}
```

- The prototype's `golden.ts` still uses one `file` and `heading` per question; the held-out script already uses `accept` lists. Use `accept` in the real package.
- Allow several accepted sections. In the prototype, 3 of 9 "failures" were defensible answers a single label rejected (for example the `onRequestAbort` hook instead of the abort guide).
- Aim for 100 to 200 questions, about 15 per type, 10 to 15% unanswerable.
- Write at least half without looking at the headings. Pull real phrasing from the project's GitHub issue and discussion titles. Paraphrase is where rules break.
- Freeze a `test` split and never tune against it.

### Metrics

For each answerable question, `rank` is the position of the first accepted section in the top candidates (0 if missing).

| Metric                  | Formula                                        | Meaning                                       |
| ----------------------- | ---------------------------------------------- | --------------------------------------------- |
| Top-1                   | share of questions with rank 1                 | Right section first                           |
| Recall@3                | share with rank 1 to 3                         | Right section somewhere in what the user sees |
| MRR                     | mean of 1/rank (0 when missing)                | TREC-8's metric. Ranks 3, 2, 1 give 0.61      |
| Answer accuracy         | confident, right section, `contains` satisfied | Fully right answers                           |
| Precision when answered | right answers / confident answers              | How much to trust a confident answer          |
| Answer rate             | confident / answerable                         | How often it commits                          |
| Abstain on unanswerable | not confident / unanswerable                   | Honesty                                       |
| Classifier accuracy     | right `qclass` / labelled                      | Rule quality                                  |

### Test setup (`vitest`, green in the prototype: 33 tests, under 2 s)

```ts
import { ask, type Index } from "./pipeline.ts";
import { classify } from "./rules.ts";
import type { Golden } from "./golden.ts";

export interface Row {
  q: string;
  rank: number;
  confident: boolean;
  answerOk: boolean;
  classOk: boolean;
  unanswerable: boolean;
}

export function evaluate(idx: Index, golden: Golden[], k = 10) {
  const rows: Row[] = golden.map((g) => {
    const a = ask(idx, g.q, { k });
    const rank = g.unanswerable
      ? 0
      : a.candidates.findIndex(
          (c) => c.file === g.file && c.heading === g.heading,
        ) + 1; // 0 = not in top k
    const answerOk = g.unanswerable
      ? !a.confident
      : a.confident &&
        a.file === g.file &&
        a.headingPath?.at(-1) === g.heading &&
        (!g.contains || !!a.text?.includes(g.contains));
    return {
      q: g.q,
      rank,
      confident: a.confident,
      answerOk,
      classOk: !g.qclass || classify(g.q).primary.id === g.qclass,
      unanswerable: !!g.unanswerable,
    };
  });
  const ans = rows.filter((r) => !r.unanswerable);
  const una = rows.filter((r) => r.unanswerable);
  const mean = (xs: number[]) =>
    xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const answered = ans.filter((r) => r.confident);
  return {
    rows,
    top1: mean(ans.map((r) => (r.rank === 1 ? 1 : 0))),
    recallAt3: mean(ans.map((r) => (r.rank >= 1 && r.rank <= 3 ? 1 : 0))),
    mrr: mean(ans.map((r) => (r.rank ? 1 / r.rank : 0))),
    answerAccuracy: mean(ans.map((r) => (r.answerOk ? 1 : 0))), // correct AND confident
    precisionWhenAnswered: mean(answered.map((r) => (r.answerOk ? 1 : 0))), // of the answers we gave, how many were right
    answerRate: answered.length / (ans.length || 1),
    abstainOnUnanswerable: mean(una.map((r) => (r.answerOk ? 1 : 0))),
    classifierAccuracy: mean(rows.map((r) => (r.classOk ? 1 : 0))),
  };
}
```

```ts
import { describe, it, expect, beforeAll } from "vitest";
import baseline from "./baseline.json" with { type: "json" };
import { buildIndex, type Index } from "../src/pipeline.ts";
import { evaluate } from "../src/metrics.ts";
import { GOLDEN } from "../src/golden.ts";
import { classify } from "../src/rules.ts";

const TOLERANCE = 0.02; // allow tiny noise, fail on real regressions

describe("question classifier", () => {
  it.each(GOLDEN.filter((g) => g.qclass).map((g) => [g.q, g.qclass!]))(
    "%s -> %s",
    (q, want) => {
      expect(classify(q).primary.id).toBe(want);
    },
  );
});

describe("retrieval + extraction quality (golden set)", () => {
  let idx: Index;
  let m: ReturnType<typeof evaluate>;
  beforeAll(() => {
    idx = buildIndex("corpus");
    m = evaluate(idx, GOLDEN);
  });

  it("does not regress aggregate metrics", () => {
    const { rows, ...summary } = m;
    console.table(summary);
    for (const [k, min] of Object.entries(baseline)) {
      expect
        .soft(summary[k as keyof typeof summary], k)
        .toBeGreaterThanOrEqual((min as number) - TOLERANCE);
    }
  });

  it("never answers confidently when docs have no answer", () => {
    const bad = m.rows
      .filter((r) => r.unanswerable && r.confident)
      .map((r) => r.q);
    expect(bad).toEqual([]);
  });

  it("per-question ranks match the committed snapshot", async () => {
    const table = m.rows
      .map(
        (r) =>
          `${r.answerOk ? "ok  " : "FAIL"} rank=${r.rank} ${r.confident ? "ans" : "abs"} ${r.q}`,
      )
      .join("\n");
    await expect(table).toMatchFileSnapshot("./__snapshots__/golden-ranks.txt");
  });
});
```

Workflow: the baseline file catches regressions; `toMatchFileSnapshot` writes a readable per-question table so a diff shows exactly which questions moved. Accept an intended improvement with `vitest -u` and raise `baseline.json` in the same commit. Keep every weight and threshold in one exported object so `scripts/sweep.ts` can grid-search them against the dev split.

### Measured results

Tuned set: 26 answerable + 4 unanswerable questions on the Fastify docs, written while the rules were being tuned. Optimistic.

| Metric                  | Result |
| ----------------------- | ------ |
| Top-1                   | 0.69   |
| Recall@3                | 0.81   |
| MRR                     | 0.76   |
| Answer accuracy         | 0.65   |
| Precision when answered | 0.74   |
| Answer rate             | 0.88   |
| Abstain on unanswerable | 4/4    |
| Classifier accuracy     | 1.00   |

Held-out set: 14 answerable + 2 unanswerable questions written for this report after the rules were frozen, with several accepted sections each. This is the honest number.

| Question                                                          | Result                                                                                                               |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| how can I make the router ignore a trailing slash                 | Right section, `Server.md:869 ignoreTrailingSlash`, but the quote was a generic intro sentence plus the code example |
| what is the default max length of a route parameter               | Right, `Server.md:899 maxParamLength`                                                                                |
| how do I add a property to the request object                     | Right, `Hooks.md:787 Using Hooks to Inject Custom Properties`                                                        |
| how do I set a different log level for one route                  | Right, `Routes.md:505 Custom Log Level`                                                                              |
| can I route based on the Host header                              | Right, `Routes.md:694 Host Constraints`                                                                              |
| how do I trust the X-Forwarded-For header behind a load balancer? | Abstained (coverage 0.50), right section ranked 1st                                                                  |
| how do I parse a custom content type like text/csv                | Abstained (unknown identifier `text/csv`), right section ranked 1st                                                  |
| how do I turn on logging                                          | Abstained (coverage 0.24), right section ranked 2nd                                                                  |
| how do I share a JSON schema between routes                       | Abstained (top two within 10%), right section ranked 2nd                                                             |
| how do I stop the server gracefully                               | Abstained, right section ranked 4th                                                                                  |
| how do I handle 404s myself                                       | Abstained, right section not in top 5                                                                                |
| how do I list all registered routes                               | Abstained, right section not in top 5                                                                                |
| which hook runs when the request times out                        | Wrong: `Plugins-Guide.md > Hooks`; right section ranked 2nd                                                          |
| how do I set the status code of the response                      | Wrong: a validation `.statusCode` property; right section ranked 4th                                                 |
| how do I enable CORS                                              | Correctly abstained (not in these docs)                                                                              |
| how do I send emails from a route                                 | Correctly abstained                                                                                                  |

| Metric                  | Held-out      |
| ----------------------- | ------------- |
| Top-1                   | 0.50          |
| Recall@3                | 0.71          |
| Answer rate             | 0.50          |
| Precision when answered | 0.71 (5 of 7) |
| Abstain on unanswerable | 2/2           |

Reading it: when it answers, it is usually right, and the right section is in the top three about 7 times in 10. It abstains too often on plain questions ("turn on logging", "handle 404s") because the docs use different words ("logger: true", "setNotFoundHandler"). The fixes are known and cheap: synonyms (404 = not found, turn on = enable, stop = close), a HOWTO-specific coverage threshold, and letting an identifier-like heading match its words ("setNotFoundHandler" contains "not found handler"). These are v1 tuning tasks in the PRD, measured against a dev split so the held-out set stays honest.

### Test corpora (licences checked)

| Corpus                        | Licence      | Use                                                                                                                                            |
| ----------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Fastify `docs/` at tag v5.6.0 | MIT          | Primary. Option pages with `Default:` lines, an error table with a "How to solve" column, plus guides. Pin the tag so line numbers stay stable |
| Hono website docs             | MIT          | Second corpus, different writing style, catches overfitting                                                                                    |
| Meilisearch docs              | MIT          | Real REST API reference (MDX)                                                                                                                  |
| GitHub Docs                   | CC BY 4.0    | Large and realistic, needs attribution, Liquid templates                                                                                       |
| Express docs                  | CC BY 4.0    | Needs attribution                                                                                                                              |
| Mastodon docs                 | GFDL 1.3     | Great REST format, but copyleft: download at test time, don't vendor                                                                           |
| Discord API docs              | CC BY-SA 4.0 | Share-alike: same caveat                                                                                                                       |

Vendor Fastify and Hono with their LICENSE files under `test/fixtures/`.

---

## 21. What it can't do

Real failures from the prototype:

1. Different words. "What is the maximum request body size?" returned a body parser section; the answer (`bodyLimit`) ranked 2nd. The docs say "payload" and "bodyLimit".
2. Get versus set. "How do I set a response header?" returned `.getHeaders()`. Stemming merges `header`, `headers` and `getHeaders`, and nothing models the verb.
3. Negation. "How can I test my routes without starting a server?" returned "Testing with a running server", the opposite.
4. Missing synonym. "How do I hide passwords in logs?" found "Log Redaction" but abstained. Only a synonym entry fixes it.
5. Symptom to cause. "Why is my request taking too long and getting cut off?" needs reasoning from the symptom to `requestTimeout`.
6. Advice. "Should I put fastify behind nginx?" found the right section but abstained; recommendations don't look like their questions.
7. Comparisons spread over a diagram. The real difference between two hooks lives in an ASCII lifecycle diagram.

Predictable failures:

- Questions that need two sections joined ("which hook runs after validation and can still change the payload?").
- Follow-ups and pronouns ("and for HTTP2?"). There is no conversation state.
- Version scoping ("what was the default in v4?").
- Computed values ("how many MB is the body limit?").
- "List all the hooks": the answer is a whole file's headings, not one or two sentences.
- Answers that exist only inside code comments, diagrams or images.
- Any language other than English.

What the README can honestly promise: "Finds the right section and quotes it, for questions phrased close to the docs' own words. Says so when it isn't sure. Always shows the three closest sections, so a wrong quote is one click from the right page."

---

## 22. Versions checked on 10 Sep 2026

All from `https://registry.npmjs.org/<package>/latest` unless noted.

| Package                         | Version | Published  | Licence    | Role                                      |
| ------------------------------- | ------- | ---------- | ---------- | ----------------------------------------- |
| minisearch                      | 7.2.0   | 2025-09-16 | MIT        | Search index                              |
| markdown-it                     | 15.0.1  | 2026-08-27 | MIT        | Parser (ships its own types since 15.0.0) |
| js-yaml                         | 5.4.1   | 2026-08-26 | MIT        | Frontmatter                               |
| github-slugger                  | 2.0.0   | 2022-10-27 | ISC        | Heading anchors                           |
| porter2                         | 2.0.0   | 2026-06-17 | MIT        | Stemmer                                   |
| ignore                          | 7.0.9   | 2026-09-08 | MIT        | `.gitignore` filtering                    |
| @modelcontextprotocol/server    | 2.0.0   | 2026-07-27 | MIT        | MCP server                                |
| @modelcontextprotocol/sdk (v1)  | 1.30.0  | 2026-07-27 | MIT        | Fallback if v2 causes trouble             |
| @modelcontextprotocol/inspector | 2.6.0   | 2026-09-09 | MIT        | Manual MCP testing                        |
| zod                             | 4.6.1   | 2026-09-09 | MIT        | MCP schemas                               |
| tsdown                          | 0.23.0  | 2026-09-03 | MIT        | Build                                     |
| typescript                      | 7.0.2   | 2026-07-08 | Apache-2.0 | Types (6.0.3 as fallback)                 |
| vitest                          | 5.0.0   | 2026-09-03 | MIT        | Tests                                     |
| happy-dom                       | 20.14.3 | 2026-09-09 | MIT        | Widget tests                              |
| tsx                             | 4.23.13 | 2026-08-30 | MIT        | Running `.ts` scripts in the prototype    |
| publint                         | 0.3.24  | 2026-08-19 | MIT        | Package check                             |
| @arethetypeswrong/cli           | 0.18.5  | 2026-07-09 | MIT        | Types check                               |
| tsup                            | 8.5.1   | 2025-11-12 | MIT        | Not used: README says unmaintained        |
| stemmer                         | 2.0.1   | 2022-11-02 | MIT        | Not used: original Porter                 |
| gray-matter                     | 4.0.3   | 2021-04-24 | MIT        | Not used: needs `Buffer`                  |

Node: 20 end of life, 22 maintenance LTS, 24 active LTS, 26 current (LTS on 28 Oct 2026). Source: `nodejs/Release` schedule.json.

---

## 23. Resources

### Classic question answering and ranking

- Speech and Language Processing (Jurafsky, Martin), 3rd edition draft, index: https://web.stanford.edu/~jurafsky/slp3/
- Chapter 11, Information Retrieval and RAG (tf-idf, BM25, evaluation): https://web.stanford.edu/~jurafsky/slp3/11.pdf
- Archived Chapter 25, Question Answering (Oct 2019), the classic three-stage pipeline: https://web.stanford.edu/~jurafsky/slp3/old_oct19/25.pdf
- Voorhees and Tice, The TREC-8 Question Answering Track: http://www.lrec-conf.org/proceedings/lrec2000/pdf/26.pdf
- Voorhees, Overview of the TREC 2002 QA Track (no-answer questions, confidence-weighted score): https://trec.nist.gov/pubs/trec11/papers/QA11.pdf
- Li and Roth 2002, Learning Question Classifiers: https://aclanthology.org/C02-1150/
- Question class definitions: https://cogcomp.seas.upenn.edu/Data/QA/QC/definition.html
- Ravichandran and Hovy 2002, surface text patterns: https://aclanthology.org/P02-1006/
- Brill et al. 2002, AskMSR: https://aclanthology.org/W02-1033/
- Luhn 1958, The Automatic Creation of Literature Abstracts: https://courses.ischool.berkeley.edu/i256/f06/papers/luhn58.pdf
- Mihalcea and Tarau 2004, TextRank: https://aclanthology.org/W04-3252/
- ELIZA: https://en.wikipedia.org/wiki/ELIZA
- AIML: https://en.wikipedia.org/wiki/Artificial_Intelligence_Markup_Language
- Mean reciprocal rank: https://en.wikipedia.org/wiki/Mean_reciprocal_rank
- IR evaluation measures: https://en.wikipedia.org/wiki/Evaluation_measures_(information_retrieval)
- Snowball English (Porter2) stemmer: https://snowballstem.org/algorithms/english/stemmer.html

### Libraries

- MiniSearch docs: https://lucaong.github.io/minisearch/
- MiniSearch API (class): https://lucaong.github.io/minisearch/classes/MiniSearch.MiniSearch.html
- MiniSearch search options: https://lucaong.github.io/minisearch/types/MiniSearch.SearchOptions.html
- MiniSearch source (BM25+ constants, default tokenizer): https://raw.githubusercontent.com/lucaong/minisearch/master/src/MiniSearch.ts
- MiniSearch changelog: https://github.com/lucaong/minisearch/blob/master/CHANGELOG.md
- markdown-it: https://github.com/markdown-it/markdown-it
- github-slugger: https://github.com/Flet/github-slugger
- stemmer (Porter, not used): https://github.com/words/stemmer
- Node `fs.glob`: https://nodejs.org/api/fs.md
- Node `util.parseArgs` and `util.styleText`: https://nodejs.org/api/util.md
- Node TypeScript type stripping: https://nodejs.org/api/typescript.md
- Node `require(esm)`: https://nodejs.org/api/modules.md
- Node release schedule: https://raw.githubusercontent.com/nodejs/Release/main/schedule.json

### Prior art

- VitePress local search: https://vitepress.dev/reference/default-theme-search
- VitePress search source: https://raw.githubusercontent.com/vuejs/vitepress/main/src/node/plugins/localSearchPlugin.ts
- Pagefind: https://pagefind.app/
- Algolia DocSearch: https://docsearch.algolia.com/
- tobi/qmd: https://github.com/tobi/qmd
- arabold/docs-mcp-server: https://github.com/arabold/docs-mcp-server
- cskwork/keyword-rag-mcp: https://github.com/cskwork/keyword-rag-mcp
- Stork (wound down): https://github.com/jameslittle230/stork
- Lunr.js: https://github.com/olivernn/lunr.js
- Docusaurus search options: https://docusaurus.io/docs/search

### MCP and Claude Code

- TypeScript SDK repo: https://github.com/modelcontextprotocol/typescript-sdk
- SDK v2 docs: https://ts.sdk.modelcontextprotocol.io/v2/
- Upgrading to v2: https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2.html
- Tools in v2: https://ts.sdk.modelcontextprotocol.io/v2/servers/tools.html
- Serving over stdio: https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio.html
- Spec 2026-07-28, tools: https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- Claude Code MCP docs: https://code.claude.com/docs/en/mcp

### Build and publishing

- tsdown config: https://tsdown.dev/options/config-file
- tsdown package exports: https://tsdown.dev/options/package-exports
- tsdown migrating from tsup: https://tsdown.dev/guide/migrate-from-tsup
- tsup README (unmaintained notice): https://raw.githubusercontent.com/egoist/tsup/main/README.md
- WAI-ARIA combobox pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- Combobox with list autocomplete example: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/
- DecompressionStream browser data: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/DecompressionStream.json
- vitest snapshots: https://vitest.dev/guide/snapshot
- npm trusted publishing: https://docs.npmjs.com/trusted-publishers
- `npm trust`: https://docs.npmjs.com/cli/v11/commands/npm-trust
- npm package name rules: https://docs.npmjs.com/package-name-guidelines

### Test corpora

- Fastify licence (MIT): https://raw.githubusercontent.com/fastify/fastify/main/LICENSE
- Fastify docs at v5.6.0: https://github.com/fastify/fastify/tree/v5.6.0/docs
- Hono website licence (MIT): https://raw.githubusercontent.com/honojs/website/main/LICENSE
- Meilisearch docs licence (MIT): https://raw.githubusercontent.com/meilisearch/documentation/main/LICENSE
