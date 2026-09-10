# docs-ask

A small open-source package that answers questions about a repo's markdown docs without any AI model. Ask "what is the default bodyLimit?" and it replies `Reference/Server.md:224  Factory > bodyLimit` with the quote `Default: 1048576 (1MiB)`. When it isn't sure, it says so and shows the three closest sections.

It works the way question answering worked before language models: search the docs with BM25, sort the question into a type with hand-written rules (how-to, default value, error, endpoint and so on), then pick the sentence, table row or code block that fits that type.

## Why it exists

Safi asked whether an old-style, rules-and-search system could answer questions about project docs without even a tiny model. The research says yes, within limits: on questions it hadn't been tuned for, it put the right section first half the time and in the top three about 7 times in 10, and it was right 5 times out of 7 when it chose to answer.

## Decisions so far

- v1 ships a library, a CLI, an MCP server for Claude Code and Cowork, and a browser widget.
- English only. Arabic is the likely next language.
- MiniSearch does the ranking; everything else is written for this package.
- Public on npm under MIT as `docs-ask`. Safi reserved the name (0.0.1 placeholder) and created the GitHub repo on 10 Sep 2026.

## Files

- `research.md`: the build manual. Every decision with tested code, measured numbers, limits and resources.
- `prd.md`: the contract. Problem, success criteria, scope, design, milestones, risks, open questions.
- `claude-code-build-prompt.md`: paste-ready prompt to start the build in Claude Code.
- `reference-prototype/`: the working spike behind every number. `npm install && npm run corpus && npm run eval`.

## Status

Research done 10 Sep 2026. PRD waiting for Safi's sign-off and answers to four open questions (default files, widget answer text, MCP SDK version, whether he writes held-out questions). Name and repo are decided. Nothing built in a real repo yet.
