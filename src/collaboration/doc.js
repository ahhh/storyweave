// Shared CRDT schema: one Y.Doc per story room.
//
// Y.Doc
// ├── meta: Y.Map            schemaVersion, appVersion, seed, variantId, promptBatches…
// ├── title / premise: Y.Text
// ├── participants: Y.Map<participantId, Participant>
// ├── prompts: Y.Map<promptId, PromptMeta>
// ├── promptOrder: Y.Array<promptId>
// ├── promptTexts / promptAnswers: Y.Map<promptId, Y.Text>
// ├── plot: Y.Map            variantId, beatNotes (Y.Map<beatOrdinal, Y.Text>)
// ├── turns: Y.Map           order, index, round, mode, beat
// ├── story: Y.XmlFragment   ProseMirror document
// ├── notes: Y.Text          parking lot / scratchpad
// ├── cards: Y.Map<cardId, Y.Map>  character & relationship cards
// ├── comments: Y.Map<commentId, Comment>
// └── toolLog: Y.Array       oracle / motif / constraint / complication draws

import * as Y from 'yjs'

export const SCHEMA_VERSION = 1
export const APP_VERSION = '0.1.0'

export const LIMITS = Object.freeze({
  participants: 12,
  prompts: 100,
  comments: 2000,
  cards: 60,
  toolLog: 200,
  pasteWarnBytes: 1024 * 1024,
  importBytes: 20 * 1024 * 1024,
})

const migrations = {
  // 1: doc => { ...migrate v1 to v2... }
}

export function createStoryDoc() {
  const doc = new Y.Doc()
  return doc
}

/** Typed accessors. Top-level Yjs types are created lazily and are idempotent across peers. */
export function S(doc) {
  return {
    doc,
    meta: doc.getMap('meta'),
    title: doc.getText('title'),
    premise: doc.getText('premise'),
    participants: doc.getMap('participants'),
    prompts: doc.getMap('prompts'),
    promptOrder: doc.getArray('promptOrder'),
    promptTexts: doc.getMap('promptTexts'),
    promptAnswers: doc.getMap('promptAnswers'),
    plot: doc.getMap('plot'),
    turns: doc.getMap('turns'),
    story: doc.getXmlFragment('story'),
    notes: doc.getText('notes'),
    cards: doc.getMap('cards'),
    comments: doc.getMap('comments'),
    toolLog: doc.getArray('toolLog'),
  }
}

/**
 * Fill defaults. Every value written here is the same on every peer (the seed default
 * is derived from the room token), so concurrent initialisation cannot conflict.
 * Returns { readOnly, reason } if the document is from a newer, unsupported schema.
 */
export function ensureDefaults(doc, { defaultSeed }) {
  const s = S(doc)
  const v = s.meta.get('schemaVersion')
  if (typeof v === 'number' && v > SCHEMA_VERSION) {
    return { readOnly: true, reason: `This story was created by a newer StoryWeave (schema ${v}). Opened read-only.` }
  }
  doc.transact(() => {
    if (typeof v === 'number' && v < SCHEMA_VERSION) {
      for (let from = v; from < SCHEMA_VERSION; from++) migrations[from]?.(doc)
    }
    if (s.meta.get('schemaVersion') !== SCHEMA_VERSION) s.meta.set('schemaVersion', SCHEMA_VERSION)
    if (s.meta.get('appVersion') !== APP_VERSION) s.meta.set('appVersion', APP_VERSION)
    if (typeof s.meta.get('seed') !== 'string') s.meta.set('seed', defaultSeed)
  }, 'init')
  return { readOnly: false }
}

export const getSeed = (doc, fallback) => {
  const seed = S(doc).meta.get('seed')
  return typeof seed === 'string' && seed.length <= 80 ? seed : fallback
}

// ---------- participants ----------

/** Sanitised roster, sorted by join time then id (deterministic across peers). */
export function roster(doc) {
  const out = []
  S(doc).participants.forEach((p, id) => {
    if (!p || typeof p !== 'object') return
    out.push({
      id,
      displayName: String(p.displayName ?? '').slice(0, 32) || 'Anonymous',
      colorSeed: Number(p.colorSeed) || 0,
      symbol: String(p.symbol ?? '').slice(0, 4),
      joinedAt: Number(p.joinedAt) || 0,
    })
  })
  out.sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1))
  return out.slice(0, LIMITS.participants)
}

export function upsertParticipant(doc, me) {
  const map = S(doc).participants
  const existing = map.get(me.id)
  if (!existing && map.size >= LIMITS.participants) return false
  const next = {
    displayName: me.name || 'Anonymous',
    colorSeed: me.colorSeed,
    symbol: me.symbol || '',
    joinedAt: existing?.joinedAt || Date.now(),
  }
  if (!existing || existing.displayName !== next.displayName || existing.colorSeed !== next.colorSeed || existing.symbol !== next.symbol) {
    map.set(me.id, next)
  }
  return true
}

// ---------- prompts ----------

