// "docs-ask/mcp": the MCP tools over one loaded index (research.md section 16).
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { quote, VERSION, type Answer, type DocsIndex } from "../core/index.ts";

/** research.md section 16: Claude Code cuts tool output at 25,000 tokens and warns over 10,000. */
const MAX_SECTION_CHARS = 8000;

const Citation = z.object({
  id: z.string(),
  file: z.string(),
  line: z.number().int(),
  headingPath: z.array(z.string()),
});

const AskOutput = z.object({
  answered: z.boolean(),
  /** why it answered ("gap 89%, coverage 1.00") or why it didn't */
  reason: z.string(),
  qclass: z.string(),
  answer: Citation.extend({ endLine: z.number().int(), text: z.string(), level: z.string() }).optional(),
  /** comparison questions: one quote per side */
  parts: z.array(Citation.extend({ text: z.string() })).optional(),
  candidates: z.array(Citation),
  suggestions: z.array(z.string()).optional(),
});

const cite = (c: { id: string; file: string; line: number; headingPath: string[] }) => ({ id: c.id, file: c.file, line: c.line, headingPath: c.headingPath });

/** The structured half of ask_docs: the Answer without units or scores. */
function toOutput(a: Answer): z.infer<typeof AskOutput> {
  return {
    answered: a.confident,
    reason: a.reason,
    qclass: a.qclass,
    ...(a.confident && a.id ? { answer: { ...cite(a as Required<Answer>), endLine: a.endLine!, text: a.text ?? "", level: a.level ?? "medium" } } : {}),
    ...(a.parts ? { parts: a.parts.map((p) => ({ ...cite(p), text: p.text })) } : {}),
    candidates: a.candidates.map(cite),
    ...(a.suggestions ? { suggestions: a.suggestions } : {}),
  };
}

/** The text half: what a model reads. Citations first, then the quote, then where else to look. */
function toText(a: Answer): string {
  const where = (c: { file: string; line: number; headingPath: string[]; id: string }) => `${c.file}:${c.line}  ${c.headingPath.join(" > ")}  [${c.id}]`;
  const closest = a.candidates.length ? ["", "Closest sections, call get_section for the full text:", ...a.candidates.map((c) => `- ${where(c)}`)] : [];
  if (a.parts?.length) return [...a.parts.map((p) => `${where(p)}\n${p.text}`), ...closest].join("\n");
  if (!a.confident) {
    const spellings = a.suggestions?.length ? [`Did you mean: ${a.suggestions.join(", ")}?`] : [];
    return [`No confident answer (${a.reason}).`, ...spellings, ...closest].join("\n");
  }
  const others = a.candidates.filter((c) => c.id !== a.id);
  return [where(a as Required<Answer>), a.text ?? "", ...(others.length ? ["", "Also:", ...others.map((c) => `- ${where(c)}`)] : [])].join("\n");
}

/** Side-effect free factory, exported as "docs-ask/mcp" so others can embed the tools. */
export function createDocsMcpServer(docs: DocsIndex): McpServer {
  const server = new McpServer(
    { name: "docs-ask", version: VERSION },
    {
      instructions:
        "Answers questions about this repository's markdown documentation and quotes the sentence, list item, table row or code block that answers, with file:line. Search here before reading docs files by hand. ask_docs takes a plain question; get_section returns the full text of any section id it cites. It abstains rather than guess, and then lists the closest sections.",
    },
  );

  const readOnly = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };

  server.registerTool(
    "ask_docs",
    {
      title: "Ask the repo docs",
      description:
        'Ask this repo\'s markdown docs a question in plain words, e.g. "what is the default bodyLimit?". Returns the quoted answer with "file:line heading path [id]", then the closest sections. When it is not sure it says so and returns candidates only: read those with get_section(id) rather than treating the abstention as "not documented".',
      inputSchema: z.object({
        question: z.string().min(2).describe('Question in plain words, e.g. "how do I refresh a token?"'),
        topK: z.number().int().min(1).max(10).default(3).describe("How many closest sections to return (default 3)"),
      }),
      outputSchema: AskOutput,
      annotations: readOnly,
    },
    async ({ question, topK }) => {
      const answer = docs.ask(question, { topK });
      return { content: [{ type: "text", text: toText(answer) }], structuredContent: toOutput(answer) };
    },
  );

  server.registerTool(
    "get_section",
    {
      title: "Get one doc section",
      description: `Full text of one doc section by the id ask_docs cites, cut at ${MAX_SECTION_CHARS} characters. Ids come from ask_docs; nothing else is a valid id.`,
      inputSchema: z.object({ id: z.string().describe("Section id from ask_docs, e.g. Reference/Server.md#bodylimit") }),
      annotations: readOnly,
    },
    async ({ id }) => {
      const s = docs.get(id);
      if (!s) return { isError: true, content: [{ type: "text" as const, text: `Unknown id "${id}". Call ask_docs first to get valid ids.` }] };
      const body = quote(s.units);
      const cut = body.length > MAX_SECTION_CHARS ? `${body.slice(0, MAX_SECTION_CHARS)}\n... cut at ${MAX_SECTION_CHARS} characters` : body;
      return { content: [{ type: "text" as const, text: `${s.file}:${s.line}  ${[...s.headingPath, s.heading].join(" > ")}\n\n${cut}` }] };
    },
  );

  return server;
}
