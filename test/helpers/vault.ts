// The invented Obsidian vault, parsed and built once per test file.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadIndex } from "../../src/core/index.ts";
import { findDocs } from "../../src/node/index.ts";
import { buildIndex, parseDocument } from "../../src/parse/index.ts";

export const VAULT_DIR = fileURLToPath(new URL("../fixtures/vault", import.meta.url));
export const vaultData = buildIndex((await findDocs(VAULT_DIR)).map((f) => parseDocument(f, readFileSync(join(VAULT_DIR, f), "utf8"))));
export const vault = loadIndex(vaultData);
