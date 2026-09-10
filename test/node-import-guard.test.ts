// PRD section 2: nothing reachable from the "." entry or the widget may import node:*.
// Follows relative imports from every file under the browser-safe folders and fails on
// any Node builtin, with or without the "node:" prefix.
import { builtinModules } from "node:module";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BROWSER_SAFE = ["src/core", "src/query", "src/parse", "src/widget"];
const BUILTINS = new Set(builtinModules);
const IMPORT_RE =
  /(?:^|[^\w.])(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|(?:^|[^\w.])import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

function specifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2] ?? m[3]);
}

function isBuiltin(spec: string): boolean {
  return spec.startsWith("node:") || BUILTINS.has(spec.split("/")[0]);
}

function resolveLocal(from: string, spec: string): string | undefined {
  const base = resolve(dirname(from), spec);
  return [base, `${base}.ts`, join(base, "index.ts")].find((p) => existsSync(p) && statSync(p).isFile());
}

function tsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(dir, f));
}

/** Every "file -> builtin" import reachable from the given root folders. */
export function findNodeImports(roots: string[], cwd = process.cwd()): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  const queue = roots.flatMap((r) => tsFiles(resolve(cwd, r)));
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of specifiers(readFileSync(file, "utf8"))) {
      if (isBuiltin(spec)) found.push(`${relative(cwd, file)} -> ${spec}`);
      else if (spec.startsWith(".")) {
        const next = resolveLocal(file, spec);
        if (next) queue.push(next);
      }
    }
  }
  return found.sort();
}

describe("node import scanner", () => {
  it("catches builtins directly, through a relative import, and in dynamic imports", () => {
    const dir = mkdtempSync(join(tmpdir(), "docs-ask-guard-"));
    try {
      writeFileSync(join(dir, "a.ts"), 'import { b } from "./b.ts";\nexport const a = b;\n');
      writeFileSync(join(dir, "b.ts"), 'export { x } from "./c";\nimport fs from "fs";\nexport const b = 1;\n');
      writeFileSync(join(dir, "c.ts"), 'export const x = await import("node:path");\n');
      writeFileSync(join(dir, "clean.ts"), 'import MiniSearch from "minisearch";\nexport const reimport = 1;\n');
      expect(findNodeImports(["."], dir)).toEqual(["b.ts -> fs", "c.ts -> node:path"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("browser-safe folders", () => {
  it("import nothing from Node", () => {
    expect(findNodeImports(BROWSER_SAFE)).toEqual([]);
  });
});
