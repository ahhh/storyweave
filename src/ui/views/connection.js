import { h, clear } from '../../util/dom.js'

export function mountConnection(app, el) {
  const body = h('div')
  el.append(
    h('div.view-head', h('h1', 'Connection'), h('p.lede', 'How this browser is talking to your collaborators.')),
    body,
  )
  function update() {
    const st = app.sync.status || { state: 'connecting', parts: [] }
    const caps = app.sync.transport?.capabilities || {}
    clear(body).append(
      h('div.card',
        h('h2', 'Status: ' + st.state),
        h('ul.conn-list', (st.parts || [{ name: app.sync.transport?.name || '—', ...st }]).map(p => h('li',
          h('span.dot.' + (p.state || 'connecting'), { 'aria-hidden': 'true' }),
          h('strong', p.name), ' — ', p.state || 'connecting',
          p.peers != null ? ` · ${p.peers} peer${p.peers === 1 ? '' : 's'}` : '',
          p.detail ? h('span.muted', ` (${p.detail})`) : null,
        ))),
        h('dl.kv',
          h('dt', 'Encrypted in transit'), h('dd', caps.encrypted ? 'Yes — WebRTC (DTLS) between browsers; signaling encrypted with your room link' : 'Not guaranteed by this transport'),
          h('dt', 'Authenticated peers'), h('dd', caps.authenticated ? 'Yes' : 'No — anyone with the link can join; names are not verified'),
          h('dt', 'Saved locally'), h('dd', app.persisted ? 'Yes — this browser’s IndexedDB' : 'Not available (private browsing?) — download a backup to be safe'),
          h('dt', 'Frames dropped'), h('dd', String(app.sync.dropped)),
        ),
      ),
      h('div.card',
        h('h2', 'Privacy model'),
        h('ul.fineprint',
          h('li', 'Your room link’s secret (after #) never leaves your browser in any request to a server.'),
          h('li', 'Public Nostr relays help browsers find each other using a hash of the secret, then step aside. Story text flows directly between browsers.'),
          h('li', 'If two people can’t connect directly (some strict corporate or mobile networks), they may need a TURN relay; tabs in the same browser always sync.'),
          h('li', 'Developers can plug in a different network: storyweave.setTransport(new storyweave.ExternalStoryTransport({ send, subscribe })).'),
        ),
      ),
    )
  }
  return { update }
}
