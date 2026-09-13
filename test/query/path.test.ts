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

  it("are scored: a folder name alone can rank the note inside it", () => {
    // "daily" is only in the folder name Daily/, and "notes" nowhere. The default weight is tuned on the dev
    // split; this raises it so the test shows the field doing the ranking.
    const withPath = (path: number) => loadIndex(vaultData, { weights: { search: { fieldBoost: { ...WEIGHTS.search.fieldBoost, path } } } });
    expect(withPath(3).ask("daily notes").candidates[0].file).toBe("Daily/2026-09-01.md");
    // near zero, not 0: MiniSearch reads a boost of 0 as 1 (`boost[field] || 1`)
    expect(withPath(1e-9).ask("daily notes").candidates[0].file).not.toBe("Daily/2026-09-01.md");
    expect(vault.ask("daily notes").candidates.map((c) => c.file)).toContain("Daily/2026-09-01.md");
  });
});
