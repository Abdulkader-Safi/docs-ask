// The Fastify corpus, parsed, built and loaded once per test file.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openIndex as loadIndex } from "../../src/query/load.ts";
import { findDocs } from "../../src/node/index.ts";
import { buildIndex, parseDocument } from "../../src/parse/index.ts";

export const FASTIFY_DIR = fileURLToPath(new URL("../fixtures/fastify", import.meta.url));
export const fastifyData = buildIndex(
  (await findDocs(FASTIFY_DIR)).map((f) => parseDocument(f, readFileSync(join(FASTIFY_DIR, f), "utf8"))),
);
export const fastify = loadIndex(fastifyData);
