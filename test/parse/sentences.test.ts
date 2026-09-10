import { afterEach, describe, expect, it } from "vitest";
import { splitSentences } from "../../src/parse/index.ts";

// The cases from research.md section 5, "Guarded output".
const CASES: [string, string[]][] = [
  [
    "Use v2.1 of the API. Call e.g. POST /auth/refresh. See docs/errors.md for 401s.",
    ["Use v2.1 of the API.", "Call e.g. POST /auth/refresh.", "See docs/errors.md for 401s."],
  ],
  [
    "Set `a. B` first. Then call `client.auth.refresh()`. It returns a Promise.",
    ["Set `a. B` first.", "Then call `client.auth.refresh()`.", "It returns a Promise."],
  ],
  ["Dr. Smith wrote the U.S. guide. It is great.", ["Dr. Smith wrote the U.S. guide.", "It is great."]],
  ["See https://example.com/a.b. Then go.", ["See https://example.com/a.b.", "Then go."]],
  ["Limits are 1,000 per hour. Use `vs.` rarely? Yes!", ["Limits are 1,000 per hour.", "Use `vs.` rarely?", "Yes!"]],
];

const texts = (s: string) => splitSentences(s).map((x) => x.text);

describe("splitSentences with Intl.Segmenter", () => {
  it.each(CASES)("%s", (input, want) => {
    expect(texts(input)).toEqual(want);
  });

  it("treats a soft line break as a space and reports the line of each sentence", () => {
    const out = splitSentences("First line\ncontinues here. Second\nsentence. Third.");
    expect(out.map((s) => [s.text, s.lineOffset])).toEqual([
      ["First line continues here.", 0],
      ["Second sentence.", 1],
      ["Third.", 2],
    ]);
    expect(out[1].start).toBe("First line\ncontinues here. ".length);
  });
});

describe("splitSentences without Intl.Segmenter", () => {
  const original = Intl.Segmenter;
  afterEach(() => {
    Object.defineProperty(Intl, "Segmenter", { value: original, writable: true, configurable: true });
  });
  const withoutSegmenter = <T>(fn: () => T): T => {
    Object.defineProperty(Intl, "Segmenter", { value: undefined, writable: true, configurable: true });
    return fn();
  };

  it.each(CASES)("%s", (input, want) => {
    expect(withoutSegmenter(() => texts(input))).toEqual(want);
  });

  it("does not break before a lower-case word", () => {
    expect(withoutSegmenter(() => texts("Version 2. then more. Next one."))).toEqual(["Version 2. then more.", "Next one."]);
  });
});
