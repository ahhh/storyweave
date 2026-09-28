// Pluggable transports. Upper layers depend only on this shape:
//
// interface StoryTransport {
//   name: string
//   capabilities: { binary, ordered, reliable, peerList, authenticated, encrypted, maxMessageBytes }
//   start(ctx: {
//     roomId, password, localPeerId,
//     onMessage(bytes: Uint8Array, fromPeer: string),
//     onPeerJoin?(peer), onPeerLeave?(peer),
//     onStatus?({ state: 'connecting'|'connected'|'disconnected'|'degraded', peers?: number, detail?: string }),
//   }): Promise<void> | void
//   send(bytes: Uint8Array, toPeer?: string): Promise<void> | void   // toPeer omitted => broadcast
//   stop(): Promise<void> | void
// }

import { toBytes } from './protocol.js'
import { bytesToB64url, b64urlToBytes } from '../util/bytes.js'

/** Same-browser tabs. Zero setup, works offline, reference implementation. */
export class BroadcastChannelTransport {
  name = 'Same-browser tabs'
  capabilities = { binary: true, ordered: true, reliable: true, peerList: false, authenticated: false, encrypted: false, local: true }

  start(ctx) {
    if (typeof BroadcastChannel === 'undefined') { ctx.onStatus?.({ state: 'disconnected', detail: 'BroadcastChannel unavailable' }); return }
    this.ctx = ctx
    this.ch = new BroadcastChannel('storyweave:' + ctx.roomId)
    this.ch.onmessage = e => {
      const m = e.data
      if (!m || typeof m.from !== 'string' || m.from === ctx.localPeerId) return
      if (m.to && m.to !== ctx.localPeerId) return
      const bytes = toBytes(m.bytes)
      if (bytes) ctx.onMessage(bytes, m.from)
    }
    ctx.onStatus?.({ state: 'connected' })
  }

  send(bytes, toPeer) {
    this.ch?.postMessage({ from: this.ctx.localPeerId, to: toPeer || null, bytes })
  }

  stop() { this.ch?.close(); this.ch = null }
}

/** Internet peers over WebRTC; signaling via public Nostr relays (Trystero), as in c4-man. */
export class TrysteroTransport {
  name = 'Peer-to-peer (WebRTC)'
  capabilities = {
    binary: true, ordered: true, reliable: true, peerList: true,
    // WebRTC data channels are always DTLS-encrypted. Signaling is AES-GCM encrypted with a key
    // derived from the room token. Anyone holding the link is admitted — there are no accounts.
    encrypted: true, authenticated: false,
  }

  constructor({ appId = 'storyweave-v1', relayRedundancy = 4, turnConfig } = {}) {
    this.appId = appId
    this.relayRedundancy = relayRedundancy
    this.turnConfig = turnConfig // e.g. [{ urls: 'turn:…', username, credential }] for strict NATs
  }

  async start(ctx) {
    this.ctx = ctx
    ctx.onStatus?.({ state: 'connecting', detail: 'contacting relays…' })
    let mod
    try {
      mod = await import('trystero/nostr')
    } catch (err) {
      ctx.onStatus?.({ state: 'disconnected', detail: 'P2P library failed to load' })
      return
    }
    if (this.stopped) return
    this.room = mod.joinRoom(
      { appId: this.appId, password: ctx.password, relayConfig: { redundancy: this.relayRedundancy, warnOnRelayFailure: false }, ...(this.turnConfig ? { turnConfig: this.turnConfig } : {}) },
      ctx.roomId,
      { onJoinError: d => ctx.onStatus?.({ state: 'degraded', detail: 'a peer could not connect (' + (d?.error || 'unknown') + ')' }) },
    )
    this.action = this.room.makeAction('sw')
    this.action.onMessage = (data, meta) => {
      const bytes = toBytes(data)
      if (bytes && meta?.peerId) ctx.onMessage(bytes, 't:' + meta.peerId)
    }
    const report = () => ctx.onStatus?.({ state: 'connected', peers: Object.keys(this.room.getPeers()).length })
    this.room.onPeerJoin = id => { report(); ctx.onPeerJoin?.('t:' + id) }
    this.room.onPeerLeave = id => { report(); ctx.onPeerLeave?.('t:' + id) }
    report()
  }

