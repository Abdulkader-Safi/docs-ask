import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanLinks } from "../../src/parse/markdown.ts";
import { parseDocument, toQaSections } from "../../src/parse/index.ts";
import { indexTerms } from "../../src/query/text.ts";
import { VAULT_DIR } from "../helpers/vault.ts";

const sections = (file: string) => toQaSections(parseDocument(file, readFileSync(join(VAULT_DIR, file), "utf8")));
const texts = (file: string) => sections(file).flatMap((s) => s.units.map((u) => u.text));

describe("cleanLinks", () => {
  it.each([
    ["[[Acme]]", "Acme"],
    ["[[Order statuses|status]]", "status"],
    ["[[Glossary#SLA]]", "Glossary SLA"],
    ["[[Clients/Beta Foods/Project overview]]", "Project overview"],
    ["[[Clients/Beta Foods/Project overview|Beta Foods portal]]", "Beta Foods portal"],
    ["[[Meeting notes#^a1b2c3]]", "Meeting notes"],
    ["![[Roles]]", "Roles"],
    ["![[screenshot.png]]", ""],
    ["![[diagram.png|300]]", ""],
    ["no links here", "no links here"],
  ])("%s reads as %j", (input, out) => expect(cleanLinks(input)).toBe(out));
});

describe("Obsidian syntax in a note", () => {
  it("quotes link text the way a reader sees it", () => {
    expect(texts("Clients/Acme/Dashboard/Invoices.md")).toContain("Each row has the invoice number, the amount and a status badge.");
    expect(texts("Daily/2026-09-01.md").join(" ")).toContain("No open issues since the handover. Beta Foods portal");
  });

  it("reads a note embed as one sentence, the note's name, and drops an image embed", () => {
    const roles = sections("Clients/Acme/Dashboard/Users.md").find((s) => s.heading === "Roles")!;
    expect(roles.units.map((u) => `${u.kind}@${u.line} ${u.text}`)).toEqual(["heading@20 Roles", "sentence@22 Roles"]);
    expect(texts("Knowledge/Tools/Obsidian tips.md").join(" ")).not.toContain("screenshot");
  });

  it("leaves links inside inline code as written", () => {
    expect(texts("Knowledge/Tools/Obsidian tips.md")).toContain("Link a heading with `[[Glossary#SLA]]`, like this: Glossary SLA.");
  });

  it("drops a callout's type marker and keeps its text", () => {
    const quote = sections("Clients/Acme/Dashboard/Sync.md").flatMap((s) => s.units).find((u) => u.kind === "blockquote");
    expect(quote).toMatchObject({ line: 13, text: "Sync doesn't change orders in Shopify. It only reads them." });
  });

  it("indexes an inline #tag as its word", () => {
    expect(indexTerms("notes #meeting")).toEqual(indexTerms("notes meeting"));
  });
});
