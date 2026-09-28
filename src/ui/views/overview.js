import { h, clear, syncList } from '../../util/dom.js'
import { bindText } from '../bind-text.js'
import { promptList, currentWriter, turnState } from '../../collaboration/doc.js'
import { randomSeed } from '../../collaboration/room.js'
import { countWords } from '../../editor/editor.js'
import { confirmDialog } from '../dialog.js'
import { yXmlFragmentToProsemirrorJSON } from 'y-prosemirror'

export function storyPlainText(fragment) {
  const out = []
  const walk = n => {
    if (n.type === 'text') out.push(n.text)
    for (const c of n.content || []) walk(c)
    if (n.type === 'paragraph' || n.type === 'heading') out.push('\n')
  }
  walk(yXmlFragmentToProsemirrorJSON(fragment))
  return out.join('')
}

export function mountOverview(app, el) {
  const { s, readOnly } = app
  const premise = h('textarea.premise', { rows: 3, placeholder: 'One or two sentences: who, where, and what goes wrong…', 'aria-label': 'Premise', maxLength: 1200 })
  bindText(premise, s.premise, { maxLength: 1200, readOnly })

  const stats = h('dl.stats')
  const seedEl = h('code.seed')
  const rosterEl = h('ul.roster')

  const steps = [
    ['prompts', '1', 'Prompt each other', 'Deal a deck of creative questions. Everyone answers the ones sent to them.'],
    ['bible', '2', 'Grow the story bible', 'Answers become characters, places, secrets and themes.'],
    ['plot', '3', 'Pick a plot line', '300 structures to choose from, seeded by your answers.'],
    ['write', '4', 'Write in turns', '1–5 sentences each, or free-for-all. Edit together live.'],
    ['export', '5', 'Take it with you', 'Download .txt, .md, .docx, or a full project backup.'],
  ]

  el.append(
    h('div.view-head', h('h1', 'Overview'), h('p.lede', 'A private room for co-writing one story. Everything saves in your browser and syncs straight to your collaborators’ browsers.')),
    h('div.grid-2',
      h('div.card',
        h('h2', 'Premise'),
        premise,
        h('div.seed-row',
          h('span.muted', 'Seed '), seedEl,
          readOnly ? null : h('button.btn.small.ghost', {
            type: 'button',
            title: 'Change the seed that drives prompt, plot, and oracle generation',
            onclick: async () => {
              if (!(await confirmDialog('Reroll seed?', 'New prompts, the default plot line, and oracle draws will change. Existing prompts, answers, and prose are kept.', { confirmLabel: 'Reroll' }))) return
              s.meta.set('seed', randomSeed())
            },
          }, 'Reroll'),
        ),
        stats,
      ),
      h('div.card',
        h('h2', 'Writers'),
        rosterEl,
        h('button.btn', { type: 'button', onclick: () => document.querySelector('.share-btn')?.click() }, 'Invite more'),
      ),
    ),
    h('div.card.steps',
      h('h2', 'How it works'),
      h('ol.step-list', steps.map(([tab, n, title, text]) => h('li',
        h('button.step', { type: 'button', onclick: () => app.go(tab) },
          h('span.step-n', n), h('span.step-text', h('strong', title), h('span', text)))))),
    ),
  )

  const update = () => {
    seedEl.textContent = app.seed()
    const prompts = promptList(app.doc)
    const answered = prompts.filter(p => (p.answer?.toString() || '').trim()).length
    const words = countWords(storyPlainText(s.story))
    const writer = currentWriter(app.doc)
    const ts = turnState(app.doc)
    const outline = app.outline()
    const st = app.sync.status?.state || 'connecting'
    clear(stats).append(
      stat('Writers', String(app.roster().length)),
      stat('Prompts answered', `${answered} / ${prompts.length}`),
      stat('Words', words.toLocaleString()),
      stat('Plot line', outline?.variant.name || '—'),
      stat('Up next', writer ? `${app.nameOf(writer)} · round ${ts.round}` : '—'),
      stat('Sync', st),
    )
    const online = app.online()
    syncList(rosterEl, app.roster(), p => p.id,
      p => h('li', app.avatar(p.id), h('span.name'), h('span.status')),
      (li, p) => {
        li.replaceChild(app.avatar(p.id), li.firstChild)
        li.children[1].textContent = p.displayName + (p.id === app.me.id ? ' (you)' : '')
        li.children[2].textContent = online.has(p.id) ? 'online' : 'away'
        li.children[2].className = 'status ' + (online.has(p.id) ? 'on' : 'off')
      })
  }
  return { update, presence: update }
}

const stat = (k, v) => h('div.stat', h('dt', k), h('dd', v))
