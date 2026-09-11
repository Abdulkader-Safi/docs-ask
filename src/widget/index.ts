// <docs-ask index="/docs-index.json" base-url="/docs/">: the query side in a custom element,
// no framework and no dependencies beyond the bundled core (research.md section 17).
import { loadIndex, type Answer, type Candidate, type DocsIndex, type SerializedIndex } from "../core/index.ts";

/** Fetches and opens an index. A raw .json.gz served without Content-Encoding is inflated here. */
export async function fetchIndex(url: string): Promise<DocsIndex> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`docs-ask: ${res.status} loading ${url}`);
  const gz = url.endsWith(".gz") && !res.headers.get("content-encoding");
  const body = gz ? res.body!.pipeThrough(new DecompressionStream("gzip")) : res.body!;
  return loadIndex((await new Response(body).json()) as SerializedIndex);
}

const CSS = `:host{display:inline-block;position:relative;font:inherit;color:CanvasText}
input{font:inherit;padding:.4em .6em;min-width:16em;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:.3em}
.panel{position:absolute;z-index:10;left:0;right:0;min-width:24em;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:.3em;max-height:60vh;overflow:auto}
.panel[hidden]{display:none}
.answer{padding:.5em .6em;border-bottom:1px solid GrayText}
.answer pre{margin:.4em 0;white-space:pre-wrap;font:inherit}
.cite{display:block;opacity:.75;font-size:.85em}
.miss{padding:.5em .6em;opacity:.85}
ul{margin:0;padding:0;list-style:none}
li{padding:.4em .6em;cursor:pointer}
li[aria-selected=true]{background:Highlight;color:HighlightText}
li small{display:block;opacity:.75}
li[aria-selected=true] small{opacity:.9}`;

// SSR-safe: importing this in Node (Astro, Next) must not throw.
const Base = (globalThis.HTMLElement ?? (class {} as unknown)) as typeof HTMLElement;

export class DocsAskElement extends Base {
  #docs?: Promise<DocsIndex>;
  #answer?: Answer;
  #options: Candidate[] = [];
  #active = -1;
  #input!: HTMLInputElement;
  #panel!: HTMLElement;
  #answerBox!: HTMLElement;
  #list!: HTMLUListElement;

  connectedCallback(): void {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open" });
    // input and listbox share one shadow root: ARIA id references don't cross shadow boundaries
    root.innerHTML = `<style>${CSS}</style>
      <input part="input" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false"
        aria-controls="lb" aria-label="${this.getAttribute("label") ?? "Search docs"}" placeholder="Ask the docs (/)">
      <div class="panel" part="panel" hidden>
        <div class="answer" part="answer" hidden></div>
        <ul part="listbox" id="lb" role="listbox"></ul>
      </div>`;
    this.#input = root.querySelector("input")!;
    this.#panel = root.querySelector(".panel")!;
    this.#answerBox = root.querySelector(".answer")!;
    this.#list = root.querySelector("ul")!;
    this.#input.addEventListener("focus", () => void this.load(), { once: true }); // lazy: nothing is fetched until then
    this.#input.addEventListener("input", () => void this.search());
    this.#input.addEventListener("keydown", (e) => this.onKey(e));
    this.#list.addEventListener("mousedown", (e) => {
      const li = (e.target as Element).closest("li");
      if (li) {
        e.preventDefault(); // keep focus in the input
        this.pick(Number(li.dataset.i));
      }
    });
    document.addEventListener("keydown", this.#globalKey);
  }

  disconnectedCallback(): void {
    document.removeEventListener("keydown", this.#globalKey);
  }

  /** "/" anywhere but a field, and Cmd or Ctrl+K anywhere, focus the input. */
  #globalKey = (e: KeyboardEvent): void => {
    const typing = (e.target as HTMLElement)?.closest?.("input,textarea,[contenteditable]");
    if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      this.#input.focus();
    }
  };

  /** The index, fetched once. */
  load(): Promise<DocsIndex> {
    return (this.#docs ??= fetchIndex(this.getAttribute("index") ?? "/docs-index.json"));
  }

  async search(): Promise<void> {
    const q = this.#input.value.trim();
    this.#answer = q.length < 2 ? undefined : (await this.load()).ask(q, { topK: Number(this.getAttribute("top") ?? 3) });
    this.#options = this.#answer?.candidates ?? [];
    this.#active = -1;
    this.render();
  }

  render(): void {
    const a = this.#answer;
    this.#panel.hidden = !a;
    this.#input.setAttribute("aria-expanded", String(Boolean(a)));
    this.#answerBox.hidden = !a?.confident;
    this.#answerBox.replaceChildren();
    if (a?.confident) {
      const quote = document.createElement("pre");
      quote.textContent = a.text ?? "";
      const cite = document.createElement("small");
      cite.className = "cite";
      cite.textContent = `${a.file}:${a.line}  ${a.headingPath?.join(" > ")}`;
      this.#answerBox.append(quote, cite);
    } else if (a) {
      const miss = document.createElement("div");
      miss.className = "miss";
      miss.textContent = a.suggestions?.length ? `Did you mean: ${a.suggestions.join(", ")}?` : "No confident answer. Closest sections:";
      this.#answerBox.hidden = false;
      this.#answerBox.append(miss);
    }
    this.#list.replaceChildren(
      ...this.#options.map((c, i) => {
        const li = document.createElement("li");
        li.id = `opt-${i}`;
        li.dataset.i = String(i);
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", String(i === this.#active));
        li.textContent = c.headingPath.join(" > ");
        const where = document.createElement("small");
        where.textContent = `${c.file}:${c.line}`;
        li.append(where);
        return li;
      }),
    );
    if (this.#active >= 0) this.#input.setAttribute("aria-activedescendant", `opt-${this.#active}`);
    else this.#input.removeAttribute("aria-activedescendant");
  }

  onKey(e: KeyboardEvent): void {
    const n = this.#options.length;
    if (e.key === "ArrowDown" && n) {
      e.preventDefault();
      this.#active = (this.#active + 1) % n;
      this.render();
    } else if (e.key === "ArrowUp" && n) {
      e.preventDefault();
      this.#active = (this.#active - 1 + n) % n;
      this.render();
    } else if (e.key === "Enter" && this.#active >= 0) {
      e.preventDefault();
      this.pick(this.#active);
    } else if (e.key === "Escape") {
      this.#answer = undefined;
      this.#options = [];
      this.#active = -1;
      this.render();
    }
  }

  /** Fires docs-ask:select, and navigates when base-url is set. */
  pick(i: number): void {
    const hit = this.#options[i];
    if (!hit) return;
    this.dispatchEvent(new CustomEvent("docs-ask:select", { detail: hit, bubbles: true, composed: true }));
    const base = this.getAttribute("base-url");
    if (base) location.href = `${base}${hit.file.replace(/\.mdx?$/, "")}#${hit.id.split("#")[1] ?? ""}`;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("docs-ask")) {
  customElements.define("docs-ask", DocsAskElement);
}
