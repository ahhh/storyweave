import { h, clear, syncList, debounce, cleanLabel } from '../../util/dom.js'
import { createEditor, countSentences, countWords } from '../../editor/editor.js'
import { turnState, effectiveOrder, currentWriter, advanceTurn, logTool, LIMITS, roster } from '../../collaboration/doc.js'
import { drawOracle, drawMotif, drawConstraint, drawComplication } from '../../story-engine/tools.js'
import { createRng, shuffle, subSeed } from '../../util/rng.js'
import { randomId } from '../../util/bytes.js'
import { storyPlainText } from './overview.js'
import { fortuneGlyph, campbellChips } from './plot.js'
import { confirmDialog, openDialog } from '../dialog.js'

export function mountWrite(app, el) {
  const { doc, s, me, awareness, readOnly } = app
  const draftKey = 'storyweave:draft:' + app.room.roomId

  // ---------- center: editor ----------
  const editorMount = h('div.editor-mount')
  const wordCount = h('span.muted.wc')
  const editor = createEditor({
    mount: editorMount, ydoc: doc, fragment: s.story, awareness, commentsMap: s.comments, readOnly,
    onChange: debounce(() => { wordCount.textContent = `${countWords(storyPlainText(s.story)).toLocaleString()} words` }, 400),
  })
  app.editor = editor
  const c = editor.commands
  const tb = (label, title, fn, extra = {}) => h('button.tb', { type: 'button', title, 'aria-label': title, onmousedown: e => e.preventDefault(), onclick: fn, ...extra }, label)
  const toolbar = h('div.toolbar', { role: 'toolbar', 'aria-label': 'Formatting' },
    tb(h('b', 'B'), 'Bold (Ctrl/Cmd+B)', c.bold),
    tb(h('i', 'I'), 'Italic (Ctrl/Cmd+I)', c.italic),
    h('span.tb-sep'),
    tb('¶', 'Paragraph', c.paragraph),
    tb('H2', 'Heading', c.h2),
    tb('H3', 'Subheading', c.h3),
    tb('❝', 'Blockquote', c.quote),
    tb('•', 'Bulleted list', c.bullet),
    tb('1.', 'Numbered list', c.ordered),
    tb('—', 'Scene break', c.hr),
    h('span.tb-sep'),
    tb('↶', 'Undo your last change (Ctrl/Cmd+Z)', c.undo),
    tb('↷', 'Redo (Ctrl/Cmd+Shift+Z)', c.redo),
    h('span.tb-sep'),
    tb('💬', 'Comment on selection', addComment),
    h('span.spacer'),
    wordCount,
    tb('◱', 'Focus mode', () => el.classList.toggle('focus')),
  )

  // ---------- composer ----------
  const turnHeadline = h('div.turn-headline')
  const beatSel = h('select', { 'aria-label': 'Target plot beat', onchange: e => { if (!readOnly) s.turns.set('beat', Number(e.target.value)) } })
  const beatGuide = h('p.beat-guide')
  const beatCampbell = h('div.composer-campbell')
  const draft = h('textarea.draft', { rows: 4, placeholder: 'Write your passage — about 1–5 sentences…', 'aria-label': 'Your passage' })
  try { draft.value = sessionStorage.getItem(draftKey) || '' } catch {}
  const counter = h('span.sentence-count', { 'aria-live': 'polite' })
  const drafting = h('span.drafting.muted')
  const withHeading = h('input', { type: 'checkbox', 'aria-label': 'Start with the beat title as a heading' })
  const updateCounter = () => {
    const n = countSentences(draft.value)
    counter.textContent = `${n} sentence${n === 1 ? '' : 's'} · aim for 1–5`
    counter.classList.toggle('warn', n > 5)
    try { sessionStorage.setItem(draftKey, draft.value) } catch {}
  }
  let draftingState = false
  const setDrafting = v => { if (v !== draftingState) { draftingState = v; awareness.setLocalStateField('drafting', v) } }
  draft.addEventListener('input', () => { updateCounter(); setDrafting(!!draft.value.trim()) })
  draft.addEventListener('blur', () => setDrafting(false))
  draft.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } })
  updateCounter()

  async function submit() {
    const text = draft.value.trim()
    if (!text || readOnly) return
    if (!app.ensureNamed()) return
    const ts = turnState(doc)
    const writer = currentWriter(doc)
    if (ts.mode === 'round' && writer && writer !== me.id && app.online().has(writer)) {
      if (!(await confirmDialog('Not your turn yet', `It’s ${app.nameOf(writer)}’s turn. Submit anyway? (Turns are a friendly convention, not a lock.)`, { confirmLabel: 'Submit anyway' }))) return
    }
    const n = countSentences(text)
    if (n > 5 && !(await confirmDialog('A long passage', `That’s about ${n} sentences — the target is 1–5. Submit it anyway?`, { confirmLabel: 'Submit' }))) return
    const beat = ts.beat
    if (withHeading.checked) {
      const b = app.outline()?.beats[beat]
      if (b) editor.insertBeatHeading(b.label, beat)
      withHeading.checked = false
    }
    editor.appendPassage(text, { author: me.id, turn: ts.round, beat, created: Date.now() })
    draft.value = ''
    updateCounter()
    setDrafting(false)
    if (ts.mode === 'round') advanceTurn(doc)
  }

  const composer = h('section.composer', { 'aria-label': 'Your turn' },
    turnHeadline,
    h('div.row.wrap', h('label.field.grow', h('span', 'Beat'), beatSel), h('label.check', withHeading, ' Add beat heading')),
    beatGuide,
    beatCampbell,
    draft,
    h('div.row.wrap', counter, drafting, h('span.spacer'),
      readOnly ? null : h('button.btn', { type: 'button', onclick: pass, title: 'Skip your turn' }, 'Pass'),
      readOnly ? null : h('button.btn.primary', { type: 'button', onclick: submit, title: 'Ctrl/Cmd+Enter' }, 'Add passage')),
  )

  function pass() {
    const writer = currentWriter(doc)
    advanceTurn(doc)
    app.toast(writer === me.id ? 'You passed' : `Skipped ${app.nameOf(writer)}`)
  }

  // ---------- left: outline ----------
  const outlineList = h('ol.outline-list')
  const outlineHead = h('p.muted.small')
  const left = h('aside.write-left', { 'aria-label': 'Outline' }, h('h2', 'Outline'), outlineHead, outlineList,
    h('button.btn.small.ghost', { type: 'button', onclick: () => app.go('plot') }, 'Open Plot Engine'))

  // ---------- right: turns, tools, comments ----------
  const modeBtn = h('div.segmented', { role: 'group', 'aria-label': 'Turn mode' },
    h('button', { type: 'button', dataset: { m: 'round' }, onclick: () => !readOnly && s.turns.set('mode', 'round') }, 'Round robin'),
    h('button', { type: 'button', dataset: { m: 'free' }, onclick: () => !readOnly && s.turns.set('mode', 'free') }, 'Free'))
  const orderList = h('ol.turn-order')
  const roundEl = h('span.muted')
  const autoBeat = h('input', { type: 'checkbox', onchange: e => s.turns.set('beatAuto', e.target.checked) })

  const toolOut = h('div.tool-log')
  const draw = kind => {
    if (!app.ensureNamed() || readOnly) return
    const n = (Number(s.meta.get('toolCounter')) || 0) + 1
    s.meta.set('toolCounter', n)
    const seed = app.seed()
    let text
    if (kind === 'oracle') text = drawOracle(seed, n)
    else if (kind === 'motif') { const m = drawMotif(seed, n); text = `${m.kind}: ${m.value}` }
    else if (kind === 'constraint') text = drawConstraint(seed, n)
    else text = drawComplication(seed, n, app.variantId(), turnState(doc).beat)
    logTool(doc, { kind, text, by: me.id })
  }
  const commentsEl = h('ul.comments')
  const showResolved = h('input', { type: 'checkbox', onchange: () => renderComments() })

  const right = h('aside.write-right', { 'aria-label': 'Turns, tools, and comments' },
    h('section',
      h('h2', 'Turns'), modeBtn, roundEl, orderList,
      readOnly ? null : h('div.row.wrap',
        h('button.btn.small', { type: 'button', onclick: shuffleOrder }, 'Seeded shuffle'),
        h('button.btn.small', { type: 'button', onclick: () => { s.turns.set('index', 0); s.turns.set('round', 1) } }, 'Restart')),
      h('label.check.small', autoBeat, ' Advance beat each round'),
    ),
    h('section',
      h('h2', 'Spark'),
      h('div.tool-btns',
        h('button.btn.small', { type: 'button', onclick: () => draw('oracle'), title: 'A seeded twist or nudge' }, 'Oracle'),
        h('button.btn.small', { type: 'button', onclick: () => draw('motif'), title: 'A recurring object, sound, colour…' }, 'Motif'),
        h('button.btn.small', { type: 'button', onclick: () => draw('constraint'), title: 'A playful writing constraint' }, 'Constraint'),
        h('button.btn.small', { type: 'button', onclick: () => draw('complication'), title: 'A new obstacle for this beat' }, 'Complication')),
      toolOut,
    ),
    h('section',
      h('h2', 'Comments'),
      h('p.muted.small', 'Select text in the story, then press 💬.'),
      h('label.check.small', showResolved, ' Show resolved'),
      commentsEl,
    ),
  )

  function shuffleOrder() {
    const n = (Number(s.meta.get('orderShuffles')) || 0) + 1
    s.meta.set('orderShuffles', n)
    doc.transact(() => {
      s.turns.set('order', shuffle(effectiveOrder(doc), createRng(subSeed(app.seed(), 'turn-order', n))))
      s.turns.set('index', 0)
    })
  }

  function moveWriter(id, delta) {
    const order = effectiveOrder(doc)
    const i = order.indexOf(id), j = i + delta
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    s.turns.set('order', order)
  }

  function addComment() {
    if (!app.ensureNamed() || readOnly) return
    const anchors = editor.selectionAnchors()
    if (!anchors) { app.toast('Select some text first'); return }
    if (s.comments.size >= LIMITS.comments) { app.toast('Comment limit reached', 'warn'); return }
    const body = h('textarea', { rows: 3, maxLength: 2000, autofocus: true, 'aria-label': 'Comment' })
    openDialog({
      title: 'Add a comment',
      body: [h('p.muted', '“' + anchors.quote.slice(0, 120) + (anchors.quote.length > 120 ? '…' : '') + '”'), body],
      actions: [{ label: 'Cancel' }, {
        label: 'Comment', primary: true,
        onClick: () => {
          const text = body.value.trim()
          if (!text) return false
          s.comments.set('m-' + randomId(6), { authorId: me.id, createdAt: Date.now(), resolved: false, body: text.slice(0, 2000), ...anchors })
        },
      }],
    })
  }

  function renderComments() {
    const list = []
    s.comments.forEach((cm, id) => {
      if (!cm || typeof cm.body !== 'string') return
      if (cm.resolved && !showResolved.checked) return
      list.push({ id, ...cm })
    })
    list.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
    commentsEl.querySelector('.no-comments')?.remove()
    syncList(commentsEl, list.slice(0, 200), x => x.id + (x.resolved ? ':r' : ''), cm => h('li.comment' + (cm.resolved ? '.resolved' : ''),
      h('button.comment-quote', { type: 'button', onclick: () => editor.selectAnchors(cm), title: 'Show in story' }, '“' + String(cm.quote || '').slice(0, 80) + '”'),
      h('p', cm.body),
      h('div.row.small', app.avatar(cm.authorId, { small: true }), h('span.muted', app.nameOf(cm.authorId)), h('span.spacer'),
        readOnly ? null : h('button.link', { type: 'button', onclick: () => s.comments.set(cm.id, { ...s.comments.get(cm.id), resolved: !cm.resolved }) }, cm.resolved ? 'Reopen' : 'Resolve'),
        readOnly ? null : h('button.link', { type: 'button', onclick: () => s.comments.delete(cm.id) }, 'Delete')),
    ))
    if (!list.length) commentsEl.append(h('li.muted.small.no-comments', 'No comments.'))
  }

  // mobile drawers
  const drawerBtns = h('div.drawer-btns',
    h('button.btn.small', { type: 'button', onclick: () => el.classList.toggle('show-left') }, '☰ Outline'),
    h('button.btn.small', { type: 'button', onclick: () => el.classList.toggle('show-right') }, 'Turns & notes ⋯'))

  el.classList.add('write-view')
  el.append(
    drawerBtns,
    h('div.write-grid',
      left,
      h('div.write-center', toolbar, h('div.page', editorMount), composer),
      right,
    ),
  )

  // ---------- update ----------
  function update() {
    const outline = app.outline()
    const ts = turnState(doc)
    const order = effectiveOrder(doc)
    const writer = currentWriter(doc)
    const online = app.online()

    // outline
    outlineHead.textContent = outline?.variant.name || ''
    syncList(outlineList, outline?.beats || [], b => b.ordinal,
      b => h('li', h('button.outline-beat', { type: 'button' }, h('span.n'), h('span.lbl'), h('span.fortune'))),
      (li, b) => {
        const btn = li.firstChild
        btn.children[0].textContent = String(b.ordinal + 1)
        btn.children[1].textContent = b.label
        btn.children[2].textContent = fortuneGlyph(b.fortune)
        btn.children[2].dataset.f = String(b.fortune)
        btn.title = `${b.purpose}\n\nCampbell: ${b.campbell.map(x => x.name).join(' · ')}`
        btn.classList.toggle('current', b.ordinal === ts.beat)
        btn.onclick = () => {
          if (!readOnly) s.turns.set('beat', b.ordinal)
          editor.scrollToBeat(b.ordinal)
          el.classList.remove('show-left')
        }
      })

    // composer
    clear(beatSel)
    for (const b of outline?.beats || []) beatSel.append(h('option', { value: b.ordinal, selected: b.ordinal === ts.beat }, `${b.ordinal + 1}. ${b.label}`))
    const beat = outline?.beats[ts.beat]
    beatGuide.textContent = beat ? `${beat.purpose} ${beat.guidance}` : ''
    const key = beat ? beat.id : ''
    if (beatCampbell.dataset.key !== key) { clear(beatCampbell); if (beat) beatCampbell.append(campbellChips(app, beat, { compact: true })); beatCampbell.dataset.key = key }

    if (ts.mode === 'free') turnHeadline.textContent = 'Free writing — anyone can add a passage.'
    else if (!writer) turnHeadline.textContent = 'Add your name to start taking turns.'
    else if (writer === me.id) turnHeadline.textContent = `✦ Your turn · round ${ts.round}`
    else turnHeadline.textContent = `${app.nameOf(writer)}’s turn · round ${ts.round}${online.has(writer) ? '' : ' (away — you can skip them)'}`
    composer.classList.toggle('my-turn', ts.mode === 'round' && writer === me.id)

    // turns panel
    for (const b of modeBtn.children) b.classList.toggle('on', b.dataset.m === ts.mode)
    roundEl.textContent = ts.mode === 'round' ? `Round ${ts.round}` : ''
    autoBeat.checked = ts.beatAuto
    clear(orderList)
    order.forEach((id, i) => orderList.append(h('li' + (ts.mode === 'round' && id === writer ? '.current' : ''),
      app.avatar(id, { small: true }),
      h('span.name', app.nameOf(id) + (id === me.id ? ' (you)' : '')),
      h('span.status', online.has(id) ? '' : 'away'),
      readOnly ? null : h('span.order-btns',
        h('button.icon-btn.small', { type: 'button', 'aria-label': `Move ${app.nameOf(id)} up`, disabled: i === 0, onclick: () => moveWriter(id, -1) }, '↑'),
        h('button.icon-btn.small', { type: 'button', 'aria-label': `Move ${app.nameOf(id)} down`, disabled: i === order.length - 1, onclick: () => moveWriter(id, 1) }, '↓'),
        ts.mode === 'round' && id === writer && id !== me.id ? h('button.link', { type: 'button', onclick: pass }, 'skip') : null),
    )))

    // tool log
    const log = s.toolLog.toArray().filter(x => x && typeof x.text === 'string').slice(-8).reverse()
    clear(toolOut)
    for (const entry of log) toolOut.append(h('div.tool-entry',
      h('span.tool-kind', cleanLabel(entry.kind, 14)), h('p', entry.text.slice(0, 300)),
      h('span.muted.small', app.nameOf(entry.by))))

    renderComments()
    presence()
  }

  function presence() {
    const names = []
    app.awareness.getStates().forEach((st, id) => { if (id !== doc.clientID && st?.drafting && st.user?.name) names.push(cleanLabel(st.user.name, 24)) })
    drafting.textContent = names.length ? `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} drafting…` : ''
  }

  wordCount.textContent = `${countWords(storyPlainText(s.story)).toLocaleString()} words`
  return { update, presence }
}
