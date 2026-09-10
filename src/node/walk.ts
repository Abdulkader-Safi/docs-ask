// Find the markdown files to index under a folder (research.md section 4, rule 7).
// fs.glob skips hidden files and folders on its own, so .git and .github are never walked.
import { glob, readFile } from "node:fs/promises";
import { basename, join, sep } from "node:path";
import ignore from "ignore";

export const DEFAULT_INCLUDE = ["**/*.md", "**/*.mdx"];
/** gitignore syntax, applied on top of the repo's own .gitignore */
export const DEFAULT_EXCLUDE = ["node_modules/", "CHANGELOG.md"];

export interface FindDocsOptions {
  /** glob patterns, relative to root */
  include?: string[];
  /** extra gitignore-style patterns to skip */
  exclude?: string[];
}

/** Repo-relative POSIX paths of every doc file under `root`, sorted. */
export async function findDocs(root: string, options: FindDocsOptions = {}): Promise<string[]> {
  // ponytail: root .gitignore plus git's local .git/info/exclude; nested .gitignore files wait until someone needs them
  const rules = await Promise.all(
    [".gitignore", ".git/info/exclude"].map((f) => readFile(join(root, f), "utf8").catch(() => "")),
  );
  // add() splits a string into lines but takes each array element as one pattern, so join the files first
  const skip = ignore().add(rules.join("\n")).add(DEFAULT_EXCLUDE).add(options.exclude ?? []);
  const found: string[] = [];
  for await (const path of glob(options.include ?? DEFAULT_INCLUDE, {
    cwd: root,
    exclude: (p) => basename(p) === "node_modules", // prune the folder instead of walking it
  })) {
    const posix = path.split(sep).join("/"); // `ignore` wants POSIX relative paths and throws on "./x"
    if (!skip.ignores(posix)) found.push(posix);
  }
  return found.sort();
}
