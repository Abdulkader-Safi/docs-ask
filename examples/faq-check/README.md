# FAQ check

A CI check that fails when the docs stop answering the questions your project cares about. Docs drift: a
section gets renamed, a default moves, and the question people actually ask goes unanswered. This catches that.

```bash
node examples/faq-check/check.mjs                 # this repo's docs, against questions.json
node examples/faq-check/check.mjs . my-faq.json   # your own list
```

`questions.json` is a list of `{ "q": "...", "expect": "path/to/file.md" }`. `expect` is optional: leave it out
to require only that docs-ask answers at all. Exit code 1 means at least one question went unanswered or landed
in the wrong file, so a GitHub Action needs nothing but the command.

Run against this repo's `docs/`:

```text
ok   what does docs-ask do when it is not sure
     docs/overview.md:3  When it isn't sure, it says so and shows the three closest sections.
ok   which markdown parser does it use
     docs/research.md:120  Result: zero differences in line numbers or text across 1,573 blocks. ...
ok   what are the quality targets
     docs/prd.md:34  The test split has at least 60 answerable and 8 unanswerable questions ...

3/3 answered
```

A failing question is not always a docs bug. Sometimes it means the question is phrased far from the docs' own
words, which is the honest limit described in the main README. Read the "not sure" line before editing anything.
