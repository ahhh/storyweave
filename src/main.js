import './ui/styles.css'
import { Awareness } from 'y-protocols/awareness'
import { newToken, tokenFromHash, deriveRoom } from './collaboration/room.js'
import { createStoryDoc, ensureDefaults, S, upsertParticipant } from './collaboration/doc.js'
import { SyncEngine } from './collaboration/sync.js'
import { BroadcastChannelTransport, TrysteroTransport, MultiTransport, ExternalStoryTransport } from './collaboration/transports.js'
import { persist } from './persistence/local.js'
import { getIdentity, colorFor, rememberRoom } from './app/identity.js'
import { randomId } from './util/bytes.js'
import { createApp } from './ui/app.js'

async function boot() {
  let token = tokenFromHash()
  const fresh = !token
  if (fresh) {
    token = newToken()
    history.replaceState(null, '', '#' + token)
  }
  window.addEventListener('hashchange', () => location.reload())

  const room = await deriveRoom(token)
  const doc = createStoryDoc()
  const { provider, ready } = persist(room.roomId, doc)
  const persisted = await ready

  const { readOnly, reason } = ensureDefaults(doc, { defaultSeed: room.defaultSeed })
  const me = getIdentity()
  const awareness = new Awareness(doc)
  const setPresence = () => awareness.setLocalStateField('user', { id: me.id, name: me.name || 'Anonymous', color: colorFor(me.colorSeed) })
  setPresence()
  if (me.name && !readOnly) upsertParticipant(doc, me)

  const sync = new SyncEngine({
    doc, awareness,
    roomId: room.roomId, roomTag: room.roomTag, password: room.password,
    localPeerId: 'tab-' + randomId(6),
  })

  const app = createApp({ doc, awareness, room, me, sync, readOnly, readOnlyReason: reason, fresh, persisted, provider, setPresence })

  const defaultTransport = new MultiTransport([new BroadcastChannelTransport(), new TrysteroTransport()])
  await sync.setTransport(defaultTransport)

  // Public bridge so an external/private network can replace the default transport:
  //   storyweave.setTransport(new storyweave.ExternalStoryTransport({ send, subscribe }))
  window.storyweave = Object.freeze({
    roomId: room.roomId,
    setTransport: t => sync.setTransport(t),
    ExternalStoryTransport,
    BroadcastChannelTransport,
    TrysteroTransport,
    MultiTransport,
  })

  const remember = () => rememberRoom(token, S(doc).title.toString() || 'Untitled story')
  remember()
  S(doc).title.observe(remember)
  window.addEventListener('pagehide', () => sync.stop())
  app.start()
}

boot().catch(err => {
  const pre = document.createElement('pre')
  pre.className = 'fatal'
  pre.textContent = 'StoryWeave failed to start: ' + (err?.message || err)
  document.body.append(pre)
})
