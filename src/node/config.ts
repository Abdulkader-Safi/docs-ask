// docs-ask.config.json, optional (PRD section 5).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SynonymGroup } from "../core/types.ts";
import type { WeightOverrides } from "../query/weights.ts";

export interface DocsAskConfig {
  /** glob patterns to index, relative to the root */
  include?: string[];
  /** extra gitignore-style patterns to skip */
  exclude?: string[];
  /** extra synonym groups, on top of the defaults */
  synonyms?: SynonymGroup[];
  /** gate thresholds, merged into WEIGHTS.gates */
  thresholds?: WeightOverrides["gates"];
  /** where the docs are published, for the widget's links */
  baseUrl?: string;
}

export const CONFIG_FILE = "docs-ask.config.json";

const isStrings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Reads and checks docs-ask.config.json. Missing file: {}. Bad file: a clear error. */
export async function loadConfig(root: string, file = CONFIG_FILE): Promise<DocsAskConfig> {
  const path = join(root, file);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return {};
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`${file}: not valid JSON (${(e as Error).message})`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${file}: expected an object`);
  const c = raw as Record<string, unknown>;
  for (const key of ["include", "exclude"]) if (key in c && !isStrings(c[key])) throw new Error(`${file}: "${key}" must be an array of strings`);
  if ("baseUrl" in c && typeof c.baseUrl !== "string") throw new Error(`${file}: "baseUrl" must be a string`);
  if ("thresholds" in c && (!c.thresholds || typeof c.thresholds !== "object")) throw new Error(`${file}: "thresholds" must be an object`);
  if ("synonyms" in c) {
    const groups = c.synonyms;
    const ok = Array.isArray(groups) && groups.every((g) => g && typeof g === "object" && typeof (g as SynonymGroup).canonical === "string" && isStrings((g as SynonymGroup).aliases) && typeof (g as SynonymGroup).strict === "boolean");
    if (!ok) throw new Error(`${file}: each synonym group needs canonical (string), aliases (strings) and strict (boolean)`);
  }
  return c as DocsAskConfig;
}