  send(bytes, toPeer) {
    if (!this.action) return
    if (toPeer && !toPeer.startsWith('t:')) return
    this.action.send(bytes, toPeer ? { target: toPeer.slice(2) } : undefined).catch(() => {})
  }

  stop() {
    this.stopped = true
    try { this.room?.leave() } catch {}
    this.room = this.action = null
  }
}

/**
 * Adapter for an external / private network. Supply a byte (or string) pipe:
 *
 *   const transport = new ExternalStoryTransport({
 *     send: bytes => secretNetwork.send(bytes),
 *     subscribe: cb => secretNetwork.onMessage(cb),   // cb(bytes, fromPeerId?) ; may return unsubscribe fn
 *     stringsOnly: false,
 *   })
 *   storyweave.setTransport(transport)
 */
export class ExternalStoryTransport {
  constructor({ name = 'External network', send, subscribe, stringsOnly = false, capabilities = {} }) {
    this.name = name
    this._send = send
    this._subscribe = subscribe
    this.stringsOnly = stringsOnly
    this.capabilities = { binary: !stringsOnly, authenticated: false, encrypted: false, ...capabilities }
  }

  start(ctx) {
    this.ctx = ctx
    this.unsub = this._subscribe((data, from) => {
      let bytes
      try { bytes = typeof data === 'string' ? b64urlToBytes(data) : toBytes(data) } catch { return }
      if (bytes) ctx.onMessage(bytes, 'x:' + String(from ?? 'external'))
    })
    ctx.onStatus?.({ state: 'connected' })
  }

  send(bytes) { this._send(this.stringsOnly ? bytesToB64url(bytes) : bytes) }

  stop() { if (typeof this.unsub === 'function') this.unsub() }
}

/** Fan-out over several transports at once. The CRDT tolerates duplicate delivery. */
export class MultiTransport {
  constructor(transports) {
    this.transports = transports
    this.name = transports.map(t => t.name).join(' + ')
    this.status = new Map()
  }
  get capabilities() {
    return {
      encrypted: this.transports.every(t => t.capabilities.encrypted || t.capabilities.local),
      authenticated: this.transports.every(t => t.capabilities.authenticated),
    }
  }
  async start(ctx) {
    await Promise.all(this.transports.map(t => t.start({
      ...ctx,
      onStatus: s => { this.status.set(t, s); ctx.onStatus?.(this.combined()) },
    })))
  }
  combined() {
    const parts = this.transports.map(t => ({ name: t.name, ...(this.status.get(t) || { state: 'connecting' }) }))
    const any = parts.some(p => p.state === 'connected')
    return { state: any ? 'connected' : parts.some(p => p.state === 'connecting') ? 'connecting' : 'disconnected', parts }
  }
  send(bytes, toPeer) {
    for (const t of this.transports) t.send(bytes, toPeer)
  }
  stop() { return Promise.all(this.transports.map(t => t.stop())) }
}

/** In-memory hub for tests: new MemoryHub().transport() per peer. */
export class MemoryHub {
  peers = new Map()
  transport() {
    const hub = this
    return {
      name: 'memory', capabilities: {},
      start(ctx) {
        this.ctx = ctx
        for (const [id, other] of hub.peers) { other.ctx.onPeerJoin?.(ctx.localPeerId); ctx.onPeerJoin?.(id) }
        hub.peers.set(ctx.localPeerId, this)
      },
      send(bytes, to) {
        for (const [id, p] of hub.peers) {
          if (id === this.ctx.localPeerId || (to && to !== id)) continue
          const copy = bytes.slice()
          queueMicrotask(() => p.ctx.onMessage(copy, this.ctx.localPeerId))
        }
      },
      stop() {
        hub.peers.delete(this.ctx.localPeerId)
        for (const p of hub.peers.values()) p.ctx.onPeerLeave?.(this.ctx.localPeerId)
      },
    }
  }
}
