// "docs-ask": browser-safe query side. No node:* imports allowed here.
export type * from "./types.ts";

export { loadIndex, DocsIndex, quote, type AskOptions } from "../query/ask.ts";
export { VERSION, FORMAT_VERSION } from "./version.ts";
