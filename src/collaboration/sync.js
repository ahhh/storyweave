// Sync engine: Yjs document + awareness over any StoryTransport.
//
// Join: HELLO(stateVector, wantReply) -> peers answer with STATE_DIFF and, if asked,
// their own HELLO so we can send back what *they* lack. Afterwards incremental
// YJS_UPDATE / AWARENESS frames. Periodic anti-entropy HELLOs heal missed frames.
// No peer is authoritative; convergence is the CRDT's job.

import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import { MSG, LIMITS, encode, decode, RateLimiter } from './protocol.js'

const REMOTE = Symbol('remote')
const ANTI_ENTROPY_MS = 45_000

export class SyncEngine {
  constructor({ doc, awareness, roomId, roomTag, password, localPeerId, onStatus }) {
    this.doc = doc
    this.awareness = awareness
    this.roomId = roomId
    this.roomTag = roomTag
    this.password = password
    this.localPeerId = localPeerId
    this.onStatus = onStatus || (() => {})
    this.transport = null
    this.peerClients = new Map() // transport peer -> Set(awareness clientID)
    this.seenPeers = new Set()
    this.dropped = 0
    this.limiter = new RateLimiter({ rate: 120, burst: 400 })
    this.awLimiter = new RateLimiter({ rate: 15, burst: 30 })

    this._onUpdate = (update, origin) => {
      if (origin === REMOTE) return
      // updates too large for a normal frame go out as STATE_DIFF (higher cap)
      const type = update.length > LIMITS[MSG.YJS_UPDATE] ? MSG.STATE_DIFF : MSG.YJS_UPDATE
      this._send(type, update)
    }
    this._awPending = null
    this._onAwareness = ({ added, updated, removed }, origin) => {
      if (origin === REMOTE) return
      const changed = added.concat(updated, removed)
      if (!this._awPending) {
        this._awPending = new Set()
        setTimeout(() => { // throttle to ~10/sec
          const ids = [...this._awPending]
          this._awPending = null
          this._send(MSG.AWARENESS, awarenessProtocol.encodeAwarenessUpdate(this.awareness, ids))
        }, 100)
      }
      changed.forEach(id => this._awPending.add(id))
    }
  }

  async setTransport(transport) {
    if (this.transport) {
      this._send(MSG.GOODBYE)
      await this.transport.stop()
    }
    this.transport = transport
    this.doc.on('update', this._onUpdate)
    this.awareness.on('update', this._onAwareness)
    await transport.start({
      roomId: this.roomId,
      password: this.password,
      localPeerId: this.localPeerId,
      onMessage: (bytes, from) => this._receive(bytes, from),
      onPeerJoin: peer => this._hello(true, peer),
      onPeerLeave: peer => this._peerGone(peer),
      onStatus: s => { this.status = s; this.onStatus(s) },
    })
    this._hello(true)
    clearInterval(this._ae)
    this._ae = setInterval(() => { if (this.seenPeers.size) this._hello(false) }, ANTI_ENTROPY_MS)
  }

  async stop() {
    clearInterval(this._ae)
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'local')
    this._send(MSG.AWARENESS, awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID]))
    this._send(MSG.GOODBYE)
    this.doc.off('update', this._onUpdate)
    this.awareness.off('update', this._onAwareness)
    await this.transport?.stop()
    this.transport = null
  }

  _send(type, payload, toPeer) {
    if (!this.transport) return
    try { this.transport.send(encode(type, this.roomTag, payload), toPeer) } catch { /* transport hiccup; anti-entropy heals */ }
  }

  _hello(wantReply, toPeer) {
    const sv = Y.encodeStateVector(this.doc)
    const payload = new Uint8Array(1 + sv.length)
    payload[0] = wantReply ? 1 : 0
    payload.set(sv, 1)
    this._send(MSG.HELLO, payload, toPeer)
  }

  _receive(bytes, from) {
    const msg = decode(bytes, this.roomTag)
    if (!msg) { this.dropped++; return }
    const limiter = msg.type === MSG.AWARENESS ? this.awLimiter : this.limiter
    if (!limiter.allow(from)) { this.dropped++; return }
    this.seenPeers.add(from)
    try {
      switch (msg.type) {
        case MSG.HELLO: {
          const sv = msg.payload.subarray(1)
          const diff = Y.encodeStateAsUpdate(this.doc, sv)
          this._send(MSG.STATE_DIFF, diff, from)
          if (msg.payload[0] & 1) this._hello(false, from)
          const states = [...this.awareness.getStates().keys()]
          if (states.length) this._send(MSG.AWARENESS, awarenessProtocol.encodeAwarenessUpdate(this.awareness, states), from)
          break
        }
        case MSG.STATE_DIFF:
        case MSG.YJS_UPDATE:
          Y.applyUpdate(this.doc, msg.payload, REMOTE)
          this.lastRemoteAt = Date.now()
          break
        case MSG.AWARENESS: {
          const before = new Set(this.awareness.getStates().keys())
          awarenessProtocol.applyAwarenessUpdate(this.awareness, msg.payload, REMOTE)
          let set = this.peerClients.get(from)
          if (!set) this.peerClients.set(from, (set = new Set()))
          for (const id of this.awareness.getStates().keys()) if (!before.has(id)) set.add(id)
          break
        }
        case MSG.PING:
          this._send(MSG.PONG, msg.payload, from)
          break
        case MSG.GOODBYE:
          this._peerGone(from)
          break
      }
    } catch {
      // Malformed CRDT/awareness payload from a peer: ignore, never crash the app.
      this.dropped++
    }
  }

  _peerGone(peer) {
    this.seenPeers.delete(peer)
    this.limiter.forget(peer)
    this.awLimiter.forget(peer)
    const ids = this.peerClients.get(peer)
    if (ids?.size) awarenessProtocol.removeAwarenessStates(this.awareness, [...ids].filter(id => id !== this.doc.clientID), REMOTE)
    this.peerClients.delete(peer)
  }
}
