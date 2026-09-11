# Examples

Four ways in, one folder each. All four run against this repo's own `docs/` folder, so they work straight from a
clone.

| Folder | What it shows |
|---|---|
| [`library/`](library) | `loadDocs` and `ask` from Node, with the citation |
| [`faq-check/`](faq-check) | a CI check that fails when the docs stop answering a list of questions |
| [`mcp/`](mcp) | the MCP server in Claude Code, and how to drive it without Claude |
| [`widget/`](widget) | a static page with `<docs-ask>` over the Fastify docs |

The library and FAQ-check examples import `docs-ask/node`, so run `npm install && npm run build` in the repo
root first, or point them at a folder where `docs-ask` is installed from npm.

One thing worth copying from both scripts: they pass the repo root and narrow with `include`, rather than
pointing at `docs/` directly. `.gitignore` and `.git/info/exclude` are read from the root you pass, so a root
above them keeps ignored files out of the index.
