# Library

Ask the docs from Node, in a dozen lines.

```bash
node examples/library/ask.mjs "how does docs-ask decide when to abstain"
```

`loadDocs(dir)` reads `docs-index.json` when it is newer than every file under `dir`, and otherwise parses and
indexes in memory. `fromFile` says which happened. `docs.ask(question)` returns the same object every surface
uses: `confident`, `file`, `line`, `headingPath`, `text`, and `candidates` whether it answered or not.

For the browser, import `docs-ask` instead and hand `loadIndex` an index you fetched. `docs-ask/node` is the
only entry that touches the filesystem.
