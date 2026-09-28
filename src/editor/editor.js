import { EditorState, Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap, toggleMark, setBlockType, wrapIn, lift } from 'prosemirror-commands'
import { wrapInList, splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list'
import { inputRules, wrappingInputRule, textblockTypeInputRule, smartQuotes, emDash, ellipsis } from 'prosemirror-inputrules'
import {
  ySyncPlugin, yCursorPlugin, yUndoPlugin, undo, redo, ySyncPluginKey,
  absolutePositionToRelativePosition, relativePositionToAbsolutePosition,
} from 'y-prosemirror'
import * as Y from 'yjs'
import { schema } from './schema.js'
import { safeColor, cleanLabel } from '../util/dom.js'
import { LIMITS } from '../collaboration/doc.js'

export { schema }

// Remote cursor rendering — sanitises peer-supplied names and colours.
function cursorBuilder(user) {
  const color = safeColor(user?.color)
  const cursor = document.createElement('span')
  cursor.className = 'remote-caret'
  cursor.style.borderColor = color
  const label = document.createElement('span')
  label.className = 'remote-caret-label'
  label.style.backgroundColor = color
  label.textContent = cleanLabel(user?.name, 24) || 'Someone'
  cursor.append(document.createTextNode('⁠'), label, document.createTextNode('⁠'))
  return cursor
}

function selectionBuilder(user) {
  return { style: `background-color: ${safeColor(user?.color)}33`, class: 'remote-selection' }
}

const commentKey = new PluginKey('comments')

/** Highlights unresolved comment ranges using Yjs relative positions. */
function commentsPlugin(ydoc, fragment, commentsMap) {
  const compute = state => {
    const binding = ySyncPluginKey.getState(state)?.binding
    if (!binding) return DecorationSet.empty
    const decos = []
    commentsMap.forEach((c, id) => {
      if (!c || c.resolved || !c.anchorStart || !c.anchorEnd) return
      try {
        const from = relativePositionToAbsolutePosition(ydoc, fragment, Y.createRelativePositionFromJSON(c.anchorStart), binding.mapping)
        const to = relativePositionToAbsolutePosition(ydoc, fragment, Y.createRelativePositionFromJSON(c.anchorEnd), binding.mapping)
        if (from != null && to != null && to > from && to <= state.doc.content.size) {
          decos.push(Decoration.inline(from, to, { class: 'comment-mark', 'data-comment': id }))
        }
      } catch { /* malformed anchor from a peer — skip */ }
    })
    return DecorationSet.create(state.doc, decos)
  }
  return new Plugin({
    key: commentKey,
    state: {
      init: (_, state) => DecorationSet.empty,
      apply: (tr, old, _o, newState) => (tr.docChanged || tr.getMeta(commentKey) ? compute(newState) : old.map(tr.mapping, tr.doc)),
    },
    props: { decorations: state => commentKey.getState(state) },
  })
}

function buildInputRules() {
  return inputRules({
    rules: [
      ...smartQuotes, emDash, ellipsis,
      wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
      wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, m => ({ order: +m[1] }), (m, n) => n.childCount + n.attrs.order === +m[1]),
      wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
      textblockTypeInputRule(/^(#{1,3})\s$/, schema.nodes.heading, m => ({ level: m[1].length })),
    ],
  })
}

export function createEditor({ mount, ydoc, fragment, awareness, commentsMap, readOnly, onSelectionChange, onChange }) {
  const undoManager = new Y.UndoManager(fragment, { trackedOrigins: new Set([ySyncPluginKey]) })
  const listItem = schema.nodes.list_item

  const plugins = [
    ySyncPlugin(fragment),
    yCursorPlugin(awareness, { cursorBuilder, selectionBuilder }),
    yUndoPlugin({ undoManager }),
    commentsPlugin(ydoc, fragment, commentsMap),
    buildInputRules(),
    keymap({
      'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo,
      'Mod-b': toggleMark(schema.marks.strong), 'Mod-i': toggleMark(schema.marks.em),
      Enter: splitListItem(listItem), 'Mod-[': liftListItem(listItem), 'Mod-]': sinkListItem(listItem),
    }),
    keymap(baseKeymap),
    new Plugin({
      view: () => ({ update: (view, prev) => { if (!prev.selection.eq(view.state.selection)) onSelectionChange?.(view) } }),
    }),
  ]

  const view = new EditorView(mount, {
    state: EditorState.create({ schema, plugins }),
    editable: () => !readOnly,
    attributes: { class: 'prose', 'aria-label': 'Shared story editor', role: 'textbox', 'aria-multiline': 'true', spellcheck: 'true' },
    handlePaste: (_view, event) => {
      const text = event.clipboardData?.getData('text/plain') || ''
      const html = event.clipboardData?.getData('text/html') || ''
      if (text.length + html.length > LIMITS.pasteWarnBytes) {
        return !confirm('This paste is over 1 MB. Large pastes slow everyone down. Paste anyway?')
      }
      return false
    },
    dispatchTransaction(tr) {
      // `this` is the view; y-prosemirror may dispatch during construction
      this.updateState(this.state.apply(tr))
      if (tr.docChanged) onChange?.()
    },
  })

  commentsMap.observe(() => view.dispatch(view.state.tr.setMeta(commentKey, true)))

  const cmd = c => () => { c(view.state, view.dispatch, view); view.focus() }

  return {
    view,
    undoManager,
    commands: {
      bold: cmd(toggleMark(schema.marks.strong)),
      italic: cmd(toggleMark(schema.marks.em)),
      paragraph: cmd(setBlockType(schema.nodes.paragraph)),
      h2: cmd(setBlockType(schema.nodes.heading, { level: 2 })),
      h3: cmd(setBlockType(schema.nodes.heading, { level: 3 })),
      quote: cmd(wrapIn(schema.nodes.blockquote)),
      lift: cmd(lift),
      bullet: cmd(wrapInList(schema.nodes.bullet_list)),
      ordered: cmd(wrapInList(schema.nodes.ordered_list)),
      hr: cmd((state, dispatch) => { dispatch(state.tr.replaceSelectionWith(schema.nodes.horizontal_rule.create())); return true }),
      undo: cmd(undo),
      redo: cmd(redo),
    },

    /** Append a turn's passage as attributed paragraphs at the end of the story. */
    appendPassage(text, attrs) {
      const paras = text.split(/\n{2,}|\r\n\r\n/).map(s => s.trim()).filter(Boolean)
      if (!paras.length) return
      const nodes = paras.map(p => schema.nodes.paragraph.create(attrs, schema.text(p.replace(/\s*\n\s*/g, ' '))))
      const { state } = view
      let tr = state.tr
      const last = state.doc.lastChild
      const insertAt = state.doc.content.size
      // replace a single empty trailing paragraph instead of leaving a gap
      if (last && last.type === schema.nodes.paragraph && last.content.size === 0 && state.doc.childCount === 1) {
        tr = tr.replaceWith(0, insertAt, nodes)
      } else {
        tr = tr.insert(insertAt, nodes)
      }
      view.dispatch(tr.scrollIntoView())
    },

    insertBeatHeading(label, ordinal) {
      const { state } = view
      const node = schema.nodes.heading.create({ level: 2, beat: ordinal }, schema.text(label))
      view.dispatch(state.tr.insert(state.doc.content.size, node).scrollIntoView())
    },

    insertTextAtCursor(text) {
      const { state } = view
      const paras = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)
      if (paras.length <= 1) view.dispatch(state.tr.insertText(paras[0] || '', state.selection.from, state.selection.to))
      else view.dispatch(state.tr.replaceSelectionWith(schema.nodes.paragraph.create(null, schema.text(paras[0]))).insert(state.selection.to, paras.slice(1).map(p => schema.nodes.paragraph.create(null, schema.text(p)))))
      view.focus()
    },

    selectedText() {
      const { from, to } = view.state.selection
      return view.state.doc.textBetween(from, to, '\n\n')
    },

    currentParagraphText() {
      const $from = view.state.selection.$from
      return $from.parent.isTextblock ? $from.parent.textContent : ''
    },

    /** Relative anchors for the current selection, or null if collapsed. */
    selectionAnchors() {
      const { from, to } = view.state.selection
      if (from === to) return null
      const binding = ySyncPluginKey.getState(view.state)?.binding
      if (!binding) return null
      return {
        anchorStart: Y.relativePositionToJSON(absolutePositionToRelativePosition(from, fragment, binding.mapping)),
        anchorEnd: Y.relativePositionToJSON(absolutePositionToRelativePosition(to, fragment, binding.mapping)),
        quote: view.state.doc.textBetween(from, to, ' ').slice(0, 140),
      }
    },

    selectAnchors(c) {
      const binding = ySyncPluginKey.getState(view.state)?.binding
      if (!binding) return
      try {
        const from = relativePositionToAbsolutePosition(ydoc, fragment, Y.createRelativePositionFromJSON(c.anchorStart), binding.mapping)
        const to = relativePositionToAbsolutePosition(ydoc, fragment, Y.createRelativePositionFromJSON(c.anchorEnd), binding.mapping)
        if (from == null || to == null) return
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)).scrollIntoView())
        view.focus()
      } catch {}
    },

    scrollToBeat(ordinal) {
      let target = null
      view.state.doc.forEach((node, offset) => {
        if (target == null && node.attrs?.beat === ordinal) target = offset
      })
      if (target == null) return false
      view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(target + 1))).scrollIntoView())
      view.focus()
      return true
    },

    destroy() { view.destroy() },
  }
}

// ---------- plain-text helpers ----------

const ABBREV = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Mt|vs|etc|e\.g|i\.e|No|Fig|Capt|Col|Gen|Lt|Sgt)\.$/i

/** Soft sentence count. Imperfect by design; only used to warn, never to block. */
export function countSentences(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return 0
  let count = 0
  const re = /[.!?…]+["'”’)\]]*(?=\s+["'“‘(\[]?[A-Z0-9À-ɏ]|\s*$)/g
  let m, last = 0
  while ((m = re.exec(t))) {
    const before = t.slice(last, m.index + m[0].length)
    if (ABBREV.test(before.replace(/["'”’)\]]+$/, '').trim())) continue
    count++
    last = m.index + m[0].length
  }
  if (t.slice(last).trim()) count++
  return count
}

export const countWords = text => (String(text || '').match(/[\p{L}\p{N}’'-]+/gu) || []).length
