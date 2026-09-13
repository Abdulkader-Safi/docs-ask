import { describe, expect, it } from "vitest";
import { loadIndex } from "../../src/core/index.ts";
import { pathText } from "../../src/query/index-options.ts";
import { WEIGHTS } from "../../src/query/weights.ts";
import { vault, vaultData } from "../helpers/vault.ts";

describe("folder and file names", () => {
  it("become words", () => {
    expect(pathText("Clients/Beta Foods/Portal/Invoices.md")).toBe("Clients Beta Foods Portal Invoices");
    expect(pathText("Content/Blogs/Published/how-we-price-projects.md")).toBe("Content Blogs Published how we price projects");
  });

  it("are scored: a word found only in a folder or file name finds the note", () => {
    // "template" is in Templates/Client project template.md and nowhere in any note's text or properties
    const file = "Templates/Client project template.md";
    const withPath = (path: number) => loadIndex(vaultData, { weights: { search: { fieldBoost: { ...WEIGHTS.search.fieldBoost, path } } } });
    const [on] = vault.ask("template").candidates;
    expect(on.file).toBe(file);
    // Near zero, not 0: MiniSearch reads a boost of 0 as 1 (`boost[field] || 1`). The note is still the only match,
    // so it still comes first; its score is what shows the path field doing the work.
    const [off] = withPath(1e-9).ask("template").candidates;
    expect(off.score).toBeLessThan(on.score / 1000);
  });
});
