# docs-ask

Ask a question about a repo's markdown docs and get back the line that answers it, with `file:line`. No language model, no API key, nothing to download. When it isn't sure, it says so and lists the closest sections.

```console
$ npx docs-ask ask "what is the default bodyLimit" --dir docs
Reference/Server.md:224 Factory > bodyLimit VALUE · high
Default: `1048576` (1MiB)

Also: Reference/ContentTypeParser.md:181  Content-Type Parser > Using addContentTypeParser with fastify.register > Body Parser > Custom Parser Options
      Reference/Server.md:2094  Instance > Server Methods > initialConfig
```

One package, four ways in: a library, a CLI, an MCP server and a web component. MIT. Node 22.17 or newer. English only.

## Install

```bash
npm install docs-ask     # library, plus the docs-ask command
npx docs-ask ask "how do I register a plugin"
```

## CLI

```bash
docs-ask ask "<question>" [--dir .] [--top 3] [--json]
docs-ask build [--dir .] [--out docs-index.json] [--target node|web] [--gzip]
docs-ask mcp [dir]
```

`ask` reads `docs-index.json` when it is newer than every doc file, and otherwise indexes in memory. Exit codes: 0 answered, 2 not sure, 1 error. `--json` prints the whole answer object and keeps the same codes.

`build` writes the index. `--target web` drops the fields only the build reads, which is what the widget wants: on the Fastify docs that is 1,202 KB instead of 1,627 KB, 281 KB gzipped.

## Library

```js
import { loadDocs } from "docs-ask/node";

const { docs } = await loadDocs("docs");
const answer = docs.ask("what is the default bodyLimit");

if (answer.confident) {
  console.log(`${answer.file}:${answer.line}`, answer.text);
} else {
  console.log(answer.reason, answer.candidates); // always three closest sections
}
```

`docs-ask/node` reads the filesystem. The main entry, `docs-ask`, is browser safe: give `loadIndex` an index you fetched. `docs-ask/parse` exposes the markdown parser on its own.

## MCP server

```bash
claude mcp add docs-ask -- npx -y docs-ask mcp
```

Two tools. `ask_docs(question, topK)` answers with the quote and its citation, or says it isn't sure and hands back the closest section ids. `get_section(id)` returns one section's text. Both are read-only. The folder comes from the argument, then `CLAUDE_PROJECT_DIR`, then the current one, and a fresh `docs-index.json` is used when there is one.

## Web component

```html
<script src="https://cdn.jsdelivr.net/npm/docs-ask@0.1/dist/docs-ask-widget.iife.js"></script>
<docs-ask index="/docs-index.json" base-url="/docs/"></docs-ask>
```

17.2 KB gzipped, index not counted. It fetches the index on first focus, answers as you type, and works from the keyboard: `/` or Cmd/Ctrl+K focuses it, the arrows and Enter pick a section, Escape closes the panel. Colours are system colours, so it follows light and dark on its own. Style it through `::part(input)`, `::part(panel)`, `::part(answer)` and `::part(listbox)`. Picking fires `docs-ask:select`, and navigates when `base-url` is set. `examples/widget` is a page you can run with `npm run demo`.

## Config

`docs-ask.config.json` at the repo root, all fields optional:

```json
{
  "include": ["docs/**/*.md"],
  "exclude": ["docs/archive/**"],
  "baseUrl": "/docs/",
  "synonyms": [{ "canonical": "delete", "aliases": ["remove", "destroy"], "strict": false }],
  "thresholds": { "minCoverage": 0.7, "minGap": 0.02 }
}
```

Synonyms are written into the index, so query time matches build time. `thresholds` moves the confidence gates: lower to answer more often, raise to abstain more often.

## How it works

The way search worked before language models, with one extra step at the end:

1. Split every file into sections by heading, keeping exact line numbers, and split sections into quotable units: sentences, list items, table rows, code blocks.
2. Sort the question into a type with hand-written rules: eleven of them, from how-to to default value to error code.
3. Find the best sections with BM25 (through MiniSearch), then rerank with the rules for that type.
4. Check two numbers before answering: how much of the question the winning section covers, and how far ahead of the runner-up it is. Below either bar, say "not sure".
5. Quote the unit that fits the question type, and print where it came from.

Indexing 200 files takes about 0.7 s, and a question takes about 2 ms on 2,702 sections. Starting the MCP server on a built index of 30 files, process launch included, takes about 130 ms.

## How good it is

Measured on two frozen question sets over the Fastify and Hono docs.

| | Questions phrased like the docs (151) | Real GitHub issue titles (68) |
|---|---|---|
| Right section first | 0.70 | 0.42 |
| Right section in three | 0.87 | 0.63 |
| Right when it answered | 0.78 | 0.47 |
| Answered at all | 0.66 | 0.25 |
| Said "not sure" to the unanswerable | 18/18 | 8/8 |

The first set was tuned on. The second was written from raw issue titles, frozen before any tuning, and run once. Titles like "Extending Context" or a pasted deprecation warning aren't questions, and on those docs-ask mostly says "not sure", which is the designed failure: it shows the three closest sections instead of guessing.

What it can honestly promise: it finds the right section and quotes it for questions phrased close to the docs' own words, says so when it isn't sure, and always shows the three closest sections, so a wrong quote is one click from the right page.

## What it can't do

Real failures, not hypotheticals:

- Different words for the same thing. "What is the maximum request body size?" ranks the body parser section first; the docs say "payload" and `bodyLimit`. A synonym entry fixes one of these at a time.
- Get versus set. "How do I set a response header?" can return `.getHeaders()`: stemming merges them and nothing models the verb.
- Negation. "Test my routes without starting a server" finds "Testing with a running server", the opposite.
- Symptom to cause. "Why is my request getting cut off?" needs reasoning from the symptom to `requestTimeout`.
- Two sections joined, follow-up questions and pronouns, version scoping ("what was the default in v4?"), computed values ("how many MB is that?"), and answers that live only in a diagram or an image.
- Any language other than English.

## Related

Want embeddings and happy to download models? [qmd](https://github.com/tobi/qmd) also runs BM25 search over markdown from an MCP server. docs-ask differs in the last step: it quotes one answer with a line number or says "not sure", and it ships a browser widget.

## Repo

- `docs/overview.md`: one page on what this is and where it stands.
- `docs/prd.md`: scope, quality targets, milestones.
- `docs/research.md`: the build manual, with tested code for every stage and the numbers behind the claims here.

## Licence

MIT
