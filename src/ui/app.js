import * as Y from 'yjs'
import { h, clear, rafThrottle, copyText, cleanLabel, safeColor } from '../util/dom.js'
import { S, roster, getSeed, upsertParticipant, answeredIngredients, currentWriter } from '../collaboration/doc.js'
import { shareUrl, newToken, deriveRoom } from '../collaboration/room.js'
import { save as saveIdentity, colorFor, recentRooms, forgetRoom } from '../app/identity.js'
import { forgetLocal } from '../persistence/local.js'
import { buildOutline, randomVariantId, getVariant } from '../story-engine/catalog.js'
import { bindText } from './bind-text.js'
import { openDialog, confirmDialog } from './dialog.js'
import { mountOverview } from './views/overview.js'
import { mountPrompts } from './views/prompts.js'
import { mountBible } from './views/bible.js'
import { mountPlot } from './views/plot.js'
import { mountWrite } from './views/write.js'
import { mountNotes } from './views/notes.js'
import { mountAI } from './views/ai.js'
import { mountExport } from './views/export.js'
import { mountConnection } from './views/connection.js'

const TABS = [
  { id: 'overview', label: 'Overview', icon: '◎', mount: mountOverview },
  { id: 'prompts', label: 'Prompt Relay', icon: '✉', mount: mountPrompts },
  { id: 'bible', label: 'Story Bible', icon: '❦', mount: mountBible },
  { id: 'plot', label: 'Plot Engine', icon: '⌇', mount: mountPlot },
  { id: 'write', label: 'Write', icon: '✎', mount: mountWrite },
  { id: 'notes', label: 'Scratchpad', icon: '☰', mount: mountNotes },
  { id: 'ai', label: 'AI Assist', icon: '✦', mount: mountAI },
  { id: 'export', label: 'Export', icon: '⇩', mount: mountExport },
  { id: 'connection', label: 'Connection', icon: '⇄', mount: mountConnection },
]

