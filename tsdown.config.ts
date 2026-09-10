import { defineConfig } from "tsdown";

export default defineConfig([
  // 1) npm entries, ESM only. One build so core is emitted once as a shared chunk.
  {
    entry: {
      index: "src/core/index.ts", // "."        browser + node safe, re-exports src/query
      parse: "src/parse/index.ts", // "./parse"  markdown -> index, browser-safe but heavy
      node: "src/node/index.ts", // "./node"   fs helpers
      mcp: "src/mcp/server.ts", // "./mcp"    createDocsMcpServer()
      "cli-bin": "src/cli/bin.ts", // bin docs-ask (ask | build | mcp)
      widget: "src/widget/index.ts", // "./widget" for bundler users
    },
    format: "esm",
    platform: "node",
    target: "node22",
    dts: true,
    publint: true,
    attw: { profile: "esm-only" },
  },
  // 2) Drop-in <script> build for the widget: everything bundled, minified, no Node.
  {
    entry: { "docs-ask-widget": "src/widget/index.ts" },
    format: "iife",
    platform: "browser",
    target: "es2022",
    globalName: "DocsAsk",
    minify: true,
    dts: false,
    clean: false,
    deps: { alwaysBundle: [/.*/] },
    outExtensions: () => ({ js: ".js" }),
  },
]);
