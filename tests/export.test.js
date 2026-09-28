import { describe, it, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { toDocx, xmlEscape } from '../src/export/docx.js'
import { toTxt, toMarkdown } from '../src/export/text.js'
import { countSentences } from '../src/editor/editor.js'

const hostile = `<script>alert(1)</script> & <img src=x onerror=alert(1)> "quotes" 'apos' 🦊 日本語 مرحبا`
const story = {
  title: 'Tales & <Things>', authors: ['Ana', 'Bo'], plotLineName: 'x', seed: 's', premise: hostile,
  sections: [{ heading: 'One', blocks: [
    { type: 'paragraph', runs: [{ text: hostile }, { text: ' bold', bold: true }, { text: ' it', italic: true }] },
    { type: 'hr', runs: [] },
    { type: 'bullet', runs: [{ text: 'item' }] },
    { type: 'quote', runs: [{ text: 'q\u0001uote' }] },
  ] }],
}

describe('exports', () => {
  it('docx is a valid package with escaped, round-trippable text', () => {
    const files = unzipSync(toDocx(story))
    for (const f of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml', 'docProps/app.xml']) {
      expect(files[f]).toBeTruthy()
    }
    const xml = strFromU8(files['word/document.xml'])
    expect(xml).not.toContain('<script>')
    expect(xml).not.toContain('\u0001')
    const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    expect(text).toContain(hostile)
    expect(text).toContain('Tales & <Things>')
  })
  it('xmlEscape leaves no raw markup characters', () => {
    expect(xmlEscape('<&>"\'')).toBe('&lt;&amp;&gt;&quot;&apos;')
  })
  it('txt and md preserve unicode and contain no metadata', () => {
    const txt = toTxt(story), md = toMarkdown(story)
    expect(txt).toContain('🦊 日本語 مرحبا')
    expect(md).toContain('🦊 日本語 مرحبا')
    expect(md.startsWith('# Tales & \\<Things\\>')).toBe(true)
    expect(md).toContain('**bold**')
    expect(md).not.toMatch(/data-author|clientID/)
  })
  it('sentence heuristic', () => {
    expect(countSentences('')).toBe(0)
    expect(countSentences('One. Two! Three?')).toBe(3)
    expect(countSentences('Mr. Smith went home. He slept.')).toBe(2)
    expect(countSentences('"Stop!" she said. Nobody did.')).toBe(2)
    expect(countSentences('no punctuation at all')).toBe(1)
  })
})