export function promptList(doc) {
  const s = S(doc)
  const seen = new Set()
  const out = []
  s.promptOrder.forEach(id => {
    if (typeof id !== 'string' || seen.has(id)) return
    seen.add(id)
    const m = s.prompts.get(id)
    if (!m || typeof m !== 'object') return
    const text = s.promptTexts.get(id)
    const answer = s.promptAnswers.get(id)
    out.push({
      id,
      templateId: String(m.templateId ?? ''),
      category: String(m.category ?? ''),
      slotTags: Array.isArray(m.slotTags) ? m.slotTags.filter(t => typeof t === 'string').slice(0, 8) : [],
      fromId: String(m.fromId ?? ''),
      toId: String(m.toId ?? ''),
      batch: Number(m.batch) || 0,
      createdAt: Number(m.createdAt) || 0,
      text: text instanceof Y.Text ? text : null,
      answer: answer instanceof Y.Text ? answer : null,
    })
  })
  return out
}

export function addPrompts(doc, generated, batch) {
  const s = S(doc)
  const room = LIMITS.prompts - s.promptOrder.length
  const list = generated.slice(0, Math.max(0, room))
  doc.transact(() => {
    for (const p of list) {
      s.prompts.set(p.id, { templateId: p.templateId, category: p.category, slotTags: p.slotTags, fromId: p.fromId, toId: p.toId, batch, createdAt: Date.now() })
      s.promptTexts.set(p.id, new Y.Text(p.question))
      s.promptAnswers.set(p.id, new Y.Text(''))
    }
    s.promptOrder.push(list.map(p => p.id))
  })
  return list.length
}

export function removePrompt(doc, id) {
  const s = S(doc)
  doc.transact(() => {
    const arr = s.promptOrder.toArray()
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] === id) s.promptOrder.delete(i, 1)
    s.prompts.delete(id)
    s.promptTexts.delete(id)
    s.promptAnswers.delete(id)
  })
}

/** Answered prompts as plain story-bible ingredients. */
export function answeredIngredients(doc) {
  return promptList(doc)
    .map(p => ({
      promptId: p.id,
      question: p.text?.toString() ?? '',
      answer: (p.answer?.toString() ?? '').trim(),
      tags: p.slotTags,
      category: p.category,
      authorId: p.toId,
    }))
    .filter(i => i.answer.length > 0)
}

// ---------- turns ----------

export function turnState(doc) {
  const t = S(doc).turns
  const order = Array.isArray(t.get('order')) ? t.get('order').filter(x => typeof x === 'string') : []
  return {
    order,
    index: Math.max(0, Number(t.get('index')) || 0),
    round: Math.max(1, Number(t.get('round')) || 1),
    mode: t.get('mode') === 'free' ? 'free' : 'round',
    beat: Math.min(11, Math.max(0, Number(t.get('beat')) || 0)),
    beatAuto: t.get('beatAuto') !== false,
  }
}

/** Effective writer order: stored order filtered to real participants, then any newcomers. */
export function effectiveOrder(doc) {
  const r = roster(doc)
  const ids = new Set(r.map(p => p.id))
  const stored = turnState(doc).order.filter(id => ids.has(id))
  for (const p of r) if (!stored.includes(p.id)) stored.push(p.id)
  return stored
}

export function currentWriter(doc) {
  const order = effectiveOrder(doc)
  if (!order.length) return null
  return order[turnState(doc).index % order.length]
}

export function advanceTurn(doc, { skipTo } = {}) {
  const t = S(doc).turns
  const st = turnState(doc)
  const order = effectiveOrder(doc)
  if (!order.length) return
  doc.transact(() => {
    let next = st.index + 1
    if (skipTo != null) next = skipTo
    const wrapped = Math.floor(next / order.length) > Math.floor(st.index / order.length)
    t.set('index', next % order.length)
    if (wrapped) {
      t.set('round', st.round + 1)
      if (st.beatAuto && st.beat < 11) t.set('beat', st.beat + 1)
    }
  })
}

// ---------- beat notes ----------

export function beatNote(doc, ordinal) {
  const plot = S(doc).plot
  let notes = plot.get('beatNotes')
  if (!(notes instanceof Y.Map)) {
    doc.transact(() => { if (!(plot.get('beatNotes') instanceof Y.Map)) plot.set('beatNotes', new Y.Map()) })
    notes = plot.get('beatNotes')
  }
  let text = notes.get(String(ordinal))
  if (!(text instanceof Y.Text)) {
    doc.transact(() => { if (!(notes.get(String(ordinal)) instanceof Y.Text)) notes.set(String(ordinal), new Y.Text()) })
    text = notes.get(String(ordinal))
  }
  return text
}

// ---------- tool log ----------

export function logTool(doc, entry) {
  const log = S(doc).toolLog
  doc.transact(() => {
    log.push([{ ...entry, at: Date.now() }])
    if (log.length > LIMITS.toolLog) log.delete(0, log.length - LIMITS.toolLog)
  })
}
