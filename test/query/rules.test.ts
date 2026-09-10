import { describe, expect, it } from "vitest";
import { classify, RULES, TRIGGER_WORDS, type QClass } from "../../src/query/rules.ts";
import { stemWord } from "../../src/query/text.ts";

// The 37 labelled questions from research.md section 8 (all right in the prototype; written while
// tuning, so expect lower on new phrasings).
const CASES: [string, QClass][] = [
  ['How do I register a plugin?', 'HOWTO'],
  ['how to add a hook', 'HOWTO'],
  ['steps to deploy on serverless', 'HOWTO'],
  ['What is encapsulation?', 'DEFINITION'],
  ["What's a decorator", 'DEFINITION'],
  ['What does onRequest mean?', 'DEFINITION'],
  ['hooks', 'DEFINITION'],
  ['Which endpoint creates an app?', 'ENDPOINT'],
  ['what URL do I call to refresh a token', 'ENDPOINT'],
  ['route for health check', 'ENDPOINT'],
  ['What parameters does POST /api/v1/apps accept?', 'PARAMS'],
  ['what options does fastify.listen take', 'PARAMS'],
  ['required fields for creating a status', 'PARAMS'],
  ['What is the default bodyLimit?', 'VALUE'],
  ['how long is keepAliveTimeout', 'VALUE'],
  ['How many requests per socket are allowed?', 'VALUE'],
  ['default plugin timeout', 'VALUE'],
  ['Where is the error handler documented?', 'LOCATION'],
  ['which file configures the logger', 'LOCATION'],
  ['Why does my request return 401?', 'ERROR'],
  ['FST_ERR_CTP_BODY_TOO_LARGE', 'ERROR'],
  ['how do I fix FST_ERR_CTP_BODY_TOO_LARGE', 'ERROR'],
  ['server fails to start with EADDRINUSE', 'ERROR'],
  ['hooks not working after register', 'ERROR'],
  ['example of a preHandler hook', 'EXAMPLE'],
  ['show me how to use decorators', 'EXAMPLE'],
  ['Can I use async/await in hooks?', 'YESNO'],
  ['Does fastify support http2?', 'YESNO'],
  ['is it possible to disable the logger', 'YESNO'],
  ['difference between onRequest and preHandler', 'COMPARISON'],
  ['reply.send vs return', 'COMPARISON'],
  ['middleware', 'DEFINITION'],
  ['logging pino config', 'FALLBACK'],
  ['How do I set the body limit?', 'HOWTO'],
  ['what is the maximum payload size', 'VALUE'],
  ['when does the token expire', 'VALUE'],
  ['Can I see an example of a route schema?', 'EXAMPLE'],
];

describe("classify", () => {
  it.each(CASES)("%s -> %s", (q, want) => {
    expect(classify(q).primary.id).toBe(want);
  });

  it("lets stacked strong triggers beat a weaker type (research.md section 8)", () => {
    const value = classify("What is the default bodyLimit?");
    expect([value.scores.VALUE, value.scores.DEFINITION]).toEqual([6, 3]);
    const howto = classify("How do I set the body limit?");
    expect([howto.scores.HOWTO, howto.scores.VALUE]).toEqual([4, 2]);
  });

  it("keeps runner-up types as secondary", () => {
    expect(classify("how do I fix FST_ERR_CTP_BODY_TOO_LARGE").secondary.map((r) => r.id)).toContain("HOWTO");
  });

  it("needs a score of 3 or more, else falls back", () => {
    const c = classify("logging pino config");
    expect(c.primary.id).toBe("FALLBACK");
    expect(Math.max(...Object.values(c.scores))).toBeLessThan(3);
  });
});

describe("rule table", () => {
  it("has ten types plus FALLBACK, each with a preferred unit list", () => {
    expect(RULES.map((r) => r.id)).toHaveLength(11);
    expect(RULES.every((r) => r.preferUnits.length > 0)).toBe(true);
  });

  it("keeps trigger words stemmed, as they appear in query terms", () => {
    for (const w of TRIGGER_WORDS) expect(stemWord(w), w).toBe(w);
  });
});
