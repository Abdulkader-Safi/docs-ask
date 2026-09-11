// Index a folder of markdown, and load an index to ask questions (PRD section 5).
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { loadIndex, type DocsIndex, type SerializedIndex } from "../core/index.ts";
import { buildIndex, parseDocument } from "../parse/index.ts";
import { loadConfig, type DocsAskConfig } from "./config.ts";
import { readIndex } from "./index-file.ts";
import { findDocs } from "./walk.ts";

export const INDEX_FILE = "docs-index.json";

export interface IndexDirectoryOptions extends Pick<DocsAskConfig, "include" | "exclude" | "synonyms"> {}

/** Parse every markdown file under `root` and build the index. */
export async function indexDirectory(root: string, options: IndexDirectoryOptions = {}): Promise<SerializedIndex> {
  const files = await findDocs(root, { include: options.include, exclude: options.exclude });
  const docs = await Promise.all(files.map(async (f) => parseDocument(f, await readFile(join(root, f), "utf8"))));
  return buildIndex(docs, { synonyms: options.synonyms });
}

/** Newest mtime of the files an index would cover, or 0 when there are none. */
async function newestDoc(root: string, options: IndexDirectoryOptions): Promise<number> {
  const files = await findDocs(root, { include: options.include, exclude: options.exclude });
  const times = await Promise.all(files.map(async (f) => (await stat(join(root, f))).mtimeMs));
  return Math.max(0, ...times);
}

/**
 * An index ready to ask: the index file when it exists and is newer than every doc, otherwise built in
 * memory. Config is read from docs-ask.config.json unless one is passed in.
 */
export async function loadDocs(root: string, options: { config?: DocsAskConfig; indexFile?: string } = {}): Promise<{ docs: DocsIndex; fromFile: boolean; config: DocsAskConfig }> {
  const config = options.config ?? (await loadConfig(root));
  const askOptions = config.thresholds ? { weights: { gates: config.thresholds } } : {};
  const indexPath = join(root, options.indexFile ?? INDEX_FILE);
  const built = await stat(indexPath).then((s) => s.mtimeMs).catch(() => 0);
  if (built && built >= (await newestDoc(root, config))) {
    return { docs: loadIndex(await readIndex(indexPath), askOptions), fromFile: true, config };
  }
  return { docs: loadIndex(await indexDirectory(root, config), askOptions), fromFile: false, config };
}
