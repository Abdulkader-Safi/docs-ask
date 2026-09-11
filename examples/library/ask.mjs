// Ask this repo's own docs a question from Node. Run: node examples/library/ask.mjs "your question"
import { loadDocs } from "docs-ask/node";

const question = process.argv.slice(2).join(" ") || "what does docs-ask do when it is not sure";
// The root is the repo, not docs/: .gitignore and .git/info/exclude are read from the root you pass,
// so pointing straight at docs/ would index anything git ignores in there.
const { docs, fromFile } = await loadDocs(".", { config: { include: ["docs/**/*.md"] } });
console.log(`${docs.sectionCount} sections${fromFile ? " from docs-index.json" : " built in memory"}\n`);

const answer = docs.ask(question, { topK: 3 }); // topK caps the candidate list; it defaults to 5
if (answer.confident) {
  console.log(`${answer.file}:${answer.line}  ${answer.headingPath.join(" > ")}`);
  console.log(answer.text);
} else {
  console.log(`not sure: ${answer.reason}`);
  for (const c of answer.candidates) console.log(`  ${c.file}:${c.line}  ${c.headingPath.join(" > ")}`);
}
