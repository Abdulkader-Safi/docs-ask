# PRD: docs-ask

Answer questions about a repo's markdown docs with no language model. Library, CLI, MCP server and browser widget in one MIT npm package. English only.

Read with `research.md` (the build manual, with tested code for every stage) and `reference-prototype/` (the spike the numbers come from).

---

## 1. Problem

Project and API docs live as markdown files in the repo. Finding one fact means grepping or reading whole pages.

- Search tools (VitePress local search, Pagefind, Lunr) return pages, not answers.
- Tools that return answers (Algolia Ask AI, qmd's `query`, Context7 flows) need a model: an API key and a bill, or gigabytes of local weights. They can also make up an answer the docs never gave.
- Coding agents burn tokens reading whole doc files to find one default value or one endpoint.

This package takes a question, finds the section, quotes the one or two lines that answer it with `file:line`, and says "not sure" when it isn't. It runs in about 2 ms per question, offline, with nothing to download.

Who it's for:

1. Developers in a repo who want a quick answer from the terminal.
2. Coding agents (Claude Code, Cowork) that need exact citations cheaply, through MCP.
3. Visitors to a docs site, through a drop-in search box.
4. Safi's technical audience: an open-source project built on 1990s question-answering ideas, with honest numbers.

---

## 2. Success criteria

All quality numbers come from the golden eval, which runs in CI.

### Quality (on the frozen test split, never used for tuning)

The test split has at least 60 answerable and 8 unanswerable questions across two corpora (Fastify docs at v5.6.0 and Hono docs), with several accepted sections per question.

| Metric                                      | v1 target    | Spike baseline (16 held-out questions, Fastify only) |
| ------------------------------------------- | ------------ | ---------------------------------------------------- |
| Top-1 (right section first)                 | 0.55 or more | 0.50                                                 |
| Recall@3 (right section in the three shown) | 0.75 or more | 0.71                                                 |
| Precision when answered                     | 0.80 or more | 0.71                                                 |
| Answer rate                                 | 0.60 or more | 0.50                                                 |
| Abstain on unanswerable                     | 0.90 or more | 2 of 2                                               |

- Every confident answer carries `file`, `line` and `headingPath`, and the source line at `line` contains the start of the quoted text (automated check over all golden answers).
- Same docs and same package version always give the same answer. No randomness.

### Speed and size

- `ask()` p95 under 20 ms on 2,000 sections in Node 22 (spike: 2.0 ms average on 559).
- Building the index for 200 markdown files takes under 3 seconds.
- The MCP server answers `initialize` in under 1 second when `docs-index.json` is present and fresh.
- Widget IIFE is 20 KB gzipped or less, not counting the index (research estimate: about 15 KB).
- Nothing reachable from the `.` entry or the widget imports `node:*` (a test enforces it).

### Package

- `publint` and `@arethetypeswrong/cli` report no problems.
- CI green on Node 22, 24 and 26.
- Published to npm with provenance through trusted publishing.

### End to end

- In a fresh repo with a `docs/` folder, `npx docs-ask ask "<question>"` prints an answer with `file:line`.
- After `claude mcp add docs-ask -- npx -y docs-ask mcp`, Claude Code calls `ask_docs` and gets citations.
- A static HTML page with `<docs-ask index="/docs-index.json">` answers questions using only the keyboard.

---

## 3. Scope

### In v1

Pipeline (research sections 4 to 12):

- Markdown to sections with exact lines (markdown-it), frontmatter, `.mdx` tolerance, `.gitignore` respected.
- Answer units: sentences, list items, table rows, code blocks.
- Tokenizer that keeps identifiers, with Porter2 stemming and question-only stop words.
- Synonym table with two modes (strict rewrite and loose query expansion), extendable per repo.
- MiniSearch index, serialized with `formatVersion` and package version checks.
- Ten question types plus fallback, rerank, unit scoring, confidence gates, `Answer` object.
- Work the spike did not finish, all specified in research.md:
  - COMPARISON with two lookups, one sentence per side.
  - Shape gates for ENDPOINT and EXAMPLE, and the "too broad" gate.
  - Spelling suggestions for unknown identifiers (`autoSuggest`).
  - Split identifier-style headings into words for matching (`setNotFoundHandler` also matches "not found handler").
  - Per-type coverage thresholds: looser for HOWTO, stricter for types with shape evidence.
  - More default synonyms found in the held-out run, such as "404" for "not found" and "hide" for "redact".

Surfaces (research sections 13 to 17):

- Library: `docs-ask` (query side), `docs-ask/parse`, `docs-ask/node`, `docs-ask/mcp`, `docs-ask/widget`.
- CLI: `ask`, `build`, `mcp`; `--json`; exit codes 0 answered, 2 not sure, 1 error; reads `docs-ask.config.json`.
- MCP: `ask_docs` and `get_section`, read-only annotations, server `instructions`, uses `CLAUDE_PROJECT_DIR`, loads a fresh prebuilt index or builds in memory.
- Widget: `<docs-ask>` custom element, lazy index load, `/` and Cmd/Ctrl+K, WAI-ARIA combobox, `::part` styling, quoted answer plus three links, `docs-ask:select` event.

Quality and release:

- Golden sets with dev and test splits for two corpora, metrics, per-question snapshot, weight sweep script.
- README with the honest limits from research section 21 and a pointer to qmd for people who want embeddings.
- CI and trusted publishing on GitHub Actions.

### Out of v1

- Any model: no embeddings, no LLM, no ML classifier.
- Languages other than English. The tokenizer is one module so a language pack can plug in later; Arabic is the likely first.
- File watching and live reindex. Rebuild on demand; the MCP server only checks freshness at start.
- Sources other than markdown and MDX text (HTML, PDF, code comments, rendered MDX components).
- Follow-up questions, conversation memory, answers that join two sections.
- A hosted service, analytics, or telemetry.
- Framework wrappers (React component, VitePress or Docusaurus plugin), a VS Code extension, an Obsidian plugin. All possible later on top of the library.

---

## 4. Constraints

- TypeScript, ESM only. Node 22.17.0 or newer. Browsers: Chrome/Edge 87+, Firefox 125+, Safari 16.4+ (`Intl.Segmenter` and `DecompressionStream`).
- Runtime dependencies limited to: `minisearch`, `markdown-it`, `js-yaml`, `github-slugger`, `porter2`, `ignore`, `@modelcontextprotocol/server`, `zod`. Any other runtime dependency needs Safi's OK first.
- Build and test tools: `tsdown`, `typescript`, `vitest`, `happy-dom`, `publint`, `@arethetypeswrong/cli`.
  - This is a change from Safi's earlier packages (SafiCSS used tsup). tsup's README now says it is unmaintained and recommends tsdown.
- MIT licence. Vendored test corpora must be MIT with their LICENSE files; copyleft docs (Mastodon, Discord) are never vendored.
- No network calls at runtime. The only fetch is the widget loading its own index from the same site.
- $0 running cost.
- Follows the vault writing rules for README and docs: plain English, no em dashes.

---

## 5. Design summary

The formulas and tested code are in research.md. This is the shape Claude Code builds to.

### Repo layout

```text
docs-ask/
  src/core/     types, SerializedIndex format, version check              (browser-safe)
  src/query/    tokenizer, synonyms, rules, rerank, extract, gates, ask()  (browser-safe)
  src/parse/    markdown-it parser, sentence splitter, buildIndex          (browser-safe, 60 KB gz)
  src/node/     fs.glob walk, .gitignore, config file, read/write index
  src/cli/      main.ts, bin.ts
  src/mcp/      server.ts, stdio.ts
  src/widget/   custom element
  test/         fixtures (Fastify v5.6.0, Hono), unit tests, golden eval, snapshots
  scripts/      fetch-corpus.sh, sweep.ts
```

### Entry points

| Import                         | Contains                                                   | Runs in          |
| ------------------------------ | ---------------------------------------------------------- | ---------------- |
| `docs-ask`                     | `loadIndex`, `DocsIndex.ask/get/suggest`, types            | Node and browser |
| `docs-ask/parse`               | `parseDocument`, `buildIndex`                              | Node and browser |
| `docs-ask/node`                | `indexDirectory`, `loadDocs`, `writeIndex`, config loading | Node             |
| `docs-ask/mcp`                 | `createDocsMcpServer`                                      | Node             |
| `docs-ask/widget`              | `DocsAskElement`, registers `<docs-ask>`                   | Browser          |
| bin `docs-ask`                 | `ask`, `build`, `mcp`                                      | Node             |
| `dist/docs-ask-widget.iife.js` | Widget for a `<script>` tag (CDN)                          | Browser          |

### The answer object

```ts
interface Answer {
  confident: boolean;
  level?: "high" | "medium";
  qclass:
    | "HOWTO"
    | "DEFINITION"
    | "ERROR"
    | "VALUE"
    | "LOCATION"
    | "ENDPOINT"
    | "PARAMS"
    | "EXAMPLE"
    | "YESNO"
    | "COMPARISON"
    | "FALLBACK";
  reason: string;
  id?: string;
  file?: string;
  line?: number;
  endLine?: number;
  headingPath?: string[];
  text?: string;
  units?: { kind: string; text: string; line: number }[];
  candidates: {
    id: string;
    file: string;
    line: number;
    headingPath: string[];
    score: number;
  }[];
  suggestions?: string[];
}
```

### Index file

```ts
interface SerializedIndex {
  formatVersion: 1;
  packageVersion: string; // loader refuses a different major.minor
  builtAt: string; // ISO date
  sections: SectionWithUnits[]; // no raw markdown
  df: Record<string, number>; // document frequency for IDF
  mini: object; // MiniSearch toJSON()
  config: { synonyms: SynonymGroup[] }; // so query-time synonyms match build-time ones
}
```

### CLI

| Command                                                                          | Does                                                                                    |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `docs-ask ask "<question>" [--dir .] [--top 3] [--json]`                         | Answer from the docs in `--dir` (uses `docs-index.json` if fresh)                       |
| `docs-ask build [--dir .] [--out docs-index.json] [--target node\|web] [--gzip]` | Write the index file                                                                    |
| `docs-ask mcp [dir]`                                                             | Start the stdio MCP server; dir defaults to `$CLAUDE_PROJECT_DIR` or the current folder |

### Config file (`docs-ask.config.json`, optional)

```json
{
  "include": ["docs/**/*.md", "docs/**/*.mdx", "README.md"],
  "exclude": ["**/CHANGELOG.md"],
  "synonyms": [
    { "canonical": "redact", "aliases": ["hide", "mask"], "strict": false }
  ],
  "thresholds": { "minCoverage": 0.5, "minGap": 0.05 },
  "baseUrl": "https://example.com/docs/"
}
```

### MCP tools

| Tool          | Input                                                      | Output                                                                                            |
| ------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `ask_docs`    | `question` (string, 2+ chars), `topK` (1 to 10, default 3) | Text: answer with `file:line` first, then candidates with ids. `structuredContent`: the `Answer`  |
| `get_section` | `id`                                                       | Section text, capped at 8,000 characters. Unknown id returns `isError` with "Call ask_docs first" |

Both tools: `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`.

### Widget

| Attribute  | Default            | Meaning                                                        |
| ---------- | ------------------ | -------------------------------------------------------------- |
| `index`    | `/docs-index.json` | Where to fetch the index                                       |
| `base-url` | none               | If set, selecting a result navigates to `base-url + file#slug` |
| `top`      | `3`                | Links shown under the answer                                   |
| `label`    | `Search docs`      | Accessible label                                               |

Event: `docs-ask:select` with the `Answer` or candidate in `detail`. Parts: `input`, `listbox`, `answer`.

---

## 6. Plan

Each milestone ends with a short report to Safi (what was built, test results, anything that went against research.md) and waits for his OK before the next one.

Every task is a card on the MD Kanban board in `docs/docs-ask/`. Cards move from `todo` to `in-progress` while being worked on, to `review` once the change is made, and to `done` only after it is tested. The repo's `CLAUDE.md` has the full rule.

| #   | Milestone                                                                                                                      | Done when                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| M0  | Repo scaffold: tsdown config with all entries, vitest, tsconfig, CI workflow, `node:` import guard test, LICENSE, empty README | `npm run build`, `npm test`, `npm run lint` all pass on an empty skeleton                                  |
| M1  | Parse and answer units: port `md-parse.ts`, `sentences.ts`, the adapter; file walking with `.gitignore`                        | Snapshot tests on the sample doc and all 30 Fastify files; CRLF, BOM, frontmatter and MDX cases pass       |
| M2  | Terms, index, serialization: `text.ts`, synonyms, `buildIndex`, `SerializedIndex` with version checks                          | Round-trip test: same answers before and after load; loading a wrong version fails with a clear message    |
| M3  | Question pipeline: rules, rerank, extraction, gates, `ask()`; port the golden eval                                             | Parity with the spike on the tuned Fastify set: top-1 0.69 or more, recall@3 0.80 or more, 4 of 4 abstains |
| M4  | Accuracy work: write dev and test golden sets for Fastify and Hono; add the unfinished pieces listed in scope; weight sweep    | Test split meets every quality target in section 2. Safi reviews the question sets before tuning starts    |
| M5  | CLI and config file                                                                                                            | End-to-end CLI criterion passes; exit codes tested                                                         |
| M6  | MCP server                                                                                                                     | Inspector CLI test in CI; Safi confirms it works in Claude Code                                            |
| M7  | Widget and a demo page built from the Fastify index                                                                            | happy-dom tests pass; size budget met; keyboard-only check done in a real browser                          |
| M8  | README, first publish                                                                                                          | Trusted publishing set up (the 0.0.1 placeholder already exists, so no hand publish is needed first); Safi OKs and pushes the 0.1.0 tag |

Nothing is published, pushed to a public repo, or registered on npm without Safi's explicit OK.

---

## 7. Risks

| Risk                                                                             | Effect                                  | Mitigation                                                                     |
| -------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| Paraphrased questions hit the ceiling of word matching (held-out top-1 was 0.50) | Users see "not sure" often              | Always show three links; per-repo synonyms; per-type thresholds; honest README |
| Tuning to one corpus's writing style                                             | Good numbers on Fastify, poor elsewhere | Second corpus; frozen test split; Safi adds his own questions                  |
| MCP SDK v2 is six weeks old                                                      | API changes or bugs                     | Pin exact versions; the v1 API (1.30.0) is documented as a fallback            |
| TypeScript 7 declaration output is still marked experimental in tsdown           | Broken `.d.ts`                          | Pin `typescript@6.0.3` for the build if attw fails                             |
| MiniSearch releases slowly (last 16 Sep 2025)                                    | Bugs wait for fixes                     | It is small and MIT; vendoring is possible                                     |
| Overlap with qmd for MCP users                                                   | Less reason to adopt                    | Lead with the answer step, the abstain and the browser widget                  |
| Large sites make a large web index (758 KB gz with full text for 227 pages)      | Slow first search                       | `--target web` drops raw text; build warns above 500 KB gz                     |

---

## 8. Open questions

1. Package name. Settled: Safi published a `docs-ask@0.0.1` placeholder on 10 Sep 2026, so the name is held.
2. Repo home. Settled: `github.com/Abdulkader-Safi/docs-ask`.
3. Default files when there is no config. All `.md` and `.mdx` in the repo (minus `.gitignore` and `node_modules`), or only `docs/**` plus `README.md`? Recommendation: all markdown, with `CHANGELOG.md` excluded by default.
4. Widget answer text. Quoted answers make the index bigger (about 176 KB gz extra for Fastify-sized docs). Default to answers with a `--lite` links-only build, or the other way round? Recommendation: answers by default.
5. MCP SDK. v2 (`@modelcontextprotocol/server`, recommended) or v1 (`@modelcontextprotocol/sdk`, older and more tested)?
6. Held-out questions. Will you write about 20 test questions yourself, so the test split isn't written by the same agent that tunes the weights? Recommendation: yes, at M4.
