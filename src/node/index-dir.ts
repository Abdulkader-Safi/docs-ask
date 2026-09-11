// Index a folder of markdown, and load an index to ask questions (PRD section 5).
import { readFile, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { loadIndex, type DocsIndex, type SerializedIndex } from "../core/index.ts";
import { buildIndex, parseDocument } from "../parse/index.ts";
import { loadConfig, type DocsAskConfig } from "./config.ts";
import { readIndex } from "./index-file.ts";
import { findDocs } from "./walk.ts";

export const INDEX_FILE = "docs-index.json";

export interface IndexDirectoryOptions extends Pick<DocsAskConfig, "include" | "exclude" | "synonyms"> {}

/**
 * A markdown file works wherever a folder does: index that one file, from its own folder, so citations stay
 * relative to something a reader can open.
 */
async function asFolder<T extends IndexDirectoryOptions>(root: string, options: T): Promise<[string, T]> {
  const file = await stat(root).then((s) => s.isFile()).catch(() => false);
  return file ? [dirname(root), { ...options, include: [basename(root)] }] : [root, options];
}

/** Parse every markdown file under `root` and build the index. */
export async function indexDirectory(root: string, options: IndexDirectoryOptions = {}): Promise<SerializedIndex> {
  const [dir, opts] = await asFolder(root, options);
  const files = await findDocs(dir, { include: opts.include, exclude: opts.exclude });
  const docs = await Promise.all(files.map(async (f) => parseDocument(f, await readFile(join(dir, f), "utf8"))));
  return buildIndex(docs, { synonyms: opts.synonyms });
}

/** Newest mtime of the files an index would cover, or 0 when there are none. */
async function newestDoc(root: string, options: IndexDirectoryOptions): Promise<number> {
  const files = await findDocs(root, { include: options.include, exclude: options.exclude });
  const times = await Promise.all(files.map(async (f) => (await stat(join(root, f))).mtimeMs));
  return Math.max(0, ...times);
}

/**
 * An index ready to ask: the index file when it exists and is newer than every doc, otherwise built in
 * memory. Config is read from docs-ask.config.json unless one is passed in. `path` may be a single markdown
 * file, which is indexed on its own.
 */
export async function loadDocs(path: string, options: { config?: DocsAskConfig; indexFile?: string } = {}): Promise<{ docs: DocsIndex; fromFile: boolean; config: DocsAskConfig }> {
  const [root, forFile] = await asFolder(path, {} as IndexDirectoryOptions);
  const oneFile = root !== path;
  const config = { ...(options.config ?? (await loadConfig(root))), ...forFile };
  const askOptions = config.thresholds ? { weights: { gates: config.thresholds } } : {};
  const indexPath = join(root, options.indexFile ?? INDEX_FILE);
  // one file asked for: the folder's index covers too much, so build just that file
  const built = oneFile ? 0 : await stat(indexPath).then((s) => s.mtimeMs).catch(() => 0);
  // strictly newer: a doc saved in the same millisecond as the index counts as a miss, and rebuilding once is cheap
  if (built && built > (await newestDoc(root, config))) {
    return { docs: loadIndex(await readIndex(indexPath), askOptions), fromFile: true, config };
  }
  return { docs: loadIndex(await indexDirectory(root, config), askOptions), fromFile: false, config };
}
