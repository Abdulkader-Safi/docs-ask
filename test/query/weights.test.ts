import { describe, expect, it } from "vitest";
import { WEIGHTS, withWeights } from "../../src/query/weights.ts";

describe("withWeights", () => {
  it("returns the defaults when given nothing", () => {
    expect(withWeights()).toEqual(WEIGHTS);
    expect(withWeights()).not.toBe(WEIGHTS);
  });

  it("replaces only the values given, one group at a time", () => {
    const w = withWeights({ gates: { minCoverage: 0.3 }, candidates: 10 });
    expect(w.gates).toEqual({ ...WEIGHTS.gates, minCoverage: 0.3 });
    expect(w.candidates).toBe(10);
    expect(w.search).toEqual(WEIGHTS.search);
  });

  it("never changes the shared defaults", () => {
    const w = withWeights({ rerank: { jaccard: 0 } });
    w.search.fieldBoost.heading = 99;
    expect(WEIGHTS.rerank.jaccard).toBe(1);
    expect(WEIGHTS.search.fieldBoost.heading).toBe(3);
  });
});
