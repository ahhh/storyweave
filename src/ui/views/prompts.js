import { h, clear, syncList } from '../../util/dom.js'
import { bindText } from '../bind-text.js'
import { promptList, addPrompts, removePrompt, roster, LIMITS } from '../../collaboration/doc.js'
import { generatePrompts, ASSIGNMENT_MODES, MIN_PROMPTS, MAX_PROMPTS } from '../../prompts/generate.js'
import { PRESETS } from '../../prompts/library.js'
import { confirmDialog } from '../dialog.js'

const CATEGORY_LABEL = { character: 'Character', relationship: 'Relationship', world: 'World', conflict: 'Conflict', plot: 'Plot', theme: 'Theme', mystery: 'Mystery', style: 'Style' }

export function mountPrompts(app, el) {
  const { doc, s, me, readOnly } = app
  let filter = 'mine'

  const count = h('input', { type: 'number', min: MIN_PROMPTS, max: MAX_PROMPTS, value: 12, 'aria-label': 'Number of prompts' })
  const presetBtns = PRESETS.map(p => h('button.chip', { type: 'button', onclick: () => { count.value = p.count; markPreset() } }, `${p.label} · ${p.count}`))
  const markPreset = () => presetBtns.forEach((b, i) => b.classList.toggle('on', PRESETS[i].count === Number(count.value)))
  count.oninput = markPreset
  markPreset()
  const mode = h('select', { 'aria-label': 'Assignment mode' }, ASSIGNMENT_MODES.map(m => h('option', { value: m.id, title: m.hint }, m.label)))

  const deal = async () => {
    if (!app.ensureNamed()) return
    const n = Math.max(MIN_PROMPTS, Math.min(MAX_PROMPTS, Number(count.value) || 12))
    const existing = promptList(doc)
    if (existing.length >= LIMITS.prompts) { app.toast(`This story already has the maximum of ${LIMITS.prompts} prompts.`, 'warn'); return }
    const batch = (Number(s.meta.get('promptBatch')) || 0) + 1
    const generated = generatePrompts({
      seed: app.seed(), count: n, mode: mode.value,
      rosterIds: roster(doc).map(p => p.id), batch, selfId: me.id,
      exclude: existing.map(p => p.templateId), idPrefix: 'q',
    })
    s.meta.set('promptBatch', batch)
    const added = addPrompts(doc, generated, batch)
    app.toast(`Dealt ${added} prompt${added === 1 ? '' : 's'}`)
    filter = 'all'
    update()
  }

  const filters = h('div.segmented', { role: 'tablist', 'aria-label': 'Filter prompts' },
    [['mine', 'For me'], ['sent', 'From me'], ['open', 'Unanswered'], ['all', 'All']].map(([id, label]) =>
      h('button', { type: 'button', role: 'tab', dataset: { f: id }, onclick: () => { filter = id; update() } }, label)))
  const list = h('div.prompt-list')
  const empty = h('div.empty')
  const progress = h('div.progress', h('div.progress-bar'))
  const progressLabel = h('span.muted')

  el.append(
    h('div.view-head', h('h1', 'Prompt Relay'), h('p.lede', 'Send each other questions. The sender can tailor a question before it’s answered; answers feed the story bible and plot generator.')),
    ...(readOnly ? [] : [h('div.card.deal',
      h('div.deal-row',
        h('label.field', h('span', 'How many'), count),
        h('div.chips', presetBtns),
      ),
      h('div.deal-row',
        h('label.field', h('span', 'Who asks whom'), mode),
        h('button.btn.primary', { type: 'button', onclick: deal }, 'Deal prompts'),
      ),
      h('p.fineprint', 'Dealing is deterministic from the story seed and writer list, and never deletes existing prompts or answers.'),
    )]),
    h('div.list-head', filters, h('div.progress-wrap', progress, progressLabel)),
    list,
    empty,
  )

  const personSelect = (onchange, label) => h('select.person', { 'aria-label': label, onchange: e => onchange(e.target.value), disabled: readOnly })

  function card(p) {
    const q = h('textarea.q', { rows: 2, 'aria-label': 'Question (the sender can tailor this)' })
    const a = h('textarea.a', { rows: 3, placeholder: 'Your answer…', 'aria-label': 'Answer' })
    const unbind = []
    if (p.text) unbind.push(bindText(q, p.text, { maxLength: 1000, readOnly }))
    if (p.answer) unbind.push(bindText(a, p.answer, { maxLength: 4000, readOnly }))
    const setMeta = (key, val) => {
      const m = s.prompts.get(p.id)
      if (m) s.prompts.set(p.id, { ...m, [key]: val })
    }
    const from = personSelect(v => setMeta('fromId', v), 'Sender')
    const to = personSelect(v => setMeta('toId', v), 'Recipient')
    const el = h('article.prompt',
      h('header.prompt-head',
        h('span.tag'),
        h('span.route', from, h('span.arrow', { 'aria-hidden': 'true' }, '→'), to),
        h('span.slots'),
        readOnly ? null : h('button.icon-btn', {
          type: 'button', 'aria-label': 'Remove prompt', title: 'Remove prompt',
          onclick: async () => {
            const answered = (p.answer?.toString() || '').trim()
            if (answered && !(await confirmDialog('Remove this prompt?', 'Its answer will be removed from the story bible. Story prose is not affected.', { confirmLabel: 'Remove', danger: true }))) return
            removePrompt(doc, p.id)
          },
        }, '×'),
      ),
      h('label.q-wrap', h('span.sr-only', 'Question'), q),
      h('label.a-wrap', h('span.sr-only', 'Answer'), a),
      h('footer.prompt-foot', h('span.hint')),
    )
    el._refs = { q, a, from, to }
    el._unbind = unbind
    return el
  }

  function updateCard(el, p) {
    const { q, a, from, to } = el._refs
    const people = roster(doc)
    const sig = people.map(x => x.id + x.displayName).join('|') + p.fromId + p.toId
    if (el._sig !== sig) for (const [sel, val] of [[from, p.fromId], [to, p.toId]]) {
      clear(sel)
      for (const person of people) sel.append(h('option', { value: person.id, selected: person.id === val }, person.displayName + (person.id === me.id ? ' (you)' : '')))
      if (!people.some(x => x.id === val)) sel.append(h('option', { value: val, selected: true }, 'Someone who left'))
    }
    el._sig = sig
    el.querySelector('.tag').textContent = CATEGORY_LABEL[p.category] || p.category
    el.querySelector('.tag').dataset.cat = p.category
    el.querySelector('.slots').textContent = p.slotTags.join(' · ')
    const isSender = p.fromId === me.id, isRecipient = p.toId === me.id
    el.classList.toggle('for-me', isRecipient)
    const answered = !!(p.answer?.toString() || '').trim()
    el.classList.toggle('answered', answered)
    el.querySelector('.hint').textContent =
      isRecipient && !answered ? `${app.nameOf(p.fromId)} asks you this.` :
      isSender && !answered ? `Waiting on ${app.nameOf(p.toId)}. You can tailor the question until they answer.` :
      answered ? `Answered by ${app.nameOf(p.toId)}.` : `${app.nameOf(p.fromId)} → ${app.nameOf(p.toId)}`
    // Advisory permissions: the question is the sender's to tailor, the answer the recipient's.
    // These are UI hints, not security boundaries.
    q.classList.toggle('others', !isSender)
    a.placeholder = isRecipient ? 'Your answer…' : `${app.nameOf(p.toId)}’s answer…`
  }

  function update() {
    for (const b of filters.children) {
      const on = b.dataset.f === filter
      b.classList.toggle('on', on)
      b.setAttribute('aria-selected', String(on))
    }
    const all = promptList(doc)
    const answered = all.filter(p => (p.answer?.toString() || '').trim()).length
    progress.firstChild.style.width = all.length ? `${(answered / all.length) * 100}%` : '0'
    progressLabel.textContent = all.length ? `${answered} of ${all.length} answered` : ''
    const shown = all.filter(p =>
      filter === 'all' ? true :
      filter === 'mine' ? p.toId === me.id :
      filter === 'sent' ? p.fromId === me.id :
      !(p.answer?.toString() || '').trim())
    // Unbind cards that are hidden, deleted, or whose Y.Text was replaced by a concurrent deal.
    for (const c of [...list.children]) {
      const p = shown.find(x => x.id === c.dataset.key)
      if (!p || c._text !== p.text || c._answer !== p.answer) { c._unbind?.forEach(f => f()); c.remove() }
    }
    syncList(list, shown, p => p.id, p => { const c = card(p); c._text = p.text; c._answer = p.answer; return c }, updateCard)
    empty.textContent = shown.length ? '' :
      !all.length ? 'No prompts yet. Choose how many and deal a deck — everyone in the room gets questions.' :
      filter === 'mine' ? 'Nothing waiting for you. Check “All” to see everyone’s prompts.' : 'Nothing here.'
  }

  if (!promptList(doc).some(p => p.toId === me.id)) filter = 'all'
  return { update }
}
