import { describe, expect, it } from "vitest";
import { loadIndex } from "../../src/core/index.ts";
import { editDistance } from "../../src/query/suggest.ts";
import { fastifyData } from "../helpers/fastify.ts";

const docs = loadIndex(fastifyData);

describe("editDistance", () => {
  it("counts insertions, deletions and substitutions", () => {
    expect(editDistance("keepalivetimout", "keepalivetimeout")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("same", "same")).toBe(0);
  });
});

describe("suggestions", () => {
  it("offers near spellings when a question names an unknown identifier, as the docs spell them", () => {
    const a = docs.ask("what is the default keepAliveTimout");
    expect(a).toMatchObject({ confident: false, reason: "not found in docs: keepalivetimout", suggestions: ["keepAliveTimeout"] });
  });

  it("puts the closest spelling first", () => {
    expect(docs.suggest("fastify.lisen")[0]).toBe("fastify.listen");
    expect(docs.suggest("bodylimt")).toEqual(["bodyLimit"]);
  });

  it("returns nothing for text with no near match, and adds no field to normal answers", () => {
    expect(docs.suggest("zzzqqq")).toEqual([]);
    expect(docs.ask("What is the default bodyLimit?")).not.toHaveProperty("suggestions");
    expect(docs.ask("how do I turn on logging")).not.toHaveProperty("suggestions");
  });

  it("returns at most WEIGHTS.suggest.max, and the limit can be changed", () => {
    expect(docs.suggest("fastify.lisen").length).toBeLessThanOrEqual(3);
    expect(loadIndex(fastifyData, { weights: { suggest: { max: 1 } } }).suggest("fastify.lisen")).toEqual(["fastify.listen"]);
  });
});
