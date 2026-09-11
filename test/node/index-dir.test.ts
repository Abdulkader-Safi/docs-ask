// indexDirectory, the build targets and the fresh-index check (PRD section 5).
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { gzippedSize, indexDirectory, loadDocs, readIndex, writeIndex, INDEX_FILE, WEB_BUDGET } from "../../src/node/index.ts";
import { loadIndex } from "../../src/core/index.ts";

const FASTIFY = fileURLToPath(new URL("../fixtures/fastify", import.meta.url));
const out = mkdtempSync(join(tmpdir(), "docs-ask-out-"));
afterAll(() => rmSync(out, { recursive: true, force: true }));

let root: string;
const write = (rel: string, body: string) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
};
const age = (rel: string, secondsOld: number) => {
  const t = new Date(Date.now() - secondsOld * 1000);
  utimesSync(join(root, rel), t, t);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "docs-ask-dir-"));
  write("docs/limits.md", "# Limits\n\n## bodyLimit\n\nDefault: `1048576` (1MiB)\n");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("build targets", () => {
  it("web drops prose and code, and is smaller than node", async () => {
    const data = await indexDirectory(FASTIFY);
    const node = join(out, "node.json"), web = join(out, "web.json");
    const nodeBytes = await writeIndex(data, node);
    const webBytes = await writeIndex(data, web, { target: "web" });
    expect(webBytes).toBeLessThan(nodeBytes * 0.9);
    const loaded = await readIndex(web);
    expect(loaded.sections.every((s) => s.prose === "" && s.code === "")).toBe(true);
    expect(loaded.sections[0].units.length).toBeGreaterThan(0); // units are what answers come from
  });

  it("a web index still answers, and gives the same answer as the node one", async () => {
    const data = await indexDirectory(FASTIFY);
    const path = join(out, "answers.json");
    await writeIndex(data, path, { target: "web" });
    const web = loadIndex(await readIndex(path));
    const question = "what is the default bodyLimit";
    expect(web.ask(question)).toEqual(loadIndex(data).ask(question));
    expect(web.ask(question).text).toBe("Default: `1048576` (1MiB)");
  });

  it("gzippedSize measures a plain file and reports a gzipped one as it stands", async () => {
    const data = await indexDirectory(FASTIFY);
    const plain = join(out, "plain.json"), gz = join(out, "gz.json.gz");
    await writeIndex(data, plain, { target: "web" });
    const gzBytes = await writeIndex(data, gz, { target: "web" });
    expect(await gzippedSize(plain)).toBeCloseTo(gzBytes, -3); // same bytes, one measured, one written
    expect(await gzippedSize(gz)).toBe(gzBytes);
    expect(gzBytes).toBeLessThan(WEB_BUDGET); // 30 Fastify files fit the widget budget
  });
});

describe("a single file stands in for a folder", () => {
  it("indexes one file and cites it from its own folder", async () => {
    const one = await loadDocs(join(FASTIFY, "Reference/TypeScript.md"));
    const all = await loadDocs(FASTIFY);
    expect(one.docs.sectionCount).toBeGreaterThan(0);
    expect(one.docs.sectionCount).toBeLessThan(all.docs.sectionCount);
    expect(one.docs.ask("what is a FastifyInstance").file).toBe("TypeScript.md"); // relative to Reference/
  });

  it("ignores a folder index that covers more than the file asked for", async () => {
    write("docs/limits.md", "# Limits\n\n## bodyLimit\n\nDefault: `1048576` (1MiB)\n");
    write("docs/other.md", "# Other\n\n## keepAliveTimeout\n\nDefault: `72000` (72 seconds)\n");
    await writeIndex(await indexDirectory(root), join(root, "docs", INDEX_FILE));
    const one = await loadDocs(join(root, "docs/other.md"));
    expect(one.fromFile).toBe(false);
    expect(one.docs.ask("what is the default bodyLimit").confident).toBe(false); // that file isn't in scope
  });

  it("indexDirectory takes a file too", async () => {
    const data = await indexDirectory(join(FASTIFY, "Reference/TypeScript.md"));
    expect(new Set(data.sections.map((s) => s.file))).toEqual(new Set(["TypeScript.md"]));
  });
});

describe("loadDocs uses the index file only while it's fresh", () => {
  const buildTo = async (path = join(root, INDEX_FILE)) => writeIndex(await indexDirectory(root), path);

  it("builds in memory when there's no index file", async () => {
    const { docs, fromFile } = await loadDocs(root);
    expect(fromFile).toBe(false);
    expect(docs.ask("what is the default bodyLimit").text).toBe("Default: `1048576` (1MiB)");
  });

  it("reads the index file when it's newer than every doc", async () => {
    await buildTo();
    age("docs/limits.md", 60);
    expect((await loadDocs(root)).fromFile).toBe(true);
  });

  it("rebuilds when a doc changed after the index was written, and sees the change", async () => {
    await buildTo();
    write("docs/limits.md", "# Limits\n\n## bodyLimit\n\nDefault: `2097152` (2MiB)\n");
    const { docs, fromFile } = await loadDocs(root);
    expect(fromFile).toBe(false);
    expect(docs.ask("what is the default bodyLimit").text).toBe("Default: `2097152` (2MiB)");
  });

  it("rebuilds when a new doc is added, even though the index file is untouched", async () => {
    await buildTo();
    write("docs/timeouts.md", "# Timeouts\n\n## keepAliveTimeout\n\nDefault: `72000` (72 seconds)\n");
    expect((await loadDocs(root)).fromFile).toBe(false);
  });

  it("rebuilds when a doc was saved in the same millisecond as the index", async () => {
    await buildTo();
    const same = new Date(); // stat's mtimeMs can carry a fraction, so stamp both files from one value
    utimesSync(join(root, INDEX_FILE), same, same);
    utimesSync(join(root, "docs/limits.md"), same, same);
    expect((await loadDocs(root)).fromFile).toBe(false);
  });

  it("takes another index file name", async () => {
    await buildTo(join(root, "custom.json"));
    age("docs/limits.md", 60);
    expect((await loadDocs(root, { indexFile: "custom.json" })).fromFile).toBe(true);
    expect((await loadDocs(root)).fromFile).toBe(false); // docs-index.json still missing
  });

  it("doesn't index its own index file", async () => {
    await buildTo();
    age("docs/limits.md", 60);
    const { docs } = await loadDocs(root);
    expect(docs.sectionCount).toBe(2); // Limits and bodyLimit, nothing from docs-index.json
    expect(statSync(join(root, INDEX_FILE)).size).toBeGreaterThan(0);
  });
});
