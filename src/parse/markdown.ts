// Markdown source -> flat heading sections with exact line ranges, built on markdown-it tokens.
// token.map = [startLine 0-based, endLine exclusive]; endLine is trimmed of trailing blank lines below.
import MarkdownIt from 'markdown-it'
import type {Token} from 'markdown-it'
import GithubSlugger from 'github-slugger'
import {load as parseYaml} from 'js-yaml'
import type {Block, Section, ParsedDoc, ParseOptions} from '../core/types.ts'

const md = new MarkdownIt({html: true}) // default preset: tables + strikethrough on, linkify off

export function parseMarkdown(filePath: string, source: string, options: ParseOptions = {}): Section[] {
  return parseDocument(filePath, source, options).sections
}

export function parseDocument(filePath: string, source: string, options: ParseOptions = {}): ParsedDoc {
  const file = filePath.replace(/\\/g, '/').replace(/^\.\//, '')
  let src = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source // markdown-it does NOT strip BOM
  const doc: ParsedDoc = {file, frontmatter: {}, sections: []}
  // Frontmatter: blank it with the same number of newlines so token.map stays true to the file.
  const fm = /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(src)
  if (fm) {
    try {
      const data = parseYaml(fm[1])
      if (data && typeof data === 'object' && !Array.isArray(data)) doc.frontmatter = data as Record<string, unknown>
    } catch (e) { doc.frontmatterError = (e as Error).message }
    src = fm[0].replace(/[^\r\n]/g, '') + src.slice(fm[0].length)
  }
  if (options.mdx ?? /\.mdx$/i.test(file)) src = blankMdxSyntax(src)
  src = blankContainerMarkers(src)
  const lines = src.split(/\r\n|\r|\n/)
  const lastLine = (map: [number, number]) => { let e = map[1]; while (e > map[0] + 1 && !lines[e - 1]?.trim()) e--; return e }

  const tokens = md.parse(src, {})
  const slugger = new GithubSlugger()
  const stack: Section[] = []
  let current: Section | null = null

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.level !== 0 || t.nesting === -1 || !t.map) continue
    const close = t.nesting === 1 ? findClose(tokens, i) : i
    if (t.type === 'heading_open') {
      const depth = Number(t.tag.slice(1))
      const title = inlineText(tokens[i + 1]).replace(/\s+/g, ' ').trim()
      while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
      const parent = stack[stack.length - 1] ?? null
      const slug = slugger.slug(title) || slugger.slug(`section-${t.map[0] + 1}`)
      current = {id: `${file}#${slug}`, file, slug, headingPath: [...(parent?.headingPath ?? []), title], depth, title,
        parentId: parent?.id ?? null, startLine: t.map[0] + 1, endLine: lastLine(t.map), subtreeEndLine: lastLine(t.map), blocks: [], text: ''}
      stack.push(current); doc.sections.push(current)
    } else {
      const block = toBlock(tokens, i, close, lastLine)
      if (block) {
        if (!current) {
          const title = typeof doc.frontmatter.title === 'string' ? doc.frontmatter.title : file.split('/').pop()!
          current = {id: file, file, slug: '', headingPath: [], depth: 0, title, parentId: null,
            startLine: block.startLine, endLine: block.endLine, subtreeEndLine: block.endLine, blocks: [], text: ''}
          doc.sections.push(current)
        }
        current.blocks.push(block)
        current.endLine = Math.max(current.endLine, block.endLine)
      }
    }
    i = close
  }
  const byId = new Map(doc.sections.map((s) => [s.id, s]))
  for (const s of doc.sections) { s.text = s.blocks.map((b) => b.text).join('\n\n'); s.subtreeEndLine = Math.max(s.subtreeEndLine, s.endLine) }
  for (let i = doc.sections.length - 1; i >= 0; i--) {
    const s = doc.sections[i]; const p = s.parentId ? byId.get(s.parentId) : undefined
    if (p) p.subtreeEndLine = Math.max(p.subtreeEndLine, s.subtreeEndLine)
  }
  return doc
}

function findClose(tokens: Token[], open: number): number {
  let depth = 0
  for (let j = open; j < tokens.length; j++) { depth += tokens[j].nesting; if (depth === 0) return j }
  return tokens.length - 1
}

