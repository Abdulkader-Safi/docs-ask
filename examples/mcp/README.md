# MCP server

Give Claude Code the docs of whatever repo it is working in, with citations.

```bash
claude mcp add docs-ask -- npx -y docs-ask mcp                   # this project only
claude mcp add --scope project docs-ask -- npx -y docs-ask mcp   # writes .mcp.json, shared through git
claude mcp add --scope user docs-ask -- npx -y docs-ask mcp      # every project
```

`.mcp.json` here is the project-scope version, ready to copy to a repo root. The folder comes from the argument,
then `CLAUDE_PROJECT_DIR`, then the current one. Build an index first (`docs-ask build`) and startup drops from
about 340 ms to about 130 ms, since the server reads the file instead of parsing every doc.

## What the tools return

`ask_docs(question, topK)` gives the quote with its citation, plus the closest sections as ids:

```text
Reference/Server.md:224  Factory > bodyLimit  [Reference/Server.md#bodylimit]
Default: `1048576` (1MiB)

Also:
- Reference/ContentTypeParser.md:181  Content-Type Parser > ... > Custom Parser Options  [Reference/ContentTypeParser.md#custom-parser-options]
```

When it is not sure it says so and returns candidates only. That is worth telling a model once: an abstention
means read the candidates with `get_section(id)`, not that the docs are silent. The tool description says so too.

`get_section(id)` returns one section's full text, cut at 8,000 characters. Ids come from `ask_docs`.

## Checking it without Claude

```bash
npx -y @modelcontextprotocol/inspector@2.6.0 --cli ./node_modules/.bin/docs-ask mcp ./docs \
  --method tools/call --tool-name ask_docs --tool-arg question="what is the default bodyLimit"
```

The Inspector needs Node 22.19 or newer, and it swallows `npx -y`, so point it at an installed binary.
