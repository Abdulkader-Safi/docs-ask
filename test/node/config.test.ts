import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { indexDirectory, loadConfig, loadDocs } from "../../src/node/index.ts";

let root: string;
const write = (rel: string, body: string) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
};
const config = (c: unknown) => write("docs-ask.config.json", typeof c === "string" ? c : JSON.stringify(c));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "docs-ask-config-"));
  write("docs/guide.md", "# Guide\n\n## Log redaction\n\nUse the redact option to hide passwords in logs.\n");
  write("docs/limits.md", "# Limits\n\n## bodyLimit\n\nDefault: `1048576` (1MiB)\n");
  write("drafts/wip.md", "# Draft\n\n## bodyLimit\n\nDraft text about bodyLimit.\n");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("loadConfig", () => {
  it("returns {} when there's no config file", async () => {
    expect(await loadConfig(root)).toEqual({});
  });

  it("reads the file", async () => {
    config({ include: ["docs/**/*.md"], baseUrl: "https://example.com/docs/" });
    expect(await loadConfig(root)).toEqual({ include: ["docs/**/*.md"], baseUrl: "https://example.com/docs/" });
  });

  it.each([
    ["{ not json", "not valid JSON"],
    [[], "expected an object"],
    [{ include: "docs/**" }, '"include" must be an array of strings'],
    [{ baseUrl: 3 }, '"baseUrl" must be a string'],
    [{ thresholds: "strict" }, '"thresholds" must be an object'],
    [{ synonyms: [{ canonical: "redact" }] }, "each synonym group needs canonical"],
  ])("rejects %s with a clear message", async (bad, message) => {
    config(bad as unknown);
    await expect(loadConfig(root)).rejects.toThrow(message);
  });
});

describe("the config changes what gets indexed and answered", () => {
  it("include narrows the files", async () => {
    config({ include: ["docs/**/*.md"] });
    const data = await indexDirectory(root, await loadConfig(root));
    expect([...new Set(data.sections.map((s) => s.file))].sort()).toEqual(["docs/guide.md", "docs/limits.md"]);
  });

  it("exclude drops files", async () => {
    config({ exclude: ["drafts/"] });
    const { docs } = await loadDocs(root);
    expect(docs.ask("what is the default bodyLimit").file).toBe("docs/limits.md");
  });

  it("extra synonyms are applied and saved in the index, so query time matches build time", async () => {
    config({ synonyms: [{ canonical: "redact", aliases: ["hide"], strict: true }] });
    const data = await indexDirectory(root, await loadConfig(root));
    expect(data.config.synonyms.at(-1)).toEqual({ canonical: "redact", aliases: ["hide"], strict: true });
    expect(data.df.hide).toBeUndefined(); // rewritten to the canonical word at index time
    const { docs } = await loadDocs(root);
    expect(docs.ask("how do I hide passwords in logs").headingPath?.at(-1)).toBe("Log redaction");
  });

  it("thresholds are merged into the gates", async () => {
    // docs/ and drafts/ both have a bodyLimit section, so the gap gate fires by default
    const { docs } = await loadDocs(root);
    expect(docs.ask("what is the default bodyLimit")).toMatchObject({ confident: false, reason: expect.stringContaining("ambiguous") });
    // with the gap bars at zero that gate passes and the next one speaks: the drafts section holds no value
    const { docs: lenient } = await loadDocs(root, { config: { thresholds: { minGap: 0, softGap: 0 } } });
    expect(lenient.ask("what is the default bodyLimit").reason).toBe("VALUE question but best section has no value");
  });
});
