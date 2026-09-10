// "docs-ask": browser-safe query side. No node:* imports allowed here.
export type * from "./types.ts";

export { loadIndex, type LoadedIndex } from "../query/load.ts";
export { VERSION, FORMAT_VERSION } from "./version.ts";
