// Deliberately small rich-text schema. Pasted HTML is parsed through this schema,
// so unsupported nodes, attributes, scripts, links, and embeds are dropped.
import { Schema } from 'prosemirror-model'
import { nodes as basicNodes, marks as basicMarks } from 'prosemirror-schema-basic'
import { addListNodes } from 'prosemirror-schema-list'
import OrderedMap from 'orderedmap'

const intAttr = (el, name) => {
  const n = parseInt(el.getAttribute(name) || '', 10)
  return Number.isFinite(n) && n >= 0 && n < 1e6 ? n : null
}
const idAttr = (el, name) => {
  const v = el.getAttribute(name)
  return v && /^[\w-]{1,40}$/.test(v) ? v : null
}

// Contribution metadata on paragraphs. Advisory only — not verified authorship.
const paragraph = {
  content: 'inline*',
  group: 'block',
  attrs: { author: { default: null }, turn: { default: null }, beat: { default: null }, created: { default: null } },
  parseDOM: [{
    tag: 'p',
    getAttrs: el => ({ author: idAttr(el, 'data-author'), turn: intAttr(el, 'data-turn'), beat: intAttr(el, 'data-beat'), created: null }),
  }],
  toDOM: node => {
    const a = {}
    if (node.attrs.author) a['data-author'] = node.attrs.author
    if (node.attrs.turn != null) a['data-turn'] = String(node.attrs.turn)
    if (node.attrs.beat != null) a['data-beat'] = String(node.attrs.beat)
    return ['p', a, 0]
  },
}

const heading = {
  attrs: { level: { default: 2 }, beat: { default: null } },
  content: 'inline*',
  group: 'block',
  defining: true,
  parseDOM: [1, 2, 3].map(level => ({ tag: 'h' + level, getAttrs: el => ({ level, beat: intAttr(el, 'data-beat') }) })),
  toDOM: node => ['h' + Math.min(3, Math.max(1, node.attrs.level)), node.attrs.beat != null ? { 'data-beat': String(node.attrs.beat) } : {}, 0],
}

let nodes = OrderedMap.from({
  doc: basicNodes.doc,
  paragraph,
  blockquote: basicNodes.blockquote,
  horizontal_rule: basicNodes.horizontal_rule,
  heading,
  text: basicNodes.text,
  hard_break: basicNodes.hard_break,
})
nodes = addListNodes(nodes, 'paragraph block*', 'block')

export const schema = new Schema({
  nodes,
  marks: { em: basicMarks.em, strong: basicMarks.strong },
})
