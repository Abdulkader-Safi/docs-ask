// Sentence splitting on Intl.Segmenter (regex fallback without Intl) with a same-length "protect" pass so offsets and line numbers survive.
export interface Sentence {
  text: string
  /** char offset in the input */
  start: number
  /** 0-based count of "\n" before start: add to block.startLine */
  lineOffset: number
}

// Abbreviations that almost never end an English sentence. Case-sensitive on purpose: "Ms." yes, "500 ms." no.
// "etc." deliberately left out (it often ends a sentence).
const ABBREV = /\b(?:[eE]\.g|[iI]\.e|vs|cf|approx|incl|Dr|Mr|Mrs|Ms|Prof)\.(?=\s)/g
const INLINE_CODE = /(`+)[\s\S]*?\1/g
const URL_RE = /\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g

let segmenter: Intl.Segmenter | null = null

function segments(masked: string): Iterable<{segment: string; index: number}> {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    segmenter ??= new Intl.Segmenter('en', {granularity: 'sentence'})
    return segmenter.segment(masked)
  }
  return regexSegments(masked)
}

// ponytail: fallback for a Node built --without-intl. Breaks after . ! ? (plus closing quotes or brackets) and
// whitespace when the next character isn't lower case, which is the case UAX #29 handles for English. It misses
// rarer rules (ellipses, CJK), which is fine for a build that has no Intl at all.
function* regexSegments(masked: string): Generator<{segment: string; index: number}> {
  let index = 0
  for (const m of masked.matchAll(/[.!?]+['")\]]*\s+(?=[^\sa-z])/g)) {
    const end = m.index + m[0].length
    yield {segment: masked.slice(index, end), index}
    index = end
  }
  if (index < masked.length) yield {segment: masked.slice(index), index}
}

export function splitSentences(text: string): Sentence[] {
  // 1. Mask: inside protected spans turn . ! ? and whitespace into "_" (same length, so indices stay valid).
  let masked = text
  const mask = (re: RegExp) => {
    masked = masked.replace(re, (m) => m.replace(/[.!?\s]/g, '_'))
  }
  mask(INLINE_CODE)
  mask(URL_RE)
  mask(ABBREV)
  // 2. Soft line breaks are hard sentence breaks in UAX #29 (LF = ParaSep). Treat them as spaces.
  masked = masked.replace(/\n/g, ' ')

  const out: Sentence[] = []
  for (const seg of segments(masked)) {
    // 3. Slice the ORIGINAL text by index: masking is undone for free.
    const raw = text.slice(seg.index, seg.index + seg.segment.length)
    const trimmed = raw.trim()
    if (!trimmed) continue
    const start = seg.index + (raw.length - raw.trimStart().length)
    out.push({text: trimmed.replace(/\s*\n\s*/g, ' '), start, lineOffset: countNewlines(text, start)})
  }
  return out
}

function countNewlines(s: string, end: number): number {
  let n = 0
  for (let i = 0; i < end; i++) if (s.charCodeAt(i) === 10) n++
  return n
}
