import * as Y from 'yjs'
import { h, clear, copyText } from '../../util/dom.js'
import { bindText } from '../bind-text.js'
import { beatNote, roster, addPrompts, promptList, LIMITS } from '../../collaboration/doc.js'
import { CATALOG, getVariant, randomVariantId, buildOutline, outlineToText } from '../../story-engine/catalog.js'
import { FAMILIES } from '../../story-engine/families.js'
import { LENSES, SHAPES } from '../../story-engine/modifiers.js'
import { answeredIngredients } from '../../collaboration/doc.js'
import { randomId } from '../../util/bytes.js'
import { openDialog } from '../dialog.js'

const FAV_KEY = 'storyweave:favorites'
const loadFavs = () => { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')) } catch { return new Set() } }
const saveFavs = favs => { try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])) } catch {} }

export function fortuneGlyph(f) {
  return ({ '-2': '▼▼', '-1': '▼', '0': '◆', '1': '▲', '2': '▲▲' })[String(f)]
}

/** A Campbell chip: hover/focus tooltip + expandable panel with prompts. */
export function campbellChips(app, beat, { compact = false } = {}) {
  return h('div.campbell', beat.campbell.map(stage => {
    let i = 0
    const promptText = h('p.campbell-prompt', stage.prompts[0])
    const details = h('details.campbell-chip',
      h('summary', { title: `${stage.name} — ${stage.gist}` },
        h('span.campbell-phase', stage.phase), ' ', stage.name),
      h('div.campbell-pop',
        h('p.campbell-gist', stage.gist),
        promptText,
        h('div.row.wrap',
          h('button.btn.small', { type: 'button', onclick: () => { i = (i + 1) % stage.prompts.length; promptText.textContent = stage.prompts[i] } }, 'Another prompt'),
          compact ? null : h('button.btn.small', { type: 'button', onclick: () => askSomeone(app, beat, stage, promptText.textContent) }, 'Ask someone'),
          h('button.btn.small.ghost', { type: 'button', onclick: () => { toParkingLot(app, `[${beat.label} · ${stage.name}] ${promptText.textContent}`); app.toast('Added to Scratchpad') } }, 'To scratchpad'),
        ),
        h('p.fineprint', 'Stage from Joseph Campbell’s monomyth (The Hero with a Thousand Faces). Summary and prompts paraphrased by StoryWeave.'),
      ),
    )
    return details
  }))
}

function toParkingLot(app, text) {
  const notes = app.s.notes
  notes.insert(notes.length, (notes.length ? '\n\n' : '') + text)
}

function askSomeone(app, beat, stage, question) {
  if (!app.ensureNamed()) return
  const people = roster(app.doc)
  const others = people.filter(p => p.id !== app.me.id)
  const sel = h('select', { 'aria-label': 'Recipient' }, (others.length ? others : people).map(p => h('option', { value: p.id }, p.displayName)))
  openDialog({
    title: 'Send as a prompt',
    body: [h('p', question), h('label.field', h('span', 'Ask'), sel)],
    actions: [
      { label: 'Cancel' },
      {
        label: 'Send', primary: true,
        onClick: () => {
          if (promptList(app.doc).length >= LIMITS.prompts) { app.toast('Prompt limit reached', 'warn'); return false }
          addPrompts(app.doc, [{
            id: 'c-' + randomId(6), templateId: 'campbell:' + stage.id, category: 'plot',
            slotTags: beat.preferredTags.slice(0, 4), question, fromId: app.me.id, toId: sel.value || app.me.id,
          }], 0)
          app.toast('Prompt sent')
        },
      },
    ],
  })
}

