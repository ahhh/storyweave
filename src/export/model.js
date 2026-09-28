// Normalised export model built from ProseMirror JSON — never from rendered HTML.
import { yXmlFragmentToProsemirrorJSON } from 'y-prosemirror'
import { S, roster, answeredIngredients } from '../collaboration/doc.js'
import { buildBible } from '../story-engine/bible.js'

// ExportBlock:
//   { type: 'paragraph'|'heading'|'quote'|'hr'|'bullet'|'number', level?, runs: [{text, bold, italic}] }

function runsOf(node) {
  const runs = []
  for (const child of node.content || []) {
    if (child.type === 'text') {
      const marks = (child.marks || []).map(m => m.type)
      runs.push({ text: String(child.text || ''), bold: marks.includes('strong'), italic: marks.includes('em') })
    } else if (child.type === 'hard_break') {
      runs.push({ text: '\n', bold: false, italic: false })
    }
  }
  return runs
}

function walk(nodes, out, ctx = {}) {
  for (const node of nodes || []) {
    switch (node.type) {
      case 'paragraph':
        out.push({ type: ctx.list || (ctx.quote ? 'quote' : 'paragraph'), runs: runsOf(node) })
        break
      case 'heading':
        out.push({ type: 'heading', level: Math.min(3, Math.max(1, Number(node.attrs?.level) || 2)), runs: runsOf(node) })
        break
      case 'blockquote':
        walk(node.content, out, { ...ctx, quote: true })
        break
      case 'horizontal_rule':
        out.push({ type: 'hr', runs: [] })
        break
      case 'bullet_list':
      case 'ordered_list':
        for (const item of node.content || []) walk(item.content, out, { ...ctx, list: node.type === 'bullet_list' ? 'bullet' : 'number' })
        break
      default:
        if (node.content) walk(node.content, out, ctx)
    }
  }
}

export const plainText = runs => runs.map(r => r.text).join('')

export function buildExportStory(doc, { plotLineName = '', seed = '', include = {}, outlineText = '' } = {}) {
  const s = S(doc)
  const json = yXmlFragmentToProsemirrorJSON(s.story)
  const blocks = []
  walk(json.content, blocks)
  const nonEmpty = blocks.filter(b => b.type === 'hr' || plainText(b.runs).trim())

  // split into sections at level-1/2 headings
  const sections = []
  let cur = { heading: '', blocks: [] }
  for (const b of nonEmpty) {
    if (b.type === 'heading' && b.level <= 2) {
      if (cur.heading || cur.blocks.length) sections.push(cur)
      cur = { heading: plainText(b.runs).trim(), blocks: [] }
    } else cur.blocks.push(b)
  }
  if (cur.heading || cur.blocks.length) sections.push(cur)

  const appendix = []
  if (include.outline && outlineText) {
    appendix.push({ heading: 'Plot outline', blocks: outlineText.split('\n').filter(Boolean).map(t => ({ type: 'paragraph', runs: [{ text: t }] })) })
  }
  if (include.bible) {
    const bible = buildBible(answeredIngredients(doc)).filter(sec => sec.entries.length)
    const bl = []
    for (const sec of bible) {
      bl.push({ type: 'heading', level: 3, runs: [{ text: sec.name }] })
      for (const e of sec.entries) bl.push({ type: 'bullet', runs: [{ text: e.answer }] })
    }
    if (bl.length) appendix.push({ heading: 'Story bible', blocks: bl })
  }
  if (include.prompts) {
    const bl = []
    for (const i of answeredIngredients(doc)) {
      bl.push({ type: 'paragraph', runs: [{ text: i.question, bold: true }] })
      bl.push({ type: 'quote', runs: [{ text: i.answer }] })
    }
    if (bl.length) appendix.push({ heading: 'Prompt answers', blocks: bl })
  }
  if (include.notes) {
    const notes = s.notes.toString().trim()
    if (notes) appendix.push({ heading: 'Notes', blocks: notes.split(/\n{2,}/).map(t => ({ type: 'paragraph', runs: [{ text: t }] })) })
  }
  if (include.comments) {
    const bl = []
    s.comments.forEach(c => {
      if (c && !c.resolved && typeof c.body === 'string') bl.push({ type: 'bullet', runs: [{ text: `${c.quote ? `“${c.quote}” — ` : ''}${c.body}` }] })
    })
    if (bl.length) appendix.push({ heading: 'Open comments', blocks: bl })
  }

  return {
    title: s.title.toString().trim() || 'Untitled Story',
    premise: s.premise.toString().trim() || undefined,
    authors: include.authors ? roster(doc).map(p => p.displayName) : [],
    plotLineName,
    seed,
    sections: sections.concat(appendix),
  }
}
