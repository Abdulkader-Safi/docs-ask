import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDocument, toQaSections } from "../../src/parse/index.ts";

const SAMPLE = readFileSync(new URL("../fixtures/api-sample.md", import.meta.url), "utf8");
const sections = toQaSections(parseDocument("docs/api.md", SAMPLE));
const byHeading = (h: string, parent?: string) =>
  sections.find((s) => s.heading === h && (parent === undefined || s.headingPath.at(-1) === parent))!;

describe("toQaSections on the sample API doc", () => {
  it("keeps ancestors only in headingPath", () => {
    const examples = byHeading("Examples", "Refresh tokens");
    expect(examples.headingPath).toEqual(["Authentication", "Refresh tokens"]);
    expect(examples.id).toBe("docs/api.md#examples");
    expect(byHeading("Authentication").headingPath).toEqual([]);
  });

  it("splits paragraphs into sentences, each on its own source line", () => {
    const intro = sections[0];
    expect(intro.heading).toBe("docs/api.md");
    expect(intro.units.map((u) => [u.kind, u.line, u.text])).toEqual([
      ["sentence", 7, "Welcome to the Acme API."],
      ["sentence", 7, "Use v2.1 of the API for all new work."],
      ["sentence", 8, "This page covers authentication, rate limits and errors."],
    ]);
  });

  it("writes one unit per table row as Header: cell pairs, with the row's line", () => {
    const rows = byHeading("Refresh tokens").units.filter((u) => u.kind === "tableRow");
    expect(rows.map((u) => u.line)).toEqual([29, 30, 31]);
    expect(rows[0].text).toBe(
      "Param: `refresh_token` | Type: string | Required: yes | Description: The token from the login response.",
    );
  });

  it("turns list items, code and blockquotes into units", () => {
    const kinds = byHeading("Examples", "Refresh tokens").units.map((u) => `${u.kind}@${u.line}`);
    expect(kinds).toEqual(["heading@33", "list@35", "list@36", "orderedList@38", "blockquote@40"]);
    const code = byHeading("Access tokens").units.find((u) => u.kind === "code")!;
    expect(code).toMatchObject({ line: 18, lang: "bash" });
  });

  it("fills prose and code for the index, leaving headings out", () => {
    const access = byHeading("Access tokens");
    expect(access.prose).toBe("Request a token with `POST /auth/token`.\nSend your client ID and secret.");
    expect(access.code).toContain("curl -X POST https://api.acme.dev/auth/token");
  });

  it("strips backticks from headings", () => {
    const [s] = toQaSections(parseDocument("server.md", "## `bodyLimit`\n\nDefault: `1048576` (1MiB)\n"));
    expect(s.heading).toBe("bodyLimit");
    expect(s.units.map((u) => u.text)).toEqual(["bodyLimit", "Default: `1048576` (1MiB)"]);
  });

  it("is stable", () => {
    expect(sections.map((s) => ({ id: s.id, units: s.units.map((u) => `${u.kind}@${u.line}`) }))).toMatchSnapshot();
  });
});
