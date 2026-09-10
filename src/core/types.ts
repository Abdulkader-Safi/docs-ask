// Parser output types. Types only: safe to import anywhere, including the browser.

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
