// Filters typed into a question: `status:published`, `tag:seo`, `folder:Content`, `folder:"Beta Foods"` (M11).
// A word counts as a filter only when the index has a property by that name, or it is folder: or tag:. So
// `port:3000`, `12:30` and URLs stay part of the question, and docs without frontmatter are never filtered.
import type { QaSection } from "../core/types.ts";

export interface Filter {
  key: string;
  /** lower case */
  value: string;
}

/** What a note says about itself: its properties (lower case) and tags. */
export interface NoteFacts {
  props: Map<string, string>;
  tags: Set<string>;
}

const INLINE_TAG = /(?:^|\s)#([\p{L}_][\p{L}\p{N}_/-]*)/gu;
const FILTER = /(?<=^|\s)([\p{L}_][\p{L}\p{N}_-]*):(?:"([^"]*)"|([^\s"]+))(?=\s|$)/gu;

/** Each note's properties and tags, read from its note card and the #tags in its text. */
export function noteFacts(sections: QaSection[]): { notes: Map<string, NoteFacts>; keys: Set<string> } {
  const notes = new Map<string, NoteFacts>();
  const keys = new Set(["folder", "tag"]);
  for (const s of sections) {
    let n = notes.get(s.file);
    if (!n) notes.set(s.file, (n = { props: new Map(), tags: new Set() }));
    for (const u of s.units) {
      if (u.kind === "property") {
        const at = u.text.indexOf(": ");
        const key = u.text.slice(0, at).toLowerCase();
        const value = u.text.slice(at + 2).toLowerCase();
        n.props.set(key, value);
        keys.add(key);
        if (key === "tags" || key === "tag") for (const t of value.split(", ")) n.tags.add(t.replace(/^#/, ""));
      } else if (u.kind !== "code") {
        for (const m of u.text.matchAll(INLINE_TAG)) n.tags.add(m[1].toLowerCase());
      }
    }
  }
  return { notes, keys };
}

/** Takes the filters out of a question and returns what is left of it. */
export function parseFilters(question: string, keys: Set<string>): { question: string; filters: Filter[] } {
  const filters: Filter[] = [];
  const rest = question.replace(FILTER, (whole, key: string, quoted?: string, bare?: string) => {
    const value = (quoted ?? bare?.replace(/[?.,!;]+$/, "") ?? "").trim().toLowerCase();
    if (!keys.has(key.toLowerCase()) || !value || value.startsWith("/")) return whole;
    filters.push({ key: key.toLowerCase(), value });
    return " ";
  });
  return { question: filters.length ? rest.replace(/\s+/g, " ").trim() : question, filters };
}

/** The files that pass every filter. */
export function matchingFiles(notes: Map<string, NoteFacts>, filters: Filter[]): Set<string> {
  const out = new Set<string>();
  for (const [file, n] of notes) if (filters.every((f) => passes(file, n, f))) out.add(file);
  return out;
}

function passes(file: string, n: NoteFacts, { key, value }: Filter): boolean {
  if (key === "folder") {
    // one folder anywhere in the path ("blogs"), or a path from the root ("content/blogs")
    const dirs = file.toLowerCase().split("/").slice(0, -1);
    return dirs.includes(value) || `${dirs.join("/")}/`.startsWith(`${value.replace(/\/$/, "")}/`);
  }
  // a tag also matches its nested tags, as in Obsidian: tag:projects finds #projects/acme
  if (key === "tag") return [...n.tags].some((t) => t === value || t.startsWith(`${value}/`));
  const v = n.props.get(key);
  return v !== undefined && (v === value || v.split(", ").includes(value));
}

export const filterLabel = (filters: Filter[]) => filters.map((f) => `${f.key}:${/\s/.test(f.value) ? `"${f.value}"` : f.value}`).join(" ");
