// PRD section 2, speed: ask() p95 under 20 ms on 2,000 sections; building 200 markdown files under 3 s.
// Both corpora twice over, under renamed paths, give 234 files and 2,702 sections.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadIndex } from "../../src/core/index.ts";
import { findDocs } from "../../src/node/index.ts";
import { buildIndex, parseDocument } from "../../src/parse/index.ts";
import { DEV } from "./golden.ts";

const sources: [string, string][] = [];
for (const c of ["fastify", "hono"]) {
  const root = fileURLToPath(new URL(`../fixtures/${c}`, import.meta.url));
  for (const f of await findDocs(root)) sources.push([`${c}/${f}`, readFileSync(join(root, f), "utf8")]);
}
const files = [...sources, ...sources.map(([f, src]) => [`copy/${f}`, src] as [string, string])];

describe("speed", () => {
  it("builds the index for 200 markdown files in under 3 seconds", () => {
    const t = performance.now();
    buildIndex(files.slice(0, 200).map(([f, src]) => parseDocument(f, src)));
    const ms = performance.now() - t;
    console.log(`build 200 files: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(3000);
  });

  it("answers in under 20 ms at p95 on 2,000+ sections", () => {
    const docs = loadIndex(buildIndex(files.map(([f, src]) => parseDocument(f, src))));
    expect(docs.sectionCount).toBeGreaterThanOrEqual(2000);
    const times: number[] = [];
    for (let round = 0; round < 5; round++) {
      for (const g of DEV) {
        const t = performance.now();
        docs.ask(g.q);
        times.push(performance.now() - t);
      }
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    console.log(`ask() on ${docs.sectionCount} sections: p50 ${times[Math.floor(times.length / 2)].toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`);
    expect(p95).toBeLessThan(20);
  });
});