function toBlock(tokens: Token[], i: number, close: number, lastLine: (m: [number, number]) => number): Block | null {
  const t = tokens[i]
  const startLine = t.map![0] + 1, endLine = lastLine(t.map!)
  switch (t.type) {
    case 'paragraph_open': return {type: 'paragraph', text: inlineText(tokens[i + 1]).trim(), startLine, endLine}
    case 'fence': return {type: 'code', text: t.content.replace(/\n$/, ''), lang: t.info.trim().split(/\s+/)[0] || null, startLine, endLine}
    case 'code_block': return {type: 'code', text: t.content.replace(/\n$/, ''), lang: null, startLine, endLine}
    case 'html_block': { const text = t.content.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').trim(); return text ? {type: 'html', text, startLine, endLine} : null }
    case 'bullet_list_open': case 'ordered_list_open': {
      // one entry per top-level item, with its own source line, so answers can cite a single item
      const items: {text: string; line: number}[] = []
      for (let j = i + 1; j < close; j++) {
        if (tokens[j].type !== 'list_item_open' || tokens[j].level !== t.level + 1) continue
        const itemClose = findClose(tokens, j)
        const text = listText([t, ...tokens.slice(j, itemClose + 1), tokens[close]], 0, itemClose - j + 2, 0).replace(/^(?:-|\d+\.) /, '')
        items.push({text, line: tokens[j].map![0] + 1})
        j = itemClose
      }
      return {type: 'list', text: listText(tokens, i, close, 0), ordered: t.type === 'ordered_list_open', items, startLine, endLine}
    }
    case 'blockquote_open': {
      const parts: string[] = []
      for (let j = i + 1; j < close; j++) if (tokens[j].type === 'inline') parts.push(inlineText(tokens[j]).trim())
      return {type: 'blockquote', text: parts.join('\n'), startLine, endLine}
    }
    case 'table_open': {
      const rows: string[][] = [], rowLines: number[] = []
      for (let j = i; j < close; j++) {
        if (tokens[j].type === 'tr_open') { rows.push([]); rowLines.push(tokens[j].map![0] + 1) }
        if (tokens[j].type === 'inline') rows[rows.length - 1].push(inlineText(tokens[j]).trim())
      }
      const [header, ...body] = rows
      const text = body.map((r) => r.map((c, k) => `${header[k] ?? `col${k + 1}`}: ${c}`).join('; ')).join('\n')
      return {type: 'table', text, rows, rowLines, startLine, endLine}
    }
    default: return null
  }
}

function listText(tokens: Token[], open: number, close: number, indent: number): string {
  const out: string[] = []
  let n = Number(tokens[open].attrGet('start') ?? 1)
  for (let j = open + 1; j < close; j++) {
    const t = tokens[j]
    if (t.type !== 'list_item_open') continue
    const itemClose = findClose(tokens, j)
    const bullet = tokens[open].type === 'ordered_list_open' ? `${n++}.` : '-'
    const parts: string[] = []
    for (let k = j + 1; k < itemClose; k++) {
      const c = tokens[k]
      if (c.type === 'bullet_list_open' || c.type === 'ordered_list_open') { const e = findClose(tokens, k); parts.push('\n' + listText(tokens, k, e, indent + 1)); k = e }
      else if (c.type === 'inline') parts.push(inlineText(c).replace(/\n/g, ' '))
      else if (c.type === 'fence' || c.type === 'code_block') parts.push('\n' + c.content.replace(/\n$/, ''))
    }
    out.push(`${'  '.repeat(indent)}${bullet} ${parts.join(' ').replace(/ \n/g, '\n')}`)
    j = itemClose
  }
  return out.join('\n')
}

function inlineText(t: Token | undefined): string {
  let s = ''
  for (const c of t?.children ?? []) {
    if (c.type === 'text') s += c.content
    else if (c.type === 'code_inline') s += '`' + c.content + '`'
    else if (c.type === 'softbreak' || c.type === 'hardbreak') s += '\n'
    else if (c.type === 'image') s += c.content
  }
  return s
}


/**
 * Cheap MDX tolerance without an MDX parser: blank (not delete) ESM lines and {expressions}
 * so every line number stays identical. JSX tags on their own line already parse as html blocks.
 */
export function blankMdxSyntax(src: string): string {
  const lines = src.split(/\r?\n|\r/)
  let fence: string | null = null
  let inEsm = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (f) { if (!fence) fence = f[1][0]; else if (line.trim().startsWith(fence)) fence = null; continue }
    if (fence) continue
    if (inEsm || /^(import|export)\s/.test(line)) {
      // MDX rule: an ESM block starts with import/export at column 0 and runs until a blank line
      inEsm = line.trim() !== ''
      lines[i] = ''
      continue
    }
    lines[i] = line.replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => ' '.repeat(m.length))
  }
  return lines.join('\n')
}

/**
 * VitePress and Docusaurus admonitions (`::: tip`, `:::warning Title`, `::: code-group`, the closing `:::`):
 * blank the marker lines so they don't become sentences of their own or glue onto the text after them.
 * The content inside stays. Blanked, not deleted, so line numbers stay true. Code fences are left alone.
 */
export function blankContainerMarkers(src: string): string {
  const lines = src.split(/\r?\n|\r/)
  let fence: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i])
    if (f) { if (!fence) fence = f[1][0]; else if (lines[i].trim().startsWith(fence)) fence = null; continue }
    if (!fence && /^\s*:{3,}/.test(lines[i])) lines[i] = ''
  }
  return lines.join('\n')
}
