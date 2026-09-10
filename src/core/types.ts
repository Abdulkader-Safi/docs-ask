// Parser output types. Types only: safe to import anywhere, including the browser.
import type {AsPlainObject} from 'minisearch'

export type BlockType = 'paragraph' | 'code' | 'list' | 'table' | 'blockquote' | 'html'

export interface Block {
  type: BlockType
  /** Plain text. Soft line breaks kept as "\n" so line = startLine + newlines before offset. Inline code keeps backticks. */
  text: string
  startLine: number
  endLine: number
  lang?: string | null
  /** table only: rows[0] is the header row */
  rows?: string[][]
  /** table only: source line of each entry in rows */
  rowLines?: number[]
  /** list only: numbered list */
  ordered?: boolean
  /** list only: one entry per top-level item, with its own source line */
  items?: {text: string; line: number}[]
}

export interface Section {
  id: string
  file: string
  slug: string
  headingPath: string[]
  depth: number // 0 = intro (content before first heading)
  title: string
  parentId: string | null
  /** heading line (or first block line for intro) */
  startLine: number
  /** last line of this section's OWN content (stops at the next heading of any level) */
  endLine: number
  /** last line including child sections (stops at next heading of same or higher level) */
  subtreeEndLine: number
  blocks: Block[]
  /** own blocks joined, for indexing */
  text: string
}

export interface ParsedDoc {
  file: string
  frontmatter: Record<string, unknown>
  frontmatterError?: string
  sections: Section[]
}

export interface ParseOptions {
  /** Blank out MDX import/export lines and {expressions}. Default: true when file ends in .mdx */
  mdx?: boolean
}

// ---------- answer units (the QA layer) ----------
// Different from Block and Section above: a Unit is one quotable piece of a section, and
// QaSection.headingPath holds the ancestors only (the section's own heading is in `heading`).

export type UnitKind = 'code' | 'orderedList' | 'list' | 'tableRow' | 'sentence' | 'heading' | 'blockquote'

/** One answer unit: a sentence, list item, table row, code block, blockquote or heading. */
export interface Unit {
  kind: UnitKind
  text: string
  line: number
  lang?: string
}

export interface QaSection {
  id: string
  file: string
  /** this section's heading, backticks removed; the file path for the intro section */
  heading: string
  /** ancestors only, NOT including `heading` */
  headingPath: string[]
  line: number
  units: Unit[]
  /** non-code, non-heading units joined, for the index */
  prose: string
  /** code units joined, for the index */
  code: string
}

// ---------- answers ----------

export type QClass =
  | 'ERROR' | 'COMPARISON' | 'PARAMS' | 'ENDPOINT' | 'VALUE' | 'EXAMPLE'
  | 'LOCATION' | 'HOWTO' | 'YESNO' | 'DEFINITION' | 'FALLBACK'

export interface Candidate {
  id: string
  file: string
  line: number
  /** ancestors plus the section's own heading */
  headingPath: string[]
  score: number
}

/** What ask() returns (PRD section 5). The same object feeds every surface. */
export interface Answer {
  confident: boolean
  /** high: coverage and gap both clear their WEIGHTS.gates thresholds */
  level?: 'high' | 'medium'
  qclass: QClass
  /** why it answered ("gap 89%, coverage 1.00") or why it didn't */
  reason: string
  id?: string
  /** repo-relative, forward slashes */
  file?: string
  /** line of the first quoted unit (the section heading when nothing is quoted) */
  line?: number
  /** line of the last quoted unit */
  endLine?: number
  headingPath?: string[]
  /** markdown of the quoted units, code fenced */
  text?: string
  units?: Unit[]
  /** the closest sections, always present */
  candidates: Candidate[]
  /** near spellings when an identifier was unknown (from M4) */
  suggestions?: string[]
}

// ---------- index file ----------

/** strict: rewritten at index and query time (true synonyms). loose: added to the query only. */
export interface SynonymGroup {
  canonical: string
  aliases: string[]
  strict: boolean
}

/** What `docs-ask build` writes and `loadIndex` reads (PRD section 5). */
export interface SerializedIndex {
  formatVersion: number
  /** loadIndex refuses a different major.minor */
  packageVersion: string
  /** ISO date */
  builtAt: string
  /** sections with their answer units; no raw markdown */
  sections: QaSection[]
  /** document frequency per term, for IDF */
  df: Record<string, number>
  /** MiniSearch toJSON() */
  mini: AsPlainObject
  /** the synonym groups the index was built with, so query time matches build time */
  config: { synonyms: SynonymGroup[] }
}
