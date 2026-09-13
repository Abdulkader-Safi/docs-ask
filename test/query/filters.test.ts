import { describe, expect, it } from "vitest";
import { parseFilters } from "../../src/query/filters.ts";
import { openIndex } from "../../src/query/load.ts";
import { fastify } from "../helpers/fastify.ts";
import { vault, vaultData } from "../helpers/vault.ts";

const keys = openIndex(vaultData).filterKeys;
const files = (q: string) => [...new Set(vault.ask(q, { topK: 10 }).candidates.map((c) => c.file))];

describe("parseFilters", () => {
  it("takes out property, tag and folder filters, quoted values included", () => {
    expect(parseFilters('status:published tag:SEO folder:"Beta Foods" invoices', keys)).toEqual({
      question: "invoices",
      filters: [
        { key: "status", value: "published" },
        { key: "tag", value: "seo" },
        { key: "folder", value: "beta foods" },
      ],
    });
  });

  it("drops trailing punctuation from a value", () => {
    expect(parseFilters("which notes are status:published?", keys).filters).toEqual([{ key: "status", value: "published" }]);
  });

  it("leaves words that only look like filters in the question", () => {
    // no property is called port or node, "12" isn't a word, and a URL's value starts with "/"
    for (const q of ["open http://localhost:3000 at 12:30", "set port:3000 for the server", "(node:39638) warning"]) {
      expect(parseFilters(q, keys)).toEqual({ question: q, filters: [] });
    }
  });

  it("knows no property names in docs without frontmatter", () => {
    expect([...fastify.filterKeys]).toEqual(["folder", "tag"]);
  });
});

describe("filters in a question", () => {
  it("search only the notes whose property matches", () => {
    expect(files("dashboard")).toContain("Clients/Acme/Dashboard/Invoices.md");
    const drafts = files("status:draft dashboard");
    expect(drafts[0]).toBe("Content/Blogs/Drafts/dashboard-design-tips.md");
    expect(drafts.every((f) => ["Content/Blogs/Drafts/dashboard-design-tips.md", "Clients/Beta Foods/Portal/Invoices.md"].includes(f))).toBe(true);
  });

  it("folder: keeps to one folder, named anywhere in the path", () => {
    const beta = files('folder:"Beta Foods" invoices');
    expect(beta[0]).toBe("Clients/Beta Foods/Portal/Invoices.md");
    expect(beta.every((f) => f.startsWith("Clients/Beta Foods/"))).toBe(true);
    expect(files("folder:content/blogs pricing").every((f) => f.startsWith("Content/Blogs/"))).toBe(true);
  });

  it("with nothing else to search for, list the matching notes", () => {
    expect(vault.ask("type:blog")).toMatchObject({ confident: false, reason: "2 notes match type:blog" });
    expect(files("type:blog")).toEqual(["Content/Blogs/Drafts/dashboard-design-tips.md", "Content/Blogs/Published/how-we-price-projects.md"]);
  });

  it("tag: matches the tags property and #tags in the text", () => {
    expect(files("tag:billing")).toEqual(["Clients/Acme/Dashboard/Invoices.md", "Clients/Beta Foods/Portal/Invoices.md"]);
    expect(vault.ask("tag:meeting")).toMatchObject({ reason: "1 note matches tag:meeting", candidates: [{ file: "Daily/2026-09-01.md" }] });
  });

  it("say so when no note matches", () => {
    expect(vault.ask("status:archived invoices")).toMatchObject({ confident: false, reason: "no notes match status:archived", candidates: [] });
  });
});
