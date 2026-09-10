import { describe, expect, it } from "vitest";
import { indexTerms, queryTerms, splitIdentifier, stemWord } from "../../src/query/text.ts";

describe("queryTerms: the tested outputs in research.md section 6", () => {
  it.each([
    [
      "How do I call POST /auth/refresh with --force?",
      ["call", "post", "/auth/refresh", "auth", "refresh", "--force", "forc"],
      ["/auth/refresh", "--force"],
    ],
    [
      "what is the default bodyLimit in fastify.listen()",
      ["default", "bodylimit", "bodi", "limit", "fastify.listen", "fastifi", "listen"],
      ["bodylimit", "fastify.listen"],
    ],
    [
      "how do I parse a custom content type like text/csv",
      ["pars", "custom", "content", "type", "like", "text/csv", "text", "csv"],
      ["text/csv"],
    ],
  ])("%s", (q, terms, exact) => {
    expect(queryTerms(q)).toEqual({ terms, exact });
  });
});

describe("queryTerms: the 10 Sep fixes", () => {
  it("turns 404s into the status code 404", () => {
    expect(queryTerms("how do I handle 404s myself")).toEqual({ terms: ["handl", "404"], exact: ["404"] });
  });

  it("keeps an upper-case HTTP verb but drops lower-case get", () => {
    expect(queryTerms("what does GET /users return").terms).toEqual(["get", "/users", "user", "return"]);
    expect(queryTerms("how do I get the request body").terms).toEqual(["request", "bodi"]);
  });

  it("falls back to every token when only stop words are left", () => {
    expect(queryTerms("what is it").terms).toEqual(["what", "is", "it"]);
  });
});

describe("package specifiers (M4)", () => {
  it("keeps package paths in quotes and scoped packages whole", () => {
    expect(indexTerms("import { hc } from 'hono/client'")).toContain("hono/client");
    expect(queryTerms("npm i @fastify/aws-lambda").exact).toEqual(["@fastify/aws-lambda"]);
  });
});

describe("identifiers", () => {
  it("splits camelCase, snake_case, paths and flags into parts", () => {
    expect(splitIdentifier("setNotFoundHandler")).toEqual(["set", "Not", "Found", "Handler"]);
    expect(splitIdentifier("FST_ERR_CTP_BODY_TOO_LARGE")).toEqual(["FST", "ERR", "CTP", "BODY", "TOO", "LARGE"]);
    expect(splitIdentifier("/api/v1/apps/:id")).toEqual(["api", "v1", "apps", "id"]);
    expect(splitIdentifier("--no-color")).toEqual(["no", "color"]);
  });

  it("indexes the whole identifier plus its stemmed parts, and never drops words", () => {
    expect(indexTerms("Call reply.send() to get the status")).toEqual([
      "call", "reply.send", "repli", "send", "to", "get", "the", "status",
    ]);
  });
});

describe("stemming (Porter2)", () => {
  it("avoids the original Porter collisions research.md lists", () => {
    expect(stemWord("news")).toBe("news");
    expect(stemWord("used")).toBe("use");
    expect(stemWord("dying")).toBe("die");
    expect(["configuration", "configure", "configured"].map(stemWord)).toEqual(["configur", "configur", "configur"]);
  });

  it("leaves short tokens and anything that isn't a plain lower-case word alone", () => {
    expect(["use", "api", "v2", "fastify.listen", "404"].map(stemWord)).toEqual(["use", "api", "v2", "fastify.listen", "404"]);
  });
});
