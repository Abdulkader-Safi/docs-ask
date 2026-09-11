// Read and write docs-index.json (optionally gzipped).
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import type { SerializedIndex } from "../core/types.ts";

/**
 * Writes the index and returns the bytes written. Gzips when asked or when the path ends in .gz.
 * target "web" drops `prose` and `code`, which only feed index building: the widget answers from units.
 */
export async function writeIndex(data: SerializedIndex, out: string, options: { gzip?: boolean; target?: "node" | "web" } = {}): Promise<number> {
  const slim = options.target === "web" ? { ...data, sections: data.sections.map((s) => ({ ...s, prose: "", code: "" })) } : data;
  const json = Buffer.from(JSON.stringify(slim));
  const bytes = options.gzip || out.endsWith(".gz") ? gzipSync(json) : json;
  await writeFile(out, bytes);
  return bytes.length;
}

/** PRD risk table: a web index over 500 KB gzipped is too big for the widget. */
export const WEB_BUDGET = 500 * 1024;

/** Gzipped size of a written index. A file that is already gzipped counts as it stands. */
export async function gzippedSize(path: string): Promise<number> {
  const raw = await readFile(path);
  return raw[0] === 0x1f && raw[1] === 0x8b ? raw.length : gzipSync(raw).length;
}

/** Reads an index file, gzipped or not (detected from the gzip magic bytes, not the name). */
export async function readIndex(path: string): Promise<SerializedIndex> {
  const raw = await readFile(path);
  const text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  return JSON.parse(text) as SerializedIndex;
}
