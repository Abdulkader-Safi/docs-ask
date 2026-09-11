// Fails when the docs stop answering the questions a project cares about.
// Run: node examples/faq-check/check.mjs [docs-dir] [questions.json]
import { readFile } from "node:fs/promises";
import { loadDocs } from "docs-ask/node";

const [dir = ".", file = new URL("questions.json", import.meta.url)] = process.argv.slice(2);
const questions = JSON.parse(await readFile(file, "utf8"));
// Pass the repo root and narrow with include, so git's ignore rules are read from where they live.
const { docs } = await loadDocs(dir, { config: { include: ["docs/**/*.md"] } });

let failed = 0;
for (const { q, expect } of questions) {
  const a = docs.ask(q);
  const where = a.confident ? `${a.file}:${a.line}` : "";
  const ok = a.confident && (!expect || a.file === expect);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${q}\n     ${a.confident ? `${where}  ${a.text.split("\n")[0]}` : `not sure: ${a.reason}`}`);
}
console.log(`\n${questions.length - failed}/${questions.length} answered`);
process.exit(failed ? 1 : 0);
