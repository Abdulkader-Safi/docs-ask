// This file deliberately carries no environment directive: it runs in plain Node, with no DOM at all.
// (Naming the directive here, even in prose, is enough for vitest to read it as one.)
import { describe, expect, it } from "vitest";

describe("importing the widget on a server", () => {
  it("defines the class and registers nothing", async () => {
    expect(globalThis.HTMLElement).toBeUndefined(); // Astro, Next and friends import into exactly this
    const { DocsAskElement, fetchIndex } = await import("../../src/widget/index.ts");
    expect(typeof DocsAskElement).toBe("function");
    expect(typeof fetchIndex).toBe("function");
    expect(globalThis.customElements).toBeUndefined();
  });
});