export function createApp(ctx) {
  const { doc, awareness, room, me, sync, readOnly } = ctx
  const s = S(doc)
  const listeners = new Set()
  let outlineCache = null

  const app = {
    ...ctx,
    s,
    editor: null,
    seed: () => getSeed(doc, room.defaultSeed),
    variantId: () => {
      const v = s.plot.get('variantId')
      return typeof v === 'string' && getVariant(v) ? v : randomVariantId(app.seed())
    },
    outline: () => {
      if (!outlineCache) outlineCache = buildOutline({ seed: app.seed(), variantId: app.variantId(), ingredients: answeredIngredients(doc) })
      return outlineCache
    },
    roster: () => roster(doc),
    participant: id => roster(doc).find(p => p.id === id),
    nameOf: id => (id === me.id ? (me.name || 'You') : app.participant(id)?.displayName) || 'Someone',
    colorOf: id => colorFor(app.participant(id)?.colorSeed ?? (id === me.id ? me.colorSeed : 0)),
    online: () => {
      const out = new Map()
      awareness.getStates().forEach((state, clientId) => {
        const u = state?.user
        if (!u || typeof u.id !== 'string') return
        out.set(u.id, { id: u.id, name: cleanLabel(u.name, 32) || 'Someone', color: safeColor(u.color), clientId, self: clientId === doc.clientID, view: typeof state.view === 'string' ? state.view : '' })
      })
      return out
    },
    onChange: fn => { listeners.add(fn); return () => listeners.delete(fn) },
    toast,
    go: tab => setTab(tab),
    avatar: (id, { small } = {}) => {
      const p = app.participant(id)
      const name = app.nameOf(id)
      const online = app.online().has(id)
      return h('span.avatar' + (small ? '.small' : '') + (online ? '.online' : ''), {
        style: { backgroundColor: app.colorOf(id) },
        title: `${name}${online ? ' (online)' : ''}`,
        'aria-label': `${name}${online ? ', online' : ''}`,
      }, p?.symbol || initials(name))
    },
    ensureNamed,
  }

  // ---------- shell ----------
  const root = document.getElementById('app')
  clear(root)
  const titleInput = h('input.title-input', { type: 'text', placeholder: 'Untitled story', 'aria-label': 'Story title', maxLength: 120 })
  bindText(titleInput, s.title, { maxLength: 120, readOnly })
  const presenceEl = h('div.presence', { 'aria-label': 'People here now' })
  const syncPill = h('button.sync-pill', { type: 'button', onclick: () => setTab('connection'), title: 'Connection details' })
  const nav = h('nav.nav', { 'aria-label': 'Sections' })
  const main = h('main.main', { id: 'main', tabIndex: -1 })
  const toasts = h('div.toasts', { role: 'status', 'aria-live': 'polite' })

  root.append(
    h('a.skip', { href: '#main' }, 'Skip to content'),
    h('header.topbar',
      h('button.brand', { type: 'button', onclick: showStories, title: 'Your stories' },
        h('span.brand-mark', { 'aria-hidden': 'true' }, '≋'), h('span.brand-name', 'StoryWeave')),
      titleInput,
      h('div.topbar-right',
        presenceEl,
        syncPill,
        h('button.btn.primary.share-btn', { type: 'button', onclick: showShare }, 'Invite'),
        h('button.icon-btn', { type: 'button', onclick: showProfile, title: 'Your name & colour', 'aria-label': 'Your profile' }, '☺'),
      ),
    ),
    ...(readOnly ? [h('div.banner.warn', ctx.readOnlyReason)] : []),
    h('div.shell', nav, main),
    toasts,
  )

  const views = new Map()
  let current = null
  for (const tab of TABS) {
    nav.append(h('button.nav-item', { type: 'button', dataset: { tab: tab.id }, onclick: () => setTab(tab.id) },
      h('span.nav-icon', { 'aria-hidden': 'true' }, tab.icon), h('span.nav-label', tab.label)))
  }

  function setTab(id) {
    if (!TABS.some(t => t.id === id)) id = 'overview'
    current = id
    for (const b of nav.children) {
      const on = b.dataset.tab === id
      b.classList.toggle('active', on)
      if (on) b.setAttribute('aria-current', 'page')
      else b.removeAttribute('aria-current')
    }
    for (const [tid, v] of views) v.el.hidden = tid !== id
    if (!views.has(id)) {
      const el = h('section.view', { dataset: { view: id }, 'aria-label': TABS.find(t => t.id === id).label })
      main.append(el)
      const handle = TABS.find(t => t.id === id).mount(app, el) || {}
      views.set(id, { el, ...handle })
    }
    views.get(id).update?.()
    views.get(id).show?.()
    try { sessionStorage.setItem('storyweave:tab:' + room.roomId, id) } catch {}
    awareness.setLocalStateField('view', id)
  }

  // ---------- updates ----------
  const refresh = rafThrottle(() => {
    outlineCache = null
    for (const fn of listeners) fn()
    views.get(current)?.update?.()
    renderPresence()
  })
  doc.on('update', refresh)
  awareness.on('change', rafThrottle(() => { renderPresence(); views.get(current)?.presence?.() }))

  function renderPresence() {
    clear(presenceEl)
    const online = [...app.online().values()]
    const seen = new Set()
    for (const u of online) {
      if (seen.has(u.id)) continue
      seen.add(u.id)
      presenceEl.append(h('span.avatar.online', { style: { backgroundColor: u.color }, title: u.name + (u.self ? ' (you)' : ''), 'aria-label': u.name + (u.self ? ' (you)' : '') }, initials(u.name)))
    }
    const st = sync.status
    const peers = (st?.parts || []).reduce((n, p) => n + (p.peers || 0), 0)
    const state = st?.state || 'connecting'
    syncPill.className = 'sync-pill ' + state
    syncPill.textContent = state === 'connected' ? (peers ? `● Live · ${peers} peer${peers === 1 ? '' : 's'}` : '● Live · waiting for others') : state === 'connecting' ? '◌ Connecting…' : '○ Offline · saved locally'
  }
  sync.onStatus = () => { renderPresence(); views.get('connection')?.update?.() }

  // ---------- toasts ----------
  function toast(msg, kind = '') {
    const t = h('div.toast' + (kind ? '.' + kind : ''), msg)
    toasts.append(t)
    setTimeout(() => t.classList.add('out'), 3200)
    setTimeout(() => t.remove(), 3700)
  }

  // ---------- dialogs ----------
  function showShare() {
    const url = shareUrl(room.token)
    const input = h('input.share-url', { type: 'text', readOnly: true, value: url, 'aria-label': 'Share link', onfocus: e => e.target.select() })
    openDialog({
      title: 'Invite collaborators',
      body: [
        h('p', 'Anyone with this link can join, read, and edit this story. Share it only with people you trust.'),
        input,
        h('ul.fineprint',
          h('li', 'The secret part after # never reaches any server. Public relays only see a one-way hash of it, used to introduce browsers to each other.'),
          h('li', 'Story text travels directly between browsers over encrypted WebRTC, and is saved in each participant’s own browser.'),
          h('li', 'There are no accounts: names are labels, not verified identities.'),
        ),
      ],
      actions: [
        { label: 'Close' },
        { label: 'Copy link', primary: true, onClick: async () => { toast((await copyText(url)) ? 'Link copied' : 'Copy failed — select and copy manually'); return false } },
      ],
    })
  }

  function ensureNamed() {
    if (me.name) return true
    showProfile(true)
    return false
  }

  function showProfile(welcome = false) {
    const name = h('input', { type: 'text', value: me.name, maxLength: 32, placeholder: 'e.g. Robin', autofocus: true, 'aria-label': 'Display name' })
    const symbol = h('input', { type: 'text', value: me.symbol || '', maxLength: 2, placeholder: '✶', 'aria-label': 'Symbol (optional)', class: 'symbol-input' })
    const hue = h('input', { type: 'range', min: 0, max: 359, value: me.colorSeed, 'aria-label': 'Colour' })
    const swatch = h('span.avatar', { style: { backgroundColor: colorFor(me.colorSeed) } }, initials(me.name || '?'))
    hue.oninput = () => { swatch.style.backgroundColor = colorFor(hue.value) }
    name.oninput = () => { swatch.textContent = symbol.value || initials(name.value || '?') }
    symbol.oninput = name.oninput
    const commit = () => {
      const n = cleanLabel(name.value, 32)
      if (!n) { name.focus(); toast('Please enter a name'); return false }
      me.name = n
      me.symbol = cleanLabel(symbol.value, 2)
      me.colorSeed = Number(hue.value)
      saveIdentity(me)
      ctx.setPresence()
      if (!readOnly && !upsertParticipant(doc, me)) toast('This story already has 12 writers — you can watch and comment.', 'warn')
      refresh()
    }
    name.addEventListener('keydown', e => { if (e.key === 'Enter') { if (commit() !== false) dlg.close() } })
    const dlg = openDialog({
      title: welcome ? 'Welcome to StoryWeave' : 'Your profile',
      body: [
        welcome ? h('p', ctx.fresh
          ? 'You’ve started a brand-new private story. Choose a name, then invite friends with the Invite button.'
          : 'You’ve been invited to a shared story. Choose a name so others know who’s writing.') : null,
        h('label.field', h('span', 'Display name'), name),
        h('div.row',
          h('label.field', h('span', 'Symbol'), symbol),
          h('label.field.grow', h('span', 'Colour'), hue),
          swatch),
        h('p.fineprint', 'Stored only in this browser. Names are not verified.'),
      ],
      actions: [{ label: welcome ? 'Start writing' : 'Save', primary: true, onClick: commit }],
      dismissable: !welcome,
    })
  }

  function showStories() {
    const list = h('ul.story-list')
    const render = () => {
      clear(list)
      for (const r of recentRooms()) {
        const isHere = r.token === room.token
        list.append(h('li',
          h('a', { href: '#' + r.token }, r.title || 'Untitled story'),
          h('span.muted', isHere ? ' · open now' : ' · ' + new Date(r.openedAt).toLocaleDateString()),
          h('button.btn.small.ghost', {
            type: 'button',
            onclick: async () => {
              if (!(await confirmDialog('Forget local copy?', `Delete “${r.title || 'Untitled story'}” from this browser? Collaborators keep their copies. This cannot be undone.`, { confirmLabel: 'Forget', danger: true }))) return
              const { roomId } = await deriveRoom(r.token)
              forgetRoom(r.token)
              if (isHere) { await ctx.provider.destroy(); await forgetLocal(roomId); location.hash = newToken(); return }
              await forgetLocal(roomId)
              render()
            },
          }, 'Forget'),
        ))
      }
    }
    render()
    openDialog({
      title: 'Your stories',
      body: [h('p.muted', 'Stories opened in this browser. Each link is private.'), list],
      actions: [{ label: 'Close' }, { label: 'New story', primary: true, onClick: () => { location.hash = newToken() } }],
    })
  }

  app.start = () => {
    let initial = 'overview'
    try { initial = sessionStorage.getItem('storyweave:tab:' + room.roomId) || (ctx.fresh ? 'overview' : 'write') } catch {}
    if (initial !== 'write') { setTab('write') } // editor must exist for AI scopes & comments
    setTab(initial)
    renderPresence()
    if (!me.name) showProfile(true)
  }

  return app
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/)
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase()
}

export { Y }
