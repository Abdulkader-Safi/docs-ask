// The drop-in <script> build, checked as a file. Skipped when dist/ is missing; CI builds before it tests.
import { existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const IIFE = fileURLToPath(new URL("../../dist/docs-ask-widget.iife.js", import.meta.url));
const has = existsSync(IIFE);
const code = has ? readFileSync(IIFE, "utf8") : "";

describe.skipIf(!has)("the IIFE widget bundle", () => {
  it("is 20 KB gzipped or less, not counting the index", () => {
    const gz = gzipSync(Buffer.from(code)).length;
    expect(gz).toBeLessThanOrEqual(20 * 1024); // PRD section 2; 17.2 KB today
  });

  it("carries the query side but no parser and nothing from Node", () => {
    expect(code).toContain("docs-ask"); // the element name it registers
    expect(code).toContain("customElements");
    expect(code).not.toMatch(/markdown-it|markdownit/);
    expect(code).not.toMatch(/require\(["']node:|from["']node:|["']node:(fs|path|zlib|url|os)/);
    expect(code).not.toContain("markdownItAttrs");
  });

  it("bundles MiniSearch rather than importing it", () => {
    expect(code).not.toMatch(/^import|\bfrom ?["']minisearch["']/m);
    expect(code).toContain("MiniSearch: document does not have ID field"); // one of its own errors, so it really is in there
  });
});
