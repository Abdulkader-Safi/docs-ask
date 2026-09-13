// Parsed sections -> answer units. Each unit keeps its own source line so an answer can cite
// one sentence, list item or table row (research.md section 5).
import type { ParsedDoc, QaSection, Section, Unit } from "../core/types.ts";
import { cleanLinks } from "./markdown.ts";
import { splitSentences } from "./sentences.ts";

export function toQaSections(doc: ParsedDoc): QaSection[] {
  const { file } = doc;
  const props = propertyUnits(doc);
  const title = typeof doc.frontmatter.title === "string" && doc.frontmatter.title.trim() ? cleanLinks(doc.frontmatter.title.trim()) : file;
  // The note card: the intro section, headed by the title and opening with one unit per property. A note that
  // starts with a heading has no intro, so it gets an empty one at line 1 to hold its properties.
  const sections: Section[] =
    props.length && doc.sections[0]?.depth !== 0
      ? [{ id: file, file, slug: "", headingPath: [], depth: 0, title, parentId: null, startLine: 1, endLine: 1, subtreeEndLine: 1, blocks: [], text: "" }, ...doc.sections]
      : doc.sections;
  return sections
    .map((sec) => {
      const heading = sec.depth === 0 ? title : sec.title.replace(/`/g, "");
      const units: Unit[] = sec.depth === 0 ? [...props] : [{ kind: "heading", text: heading, line: sec.startLine }];
      for (const b of sec.blocks) {
        if (b.type === "paragraph" || b.type === "html") {
          for (const s of splitSentences(b.text)) units.push({ kind: "sentence", text: s.text, line: b.startLine + s.lineOffset });
        } else if (b.type === "code") units.push({ kind: "code", text: b.text, line: b.startLine, lang: b.lang ?? undefined });
        else if (b.type === "list")
          for (const it of b.items ?? []) units.push({ kind: b.ordered ? "orderedList" : "list", text: it.text, line: it.line });
        else if (b.type === "table") {
          const [hdr, ...rows] = b.rows ?? [];
          rows.forEach((r, k) =>
            units.push({ kind: "tableRow", text: r.map((c, i) => `${hdr[i] ?? ""}: ${c}`).join(" | "), line: b.rowLines![k + 1] }),
          );
        } else if (b.type === "blockquote") units.push({ kind: "blockquote", text: b.text, line: b.startLine });
      }
      return {
        id: sec.id,
        file,
        heading,
        headingPath: sec.headingPath.slice(0, -1).map((h) => h.replace(/`/g, "")),
        line: sec.depth === 0 && props.length ? 1 : sec.startLine,
        units,
        prose: units.filter((u) => u.kind !== "code" && u.kind !== "heading").map((u) => u.text).join("\n"),
        code: units.filter((u) => u.kind === "code").map((u) => u.text).join("\n"),
      };
    })
    .filter((s) => s.units.length > 0);
}

/** One unit per frontmatter property, cited at the key's own line. `title` heads the note card instead. */
function propertyUnits(doc: ParsedDoc): Unit[] {
  const units: Unit[] = [];
  for (const [key, value] of Object.entries(doc.frontmatter)) {
    const line = doc.frontmatterLines?.get(key);
    const text = valueText(value);
    if (key !== "title" && line && text) units.push({ kind: "property", text: `${key}: ${text}`, line });
  }
  return units;
}

// ponytail: null and nested objects are skipped; flatten objects one level if a vault turns out to use them
const valueText = (v: unknown): string =>
  v instanceof Date ? v.toISOString().slice(0, 10)
  : Array.isArray(v) ? v.map(valueText).filter(Boolean).join(", ")
  : typeof v === "string" ? cleanLinks(v.trim())
  : typeof v === "number" || typeof v === "boolean" ? String(v)
  : "";
