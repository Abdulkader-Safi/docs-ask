// Read and write docs-index.json (optionally gzipped).
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import type { SerializedIndex } from "../core/types.ts";

/** Writes the index and returns the bytes written. Gzips when asked or when the path ends in .gz. */
export async function writeIndex(data: SerializedIndex, out: string, options: { gzip?: boolean } = {}): Promise<number> {
  const json = Buffer.from(JSON.stringify(data));
  const bytes = options.gzip || out.endsWith(".gz") ? gzipSync(json) : json;
  await writeFile(out, bytes);
  return bytes.length;
}

/** Reads an index file, gzipped or not (detected from the gzip magic bytes, not the name). */
export async function readIndex(path: string): Promise<SerializedIndex> {
  const raw = await readFile(path);
  const text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  return JSON.parse(text) as SerializedIndex;
}
