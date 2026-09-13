import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument, toQaSections } from "../../src/parse/index.ts";
import { VAULT_DIR, vault } from "../helpers/vault.ts";

const note = (file: string) => toQaSections(parseDocument(file, readFileSync(join(VAULT_DIR, file), "utf8")));

describe("the note card", () => {
  it("is headed by the title and quotes each property at its own line", () => {
    const [card] = note("Clients/Acme/Project overview.md");
    expect(card).toMatchObject({ id: "Clients/Acme/Project overview.md", heading: "Acme dashboard project", headingPath: [], line: 1 });
    expect(card.units.map((u) => [u.kind, u.line, u.text])).toEqual([
      ["property", 3, "client: Acme"], // "[[Acme]]" in the value, as a plain word
      ["property", 4, "status: in progress"],
      ["property", 5, "priority: high"],
      ["property", 6, "created: 2026-06-02"], // YAML reads it as a date
      ["property", 7, "budget: 18000"],
      ["property", 8, "tags: client, dashboard"],
    ]);
  });

  it("reads booleans and flow lists, and leaves out empty properties", () => {
    expect(note("Clients/Acme/Dashboard/Sync.md")[0].units.map((u) => u.text)).toEqual(["type: dashboard-page", "published: false"]);
    expect(note("Clients/Acme/Dashboard/Users.md")[0].units.map((u) => u.text)).toContain("tags: users, access");
    // every property is empty, so there is no card and the first section is the note's own heading
    expect(note("Templates/Client project template.md")[0].heading).toBe("Client project");
  });

  it("joins the intro when the note opens with text", () => {
    const [card] = note("Clients/Acme/Acme.md");
    expect(card.heading).toBe("Clients/Acme/Acme.md"); // no title property
    expect(card.units.map((u) => `${u.kind}@${u.line}`)).toEqual(["property@2", "property@3", "property@4", "sentence@7", "sentence@7", "sentence@9"]);
  });

  it("still indexes a note whose YAML is broken, without a card", () => {
    const doc = parseDocument("Knowledge/Broken properties.md", readFileSync(join(VAULT_DIR, "Knowledge/Broken properties.md"), "utf8"));
    expect(doc.frontmatterError).toBeTruthy();
    const sections = toQaSections(doc);
    expect(sections[0].heading).toBe("Broken properties");
    expect(sections.flatMap((s) => s.units).some((u) => u.kind === "property")).toBe(false);
  });

  it("takes a key named like an Object.prototype member", () => {
    const [card] = toQaSections(parseDocument("x.md", "---\nconstructor: 1\n---\n\nText.\n"));
    expect(card.units.map((u) => `${u.kind}@${u.line} ${u.text}`)).toEqual(["property@2 constructor: 1", "sentence@5 Text."]);
  });

  it("answers a property question by quoting the property line", () => {
    expect(vault.ask("what is the status of the acme dashboard project")).toMatchObject({
      confident: true,
      file: "Clients/Acme/Project overview.md",
      line: 4,
      text: "status: in progress",
    });
  });
});
