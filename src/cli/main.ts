// docs-ask CLI: ask, build, mcp (research.md section 15, output format section 13).
// Zero dependencies: node:util's parseArgs and styleText.
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs, styleText } from "node:util";
import type { Answer } from "../core/types.ts";
import { indexDirectory, loadConfig, loadDocs, writeIndex, gzippedSize, INDEX_FILE, WEB_BUDGET } from "../node/index.ts";

export const HELP = `Answer questions about a repo's markdown docs, with no language model.

Usage:
  docs-ask ask "<question>" [--dir .] [--top 3] [--json]
  docs-ask build [--dir .] [--out docs-index.json] [--target node|web] [--gzip]
  docs-ask mcp [dir]            stdio MCP server (dir defaults to $CLAUDE_PROJECT_DIR or the current folder)

Options:
  -d, --dir <path>     folder to read docs from (default: .)
  -k, --top <n>        closest sections to list (default: 3)
  -o, --out <path>     where build writes the index (default: ${INDEX_FILE})
      --target <t>     build target: node (default) or web (smaller, for the widget)
      --gzip           gzip the index file
      --json           print the answer as JSON
  -h, --help           show this help

Exit codes: 0 answered, 2 not sure, 1 error.`;

const dim = (s: string) => styleText("dim", s);

/** research.md section 13: "file:line  heading path", the quote, then the closest sections. */
export function render(a: Answer, log: (s: string) => void): void {
  if (a.confident) {
    const where = styleText(["bold", "cyan"], `${a.file}:${a.line}`);
    log(`${where} ${styleText("bold", a.headingPath!.join(" > "))} ${dim(`${a.qclass} · ${a.level}`)}`);
    log(a.text || "");
    const others = a.candidates.filter((c) => c.id !== a.id);
    if (others.length) {
      log("");
      others.forEach((c, i) => log(`${i === 0 ? "Also:" : "     "} ${c.file}:${c.line}  ${dim(c.headingPath.join(" > "))}`));
    }
    return;
  }
  log(styleText("yellow", `No confident answer (${a.reason}).`) + (a.candidates.length ? " Closest sections:" : ""));
  a.candidates.forEach((c, i) => log(`  ${i + 1}. ${c.file}:${c.line}  ${dim(c.headingPath.join(" > "))}`));
  if (a.suggestions?.length) log(`Did you mean: ${a.suggestions.join(", ")}?`);
}

export interface Io {
  log: (s: string) => void;
  error: (s: string) => void;
}

export async function main(argv = process.argv.slice(2), io: Io = { log: console.log, error: console.error }): Promise<number> {
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        dir: { type: "string", short: "d", default: "." },
        top: { type: "string", short: "k", default: "3" },
        out: { type: "string", short: "o", default: INDEX_FILE },
        target: { type: "string", default: "node" },
        gzip: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
        help: { type: "boolean", short: "h" },
      },
    }));
  } catch (e) {
    io.error(styleText("red", `error: ${(e as Error).message}`) + `\n\n${HELP}`);
    return 1;
  }
  const [command, ...rest] = positionals;
  if (values.help) {
    io.log(HELP);
    return 0; // asked for help on purpose
  }
  if (!command) {
    io.log(HELP);
    return 1; // no command: usage error
  }
  const root = resolve(values.dir!);

  try {
    if (command !== "mcp" && !(await stat(root).then((s) => s.isDirectory()).catch(() => false))) {
      io.error(styleText("red", `error: no such folder: ${root}`));
      return 1;
    }
    if (command === "mcp") {
      const { runStdio } = await import("../mcp/stdio.ts"); // lazy: plain CLI runs never load the MCP SDK
      await runStdio(resolve(rest[0] ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd()));
      return 0; // stdin stays open and the process keeps serving
    }

    if (command === "build") {
      if (values.target !== "node" && values.target !== "web") {
        io.error(styleText("red", `error: --target must be node or web, not "${values.target}"`));
        return 1;
      }
      const config = await loadConfig(root);
      const data = await indexDirectory(root, config);
      const bytes = await writeIndex(data, resolve(values.out!), { gzip: values.gzip, target: values.target });
      const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
      io.log(`${styleText("green", "ok")} ${data.sections.length} sections from ${new Set(data.sections.map((s) => s.file)).size} files, ${kb(bytes)} -> ${values.out}`);
      if (values.target === "web") {
        const gz = await gzippedSize(resolve(values.out!));
        if (gz > WEB_BUDGET) io.error(styleText("yellow", `warning: ${kb(gz)} gzipped is over the ${kb(WEB_BUDGET)} widget budget. Narrow the docs with "include" in docs-ask.config.json, or ship one index per section of the site.`));
      }
      return 0;
    }

    if (command === "ask") {
      const question = rest.join(" ").trim();
      if (!question) {
        io.error(styleText("red", "error: missing question") + `\n\n${HELP}`);
        return 1;
      }
      const { docs } = await loadDocs(root);
      if (docs.sectionCount === 0) {
        io.error(styleText("red", `error: no markdown found in ${root}`) + "\nLooked for **/*.md and **/*.mdx, skipping node_modules and anything git ignores.");
        return 1;
      }
      const answer = docs.ask(question, { topK: Number(values.top) });
      if (values.json) io.log(JSON.stringify(answer, null, 2));
      else render(answer, io.log);
      return answer.confident ? 0 : 2; // same exit codes with or without --json
    }

    io.error(styleText("red", `error: unknown command "${command}"`) + `\n\n${HELP}`);
    return 1;
  } catch (e) {
    io.error(styleText("red", `error: ${(e as Error).message}`));
    return 1;
  }
}
