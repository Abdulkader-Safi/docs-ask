import MiniSearch from "minisearch";
import { describe, expect, it } from "vitest";
import { compileSynonyms, SYNONYMS } from "../../src/query/synonyms.ts";
import { indexTerms, queryTerms, stemWord } from "../../src/query/text.ts";

const syn = compileSynonyms();
const tokenize = (t: string) => indexTerms(syn.normPhrases(t)).map(syn.canon);

describe("strict groups: rewritten at index and query time", () => {
  it("rewrites multi-word aliases before tokenizing", () => {
    expect(syn.normPhrases("How do I sign in? Then Log In again.")).toBe("How do I login? Then login again.");
  });

  it("maps single-word aliases to the canonical term", () => {
    expect(["signin", "authenticate", "authentication", "auth"].map((a) => syn.canon(stemWord(a)))).toEqual([
      "login", "login", "login", "login",
    ]);
  });

  it("gives a doc that says 'sign in' the same terms as one that says 'login'", () => {
    expect(tokenize("Sign in with your token")).toEqual(tokenize("Login with your token"));
  });
});

describe("M4 groups", () => {
  it("rewrites 'turn on' to 'enable' and links hide to redact, stop to close", () => {
    expect(tokenize("How do I turn on logging")).toContain("enabl");
    expect(syn.loose.get("hide")).toEqual(["redact"]);
    expect(syn.loose.get("stop")).toEqual(["close"]);
  });
});

describe("loose groups: added to the query only", () => {
  it("links the canonical word and its aliases both ways", () => {
    expect(syn.loose.get("delet")).toEqual(["remov", "destroy", "drop", "eras"]);
    expect(syn.loose.get("remov")).toEqual(["delet"]);
  });

  it("leaves the index alone", () => {
    expect(tokenize("Remove the record")).toEqual(["remov", "the", "record"]);
  });

  it("accepts extra groups from a repo", () => {
    const custom = compileSynonyms([...SYNONYMS, { canonical: "purge", aliases: ["wipe", "flush"], strict: false }]);
    expect(custom.loose.get("wipe")).toEqual(["purg"]);
    expect(custom.loose.get("purg")).toEqual(["wipe", "flush"]);
  });
});

// research.md section 6: MiniSearch multiplies a doc's score by how many distinct query terms it matched,
// so a doc that uses several loose aliases gets inflated. Boosting alias terms to 0.4 shrinks that.
describe("loose alias scoring", () => {
  const ms = new MiniSearch({ fields: ["text"], tokenize, processTerm: (t) => t });
  ms.addAll([
    { id: "exact", text: "Delete the record. Delete it from the list. Delete works on drafts." },
    { id: "aliases", text: "Remove the record. Destroy the cache. Drop the table." },
  ]);
  const q = [...new Set(queryTerms(syn.normPhrases("how do I delete a record")).terms.map(syn.canon))];
  const expanded = [...new Set([...q, ...q.flatMap((t) => syn.loose.get(t) ?? [])])];
  const scores = (aliasBoost: number) =>
    Object.fromEntries(
      ms
        .search(expanded.join(" "), {
          tokenize: (s) => s.split(" "),
          processTerm: (t) => t,
          boostTerm: (t) => (q.includes(t) ? 1 : aliasBoost),
          combineWith: "OR",
        })
        .map((r) => [r.id, r.score]),
    );

  it("boost 0.4 cuts the alias doc's lead", () => {
    const full = scores(1), low = scores(0.4);
    expect(low.aliases / low.exact).toBeLessThan(full.aliases / full.exact);
    expect(low.exact).toBeCloseTo(full.exact);
  });

  // Raw MiniSearch still lets the alias doc win (6.29 vs 3.35 here; research.md's table shows 1.68 vs 1.43).
  // retrieve() corrects it by counting a word and its synonyms as one match: see test/query/retrieve.test.ts.
  it("lets the alias doc win in raw MiniSearch, which is why retrieve regroups", () => {
    const low = scores(0.4);
    expect(low.aliases).toBeGreaterThan(low.exact);
  });
});
