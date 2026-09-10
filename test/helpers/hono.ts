// The Hono corpus, parsed, built and loaded once per test file.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findDocs } from "../../src/node/index.ts";
import { buildIndex, parseDocument } from "../../src/parse/index.ts";

export const HONO_DIR = fileURLToPath(new URL("../fixtures/hono", import.meta.url));
export const honoData = buildIndex((await findDocs(HONO_DIR)).map((f) => parseDocument(f, readFileSync(join(HONO_DIR, f), "utf8"))));
