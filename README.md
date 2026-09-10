# docs-ask

Ask a question about a repo's markdown docs and get back the line that answers it, with `file:line`. No language model, no API key, nothing to download. When it isn't sure, it says so and lists the closest sections.

Real output from the prototype, run on the Fastify docs:

```text
Q: What is the default bodyLimit?
Reference/Server.md:224  Factory > bodyLimit
Default: `1048576` (1MiB)
```

## Status

Not built yet. The research and the plan are done, and a prototype shows the pipeline works. The `docs-ask` package on npm (0.0.1) is a placeholder that holds the name. It has no code in it, so don't install it yet.

## How it works

It answers questions the way search systems did before language models:

1. Split every markdown file into sections by heading, keeping exact line numbers.
2. Sort the question into a type with hand-written rules: how-to, default value, error, endpoint and six more.
3. Find the best sections with BM25 (through MiniSearch), then rerank them with rules for that question type.
4. Pick the sentence, list item, table row or code block that fits the type. If the match is weak, or two sections score almost the same, answer "not sure" instead.

One question takes about 2 ms on 559 sections.

## What v1 will ship

One MIT package with four ways in:

- A library for Node and the browser.
- A CLI: `docs-ask ask "<question>"`, `docs-ask build` and `docs-ask mcp`.
- An MCP server, so Claude Code and Cowork can call `ask_docs` and get citations without reading whole files.
- A `<docs-ask>` web component for a docs site: one script tag plus a prebuilt index.

English only. Node 22.17 or newer.

## How good it is

The prototype was tested on the Fastify docs at v5.6.0. On 14 questions written after the rules were frozen, it put the right section first half the time and in the top three 71% of the time. When it chose to answer, it was right 5 times out of 7. It said "not sure" to both questions the docs couldn't answer.

It works best when a question uses words close to the docs' own. It struggles with:

- Different words for the same thing, like "turn on logging" when the docs say `logger: true`.
- Negation, like "test my routes without starting a server".
- Questions that need two sections joined, and follow-up questions.
- Any language other than English.

The v1 target, on a larger frozen test set over two doc sites, is 0.55 for right-section-first and 0.75 for top three. `docs/prd.md` section 2 lists every target.

## Related tools

Want embeddings and happy to download models? Use [qmd](https://github.com/tobi/qmd). It also runs BM25 search over markdown from an MCP server. docs-ask differs in the last step: it quotes one answer with a line number or says "not sure", and it ships a browser widget.

## Repo layout

- `docs/overview.md`: one page on what this is, why it exists and where it stands.
- `docs/prd.md`: the contract. Scope, targets, milestones.
- `docs/research.md`: the build manual, with tested code for every stage.

## Licence

MIT
