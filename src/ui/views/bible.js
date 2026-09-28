import * as Y from 'yjs'
import { h, clear, syncList } from '../../util/dom.js'
import { bindText } from '../bind-text.js'
import { answeredIngredients, LIMITS } from '../../collaboration/doc.js'
import { buildBible } from '../../story-engine/bible.js'
import { randomId } from '../../util/bytes.js'
import { confirmDialog } from '../dialog.js'

const CARD_FIELDS = [
  ['want', 'Want'], ['need', 'Need'], ['fear', 'Fear'], ['secret', 'Secret'],
  ['relationship', 'Relationships'], ['contradiction', 'Contradiction'], ['status', 'Current status'],
]

export function mountBible(app, el) {
  const { doc, s, readOnly } = app
  const sectionsEl = h('div.bible')
  const cardsEl = h('div.cards')

  el.append(
    h('div.view-head', h('h1', 'Story Bible'), h('p.lede', 'Every answer, sorted into what it tells us about the story. Each entry links back to the prompt it came from.')),
    sectionsEl,
    h('div.section-head',
      h('h2', 'Character & relationship cards'),
      readOnly ? null : h('button.btn', { type: 'button', onclick: addCard }, '+ New card'),
    ),
    cardsEl,
  )

  function addCard() {
    if (s.cards.size >= LIMITS.cards) { app.toast('Card limit reached', 'warn'); return }
    const card = new Y.Map()
    doc.transact(() => {
      card.set('createdAt', Date.now())
      for (const [k] of [['name'], ...CARD_FIELDS]) card.set(k, new Y.Text())
      s.cards.set('c-' + randomId(6), card)
    })
  }

  function cardEl(id, card) {
    const unbind = []
    const field = (key, label, rows = 2) => {
      let t = card.get(key)
      if (!(t instanceof Y.Text)) { t = new Y.Text(); card.set(key, t) }
      const input = key === 'name'
        ? h('input.card-name', { type: 'text', placeholder: 'Name', 'aria-label': 'Card name' })
        : h('textarea', { rows, 'aria-label': label })
      unbind.push(bindText(input, t, { maxLength: key === 'name' ? 60 : 800, readOnly }))
      return key === 'name' ? input : h('label.field', h('span', label), input)
    }
    const node = h('article.char-card',
      h('header', field('name', 'Name'),
        readOnly ? null : h('button.icon-btn', {
          type: 'button', 'aria-label': 'Delete card',
          onclick: async () => { if (await confirmDialog('Delete card?', 'This removes the card for everyone.', { confirmLabel: 'Delete', danger: true })) s.cards.delete(id) },
        }, '×')),
      CARD_FIELDS.map(([k, label]) => field(k, label)),
    )
    node._unbind = unbind
    node._card = card
    return node
  }

  function update() {
    const bible = buildBible(answeredIngredients(doc))
    clear(sectionsEl)
    const filled = bible.filter(sec => sec.entries.length)
    if (!filled.length) sectionsEl.append(h('div.empty', 'The bible fills in as prompts are answered. Head to Prompt Relay to deal some questions.'))
    for (const sec of filled) {
      sectionsEl.append(h('section.bible-sec',
        h('h3', sec.name, h('span.count', String(sec.entries.length))),
        h('ul', sec.entries.map(e => h('li',
          h('p.answer', e.answer),
          h('p.source', h('button.link', { type: 'button', onclick: () => app.go('prompts'), title: 'Open Prompt Relay' }, e.question), ' — ', app.nameOf(e.authorId)),
        ))),
      ))
    }
    const cards = []
    s.cards.forEach((card, id) => { if (card instanceof Y.Map) cards.push({ id, card, at: Number(card.get('createdAt')) || 0 }) })
    cards.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1))
    for (const c of [...cardsEl.children]) {
      const cur = cards.find(x => x.id === c.dataset.key)
      if (!cur || cur.card !== c._card) { c._unbind?.forEach(f => f()); c.remove() }
    }
    syncList(cardsEl, cards, c => c.id, c => cardEl(c.id, c.card))
    if (!cards.length && !cardsEl.querySelector('.empty')) cardsEl.append(h('div.empty', 'Pin compact notes for characters and relationships: want, need, fear, secret…'))
    else if (cards.length) cardsEl.querySelector('.empty')?.remove()
  }
  return { update }
}
