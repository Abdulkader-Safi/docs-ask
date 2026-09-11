// @vitest-environment happy-dom
// The custom element, in a DOM. Nothing here talks to the network: fetch is replaced with the index bytes.
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildIndex, parseDocument } from "../../src/parse/index.ts";
import type { SerializedIndex } from "../../src/core/index.ts";
import "../../src/widget/index.ts";

const DOCS = `# Limits

## bodyLimit

Default: \`1048576\` (1MiB)

The largest payload the server accepts.

## keepAliveTimeout

Default: \`72000\` (72 seconds)
`;

const data: SerializedIndex = buildIndex([parseDocument("reference/limits.md", DOCS)]);
const json = JSON.stringify(data);

let fetched: string[] = [];
const serve = (body: BodyInit, headers: Record<string, string> = {}) => {
  globalThis.fetch = vi.fn(async (url: any) => {
    fetched.push(String(url));
    return new Response(body, { headers });
  }) as typeof fetch;
};

let el: any;
const key = (target: EventTarget, init: KeyboardEventInit) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
const input = () => el.shadowRoot.querySelector("input") as HTMLInputElement;
const options = () => [...el.shadowRoot.querySelectorAll("li")] as HTMLElement[];
const answerBox = () => el.shadowRoot.querySelector(".answer") as HTMLElement;
const type = async (text: string) => {
  input().value = text;
  input().dispatchEvent(new Event("input"));
  await vi.waitUntil(() => el.shadowRoot.querySelector(".panel").hidden === false, 1000);
};

beforeEach(() => {
  fetched = [];
  serve(json);
  document.body.innerHTML = '<docs-ask index="/docs-index.json"></docs-ask>';
  el = document.querySelector("docs-ask");
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("loading", () => {
  it("fetches nothing until the input is focused", () => {
    expect(el.shadowRoot).toBeTruthy();
    expect(fetched).toEqual([]);
    input().dispatchEvent(new Event("focus"));
    expect(fetched).toEqual(["/docs-index.json"]);
  });

  it("fetches once, however many questions are asked", async () => {
    await type("what is the default bodyLimit");
    await type("how long is keepAliveTimeout");
    expect(fetched).toEqual(["/docs-index.json"]);
  });

  it("inflates a .json.gz served without Content-Encoding", async () => {
    serve(gzipSync(Buffer.from(json)));
    document.body.innerHTML = '<docs-ask index="/docs-index.json.gz"></docs-ask>';
    el = document.querySelector("docs-ask");
    await type("what is the default bodyLimit");
    expect(answerBox().textContent).toContain("1048576");
  });

  it("reports a bad response instead of hanging", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 404 })) as typeof fetch;
    await expect(el.load()).rejects.toThrow("docs-ask: 404 loading /docs-index.json");
  });
});

describe("answering", () => {
  it("quotes the answer with its citation and lists the closest sections", async () => {
    await type("what is the default bodyLimit");
    expect(answerBox().querySelector("pre")!.textContent).toBe("Default: `1048576` (1MiB)");
    expect(answerBox().querySelector(".cite")!.textContent).toBe("reference/limits.md:5  Limits > bodyLimit");
    expect(options()[0].textContent).toContain("Limits > bodyLimit");
    expect(options()[0].querySelector("small")!.textContent).toBe("reference/limits.md:3");
  });

  it("says so when it isn't sure, and still lists sections", async () => {
    await type("what is the default");
    expect(answerBox().querySelector("pre")).toBeNull();
    expect(answerBox().textContent).toMatch(/No confident answer|Did you mean/);
    expect(options().length).toBeGreaterThan(0);
  });

  it("asks nothing for one letter", async () => {
    input().value = "b";
    input().dispatchEvent(new Event("input"));
    await new Promise((r) => setTimeout(r, 20));
    expect(el.shadowRoot.querySelector(".panel").hidden).toBe(true);
  });

  it("takes top for how many sections to list", async () => {
    el.setAttribute("top", "1");
    await type("what is the default bodyLimit");
    expect(options()).toHaveLength(1);
  });
});

describe("keyboard", () => {
  it('focuses on "/" and on Cmd or Ctrl+K', () => {
    key(document.body, { key: "/" });
    expect(el.shadowRoot.activeElement).toBe(input());
    input().blur();
    key(document.body, { key: "k", ctrlKey: true });
    expect(el.shadowRoot.activeElement).toBe(input());
  });

  it('leaves "/" alone while someone is typing in another field', () => {
    document.body.insertAdjacentHTML("beforeend", '<input id="other">');
    const other = document.getElementById("other")!;
    other.focus();
    key(other, { key: "/" });
    expect(el.shadowRoot.activeElement).toBeNull();
  });

  it("moves through the options with the arrows and marks the active one", async () => {
    await type("what is the default bodyLimit");
    expect(input().getAttribute("aria-activedescendant")).toBeNull();
    key(input(), { key: "ArrowDown" });
    expect(input().getAttribute("aria-activedescendant")).toBe("opt-0");
    expect(options()[0].getAttribute("aria-selected")).toBe("true");
    key(input(), { key: "ArrowUp" });
    expect(input().getAttribute("aria-activedescendant")).toBe(`opt-${options().length - 1}`); // wraps
  });

  it("closes the panel on Escape", async () => {
    await type("what is the default bodyLimit");
    key(input(), { key: "Escape" });
    expect(el.shadowRoot.querySelector(".panel").hidden).toBe(true);
    expect(input().getAttribute("aria-expanded")).toBe("false");
  });

  it("fires docs-ask:select on Enter, with the section as the detail", async () => {
    const seen: any[] = [];
    document.addEventListener("docs-ask:select", (e: any) => seen.push(e.detail));
    await type("what is the default bodyLimit");
    key(input(), { key: "ArrowDown" });
    key(input(), { key: "Enter" });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ id: "reference/limits.md#bodylimit", file: "reference/limits.md" });
  });
});

describe("base-url", () => {
  it("navigates to the file and heading slug", async () => {
    document.body.innerHTML = '<docs-ask index="/docs-index.json" base-url="/docs/"></docs-ask>';
    el = document.querySelector("docs-ask");
    await type("what is the default bodyLimit");
    key(input(), { key: "ArrowDown" });
    key(input(), { key: "Enter" });
    expect(location.href).toContain("/docs/reference/limits#bodylimit"); // .md dropped, slug from the section id
  });
});

describe("the combobox wiring", () => {
  it("keeps the input and the listbox in one shadow root, as ARIA needs", async () => {
    expect(input().getAttribute("role")).toBe("combobox");
    expect(input().getAttribute("aria-controls")).toBe("lb");
    expect(el.shadowRoot.getElementById("lb").getAttribute("role")).toBe("listbox");
    expect(input().getAttribute("aria-expanded")).toBe("false");
    await type("what is the default bodyLimit");
    expect(input().getAttribute("aria-expanded")).toBe("true");
    expect(options().every((o) => o.getAttribute("role") === "option")).toBe(true);
  });

  it("offers the parts a page can style", () => {
    const parts = [...el.shadowRoot.querySelectorAll("[part]")].map((n: any) => n.getAttribute("part"));
    expect(parts).toEqual(["input", "panel", "answer", "listbox"]);
  });

  it("takes its label from the label attribute", () => {
    document.body.innerHTML = '<docs-ask label="Ask Fastify"></docs-ask>';
    expect(document.querySelector("docs-ask")!.shadowRoot!.querySelector("input")!.getAttribute("aria-label")).toBe("Ask Fastify");
  });
});