export function mountPlot(app, el) {
  const { doc, s, readOnly } = app
  const favs = loadFavs()

  const search = h('input', { type: 'search', placeholder: 'Search 300 plot lines…', 'aria-label': 'Search plot lines' })
  const famSel = h('select', { 'aria-label': 'Arc family' }, h('option', { value: '' }, 'Any family'), FAMILIES.map(f => h('option', { value: f.id }, f.name)))
  const lensSel = h('select', { 'aria-label': 'Conflict lens' }, h('option', { value: '' }, 'Any conflict'), LENSES.map(l => h('option', { value: l.id }, l.name)))
  const shapeSel = h('select', { 'aria-label': 'Narrative shape' }, h('option', { value: '' }, 'Any shape'), SHAPES.map(sh => h('option', { value: sh.id }, sh.name)))
  const favOnly = h('input', { type: 'checkbox', 'aria-label': 'Favourites only' })
  const results = h('select.plot-results', { size: 8, 'aria-label': 'Matching plot lines', onchange: e => choose(e.target.value) })
  const resultCount = h('span.muted')
  const currentName = h('h2.current-plot')
  const currentBlurb = h('p.muted')
  const favBtn = h('button.btn.small', { type: 'button', onclick: toggleFav })
  const beatsEl = h('ol.beats')
  const fortuneEl = h('div.fortune-chart', { 'aria-hidden': 'true' })

  for (const x of [search, famSel, lensSel, shapeSel, favOnly]) x.addEventListener('input', renderResults)

  el.append(
    h('div.view-head', h('h1', 'Plot Engine'), h('p.lede', '15 arc families × 5 conflict lenses × 4 narrative shapes. Your answers are slotted into each beat. Changing structure never touches your prose.')),
    h('div.card.plot-picker',
      h('div.row.wrap', search, famSel, lensSel, shapeSel, h('label.check', favOnly, ' Favourites')),
      results,
      h('div.row.wrap',
        resultCount,
        h('span.spacer'),
        readOnly ? null : h('button.btn', { type: 'button', onclick: () => choose(randomVariantId(app.seed())) }, 'Randomize from seed'),
        readOnly ? null : h('button.btn', { type: 'button', onclick: () => choose(randomVariantId(app.seed(), randomId(4))) }, 'Randomize new'),
        h('button.btn', { type: 'button', onclick: compare }, 'Compare…'),
        h('button.btn', { type: 'button', onclick: async () => app.toast((await copyText(outlineToText(app.outline()))) ? 'Outline copied' : 'Copy failed') }, 'Copy outline'),
      ),
    ),
    h('div.plot-current', h('div', currentName, currentBlurb), favBtn),
    fortuneEl,
    beatsEl,
  )

  function choose(id) {
    if (readOnly || !getVariant(id)) return
    s.plot.set('variantId', id)
  }

  function toggleFav() {
    const id = app.variantId()
    favs.has(id) ? favs.delete(id) : favs.add(id)
    saveFavs(favs)
    update()
  }

  function matches() {
    const q = search.value.trim().toLowerCase()
    return CATALOG.filter(v =>
      (!famSel.value || v.family.id === famSel.value) &&
      (!lensSel.value || v.lens.id === lensSel.value) &&
      (!shapeSel.value || v.shape.id === shapeSel.value) &&
      (!favOnly.checked || favs.has(v.id)) &&
      (!q || v.name.toLowerCase().includes(q) || v.family.blurb.toLowerCase().includes(q)))
  }

  function renderResults() {
    const list = matches()
    const cur = app.variantId()
    clear(results)
    for (const v of list) results.append(h('option', { value: v.id, selected: v.id === cur }, (favs.has(v.id) ? '★ ' : '') + v.name))
    resultCount.textContent = `${list.length} of ${CATALOG.length}`
  }

  function compare() {
    const other = h('select', { 'aria-label': 'Compare with' }, CATALOG.map(v => h('option', { value: v.id }, v.name)))
    other.value = randomVariantId(app.seed(), 'compare')
    const table = h('div.compare')
    const render = () => {
      const a = app.outline()
      const b = buildOutline({ seed: app.seed(), variantId: other.value, ingredients: answeredIngredients(doc) })
      clear(table).append(
        h('div.compare-col', h('h3', a.variant.name), h('ol', a.beats.map(x => h('li', h('strong', x.label), ' ', fortuneGlyph(x.fortune), h('br'), h('span.muted', x.purpose))))),
        h('div.compare-col', h('h3', b.variant.name), h('ol', b.beats.map(x => h('li', h('strong', x.label), ' ', fortuneGlyph(x.fortune), h('br'), h('span.muted', x.purpose))))),
      )
    }
    other.onchange = render
    render()
    openDialog({
      title: 'Compare structures', wide: true,
      body: [h('label.field', h('span', 'Compare current plot with'), other), table],
      actions: [{ label: 'Close' }, readOnly ? null : { label: 'Use this one', primary: true, onClick: () => choose(other.value) }].filter(Boolean),
    })
  }

  const beatEls = new Map()
  function beatEl(beat) {
    const notes = h('textarea.beat-notes', { rows: 2, placeholder: 'Shared notes for this beat…', 'aria-label': `Notes for ${beat.label}` })
    const node = h('li.beat',
      h('div.beat-head',
        h('span.beat-n', String(beat.ordinal + 1)),
        h('h3.beat-label'),
        h('span.fortune'),
      ),
      h('p.beat-purpose'),
      h('p.beat-guidance'),
      h('ul.ingredients'),
      h('p.beat-question'),
      h('div.beat-campbell'),
      notes,
      h('div.row',
        h('button.btn.small', { type: 'button', onclick: () => { if (!readOnly) app.s.turns.set('beat', beat.ordinal); app.go('write') } }, 'Write this beat'),
      ),
    )
    node._unbind = bindText(notes, beatNote(doc, beat.ordinal), { maxLength: 4000, readOnly })
    return node
  }

  function update() {
    const outline = app.outline()
    if (!outline) return
    const { variant, beats } = outline
    currentName.textContent = variant.name
    currentBlurb.textContent = `${variant.family.blurb} Opposition: ${variant.lens.opposition}. ${variant.shape.blurb}${s.plot.get('variantId') ? '' : ' (Seeded default — pick one to lock it in.)'}`
    favBtn.textContent = favs.has(variant.id) ? '★ Favourite' : '☆ Favourite'
    favBtn.setAttribute('aria-pressed', String(favs.has(variant.id)))
    renderResults()

    clear(fortuneEl)
    for (const b of beats) fortuneEl.append(h('span', { style: { '--f': String(b.fortune) }, title: `${b.label}: ${b.fortuneWord}` }))

    for (const b of beats) {
      let node = beatEls.get(b.ordinal)
      if (!node) { node = beatEl(b); beatEls.set(b.ordinal, node); beatsEl.append(node) }
      node.querySelector('.beat-label').textContent = b.label
      const f = node.querySelector('.fortune')
      f.textContent = `${fortuneGlyph(b.fortune)} ${b.fortuneWord}`
      f.dataset.f = String(b.fortune)
      node.querySelector('.beat-purpose').textContent = b.purpose
      node.querySelector('.beat-guidance').textContent = [b.guidance, b.lensNote, b.shapeNote].filter(Boolean).join(' ')
      const ing = clear(node.querySelector('.ingredients'))
      if (!b.ingredients.length) ing.append(h('li.muted', 'No answers slotted yet — answer prompts tagged ' + b.preferredTags.join(', ') + '.'))
      for (const i of b.ingredients) ing.append(h('li', { title: 'From: ' + i.question }, h('span.ing-kind', i.reason === 'match' ? '◆' : i.reason === 'related' ? '◇' : '✧'), ' ', i.answer.length > 220 ? i.answer.slice(0, 220) + '…' : i.answer))
      node.querySelector('.beat-question').textContent = '✎ ' + b.question
      const camp = node.querySelector('.beat-campbell')
      const key = b.campbell.map(c => c.id).join()
      if (camp.dataset.key !== key) { clear(camp).append(campbellChips(app, b)); camp.dataset.key = key }
    }
  }
  return { update }
}
