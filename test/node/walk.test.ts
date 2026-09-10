import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findDocs } from "../../src/node/index.ts";

let root: string;
const touch = (rel: string, body = "# x\n") => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "docs-ask-walk-"));
  for (const f of [
    "README.md",
    "CHANGELOG.md",
    "docs/intro.md",
    "docs/guide/setup.mdx",
    "docs/guide/CHANGELOG.md",
    "docs/notes.txt",
    "node_modules/pkg/README.md",
    "packages/a/node_modules/dep/README.md",
    "build/generated.md",
    "drafts/wip.md",
    ".github/CONTRIBUTING.md",
  ])
    touch(f);
  writeFileSync(join(root, ".gitignore"), "build/\n*.log\n");
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("findDocs", () => {
  it("finds .md and .mdx files, skipping node_modules, CHANGELOGs, gitignored and hidden paths", async () => {
    expect(await findDocs(root)).toEqual(["README.md", "docs/guide/setup.mdx", "docs/intro.md", "drafts/wip.md"]);
  });

  it("takes extra exclude patterns in gitignore syntax", async () => {
    expect(await findDocs(root, { exclude: ["drafts/", "*.mdx"] })).toEqual(["README.md", "docs/intro.md"]);
  });

  it("narrows to the include globs", async () => {
    expect(await findDocs(root, { include: ["docs/**/*.md", "docs/**/*.mdx"] })).toEqual(["docs/guide/setup.mdx", "docs/intro.md"]);
  });

  it("also honours git's local .git/info/exclude", async () => {
    touch(".git/info/exclude", "drafts/\n");
    try {
      expect(await findDocs(root)).toEqual(["README.md", "docs/guide/setup.mdx", "docs/intro.md"]);
    } finally {
      rmSync(join(root, ".git"), { recursive: true, force: true });
    }
  });

  it("works without a .gitignore", async () => {
    const bare = mkdtempSync(join(tmpdir(), "docs-ask-walk-bare-"));
    try {
      writeFileSync(join(bare, "a.md"), "# a\n");
      expect(await findDocs(bare)).toEqual(["a.md"]);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it("returns the 30 Fastify files from the vendored corpus", async () => {
    const files = await findDocs(new URL("../fixtures/fastify", import.meta.url).pathname);
    expect(files).toHaveLength(30);
    expect(files[0]).toBe("Guides/Database.md");
  });
});
