// Parsed sections -> answer units. Each unit keeps its own source line so an answer can cite
// one sentence, list item or table row (research.md section 5).
import type { ParsedDoc, QaSection, Unit } from "../core/types.ts";
import { splitSentences } from "./sentences.ts";

export function toQaSections(doc: ParsedDoc): QaSection[] {
  const { file } = doc;
  return doc.sections
    .map((sec) => {
      const heading = sec.depth === 0 ? file : sec.title.replace(/`/g, "");
      const units: Unit[] = sec.depth === 0 ? [] : [{ kind: "heading", text: heading, line: sec.startLine }];
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
        line: sec.startLine,
        units,
        prose: units.filter((u) => u.kind !== "code" && u.kind !== "heading").map((u) => u.text).join("\n"),
        code: units.filter((u) => u.kind === "code").map((u) => u.text).join("\n"),
      };
    })
    .filter((s) => s.units.length > 0);
}
