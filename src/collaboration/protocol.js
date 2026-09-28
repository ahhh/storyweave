// Versioned binary envelope. The transport only ever carries opaque bytes.
//
//   [0]    magic 0x53 ('S')
//   [1]    protocol version
//   [2]    message type
//   [3..6] room tag (4 bytes derived from the room token)
//   [7..]  payload
//
// decode() never throws: malformed input returns null.

export const MAGIC = 0x53
export const VERSION = 1
export const HEADER = 7

export const MSG = Object.freeze({
  HELLO: 1,       // payload: [flags u8] + Yjs state vector. flags&1 = "please HELLO me back"
  STATE_DIFF: 2,  // payload: Yjs update computed against the peer's state vector
  YJS_UPDATE: 3,  // payload: incremental Yjs update
  AWARENESS: 4,   // payload: y-protocols awareness update
  PING: 5,
  PONG: 6,
  GOODBYE: 7,
  ERROR: 8,
})

const KNOWN = new Set(Object.values(MSG))

const KiB = 1024, MiB = 1024 * KiB
export const LIMITS = Object.freeze({
  [MSG.HELLO]: 64 * KiB,
  [MSG.STATE_DIFF]: 32 * MiB,  // join sync of a large story; Trystero chunks under the hood
  [MSG.YJS_UPDATE]: 1 * MiB,
  [MSG.AWARENESS]: 64 * KiB,
  [MSG.PING]: 64,
  [MSG.PONG]: 64,
  [MSG.GOODBYE]: 64,
  [MSG.ERROR]: 1 * KiB,
})
export const MAX_FRAME = HEADER + 32 * MiB

export function encode(type, roomTag, payload = new Uint8Array(0)) {
  const out = new Uint8Array(HEADER + payload.length)
  out[0] = MAGIC
  out[1] = VERSION
  out[2] = type
  out.set(roomTag.subarray(0, 4), 3)
  out.set(payload, HEADER)
  return out
}

/** @returns {{type:number, payload:Uint8Array} | null} */
export function decode(bytes, roomTag) {
  if (!(bytes instanceof Uint8Array)) return null
  if (bytes.length < HEADER || bytes.length > MAX_FRAME) return null
  if (bytes[0] !== MAGIC || bytes[1] !== VERSION) return null
  const type = bytes[2]
  if (!KNOWN.has(type)) return null
  for (let i = 0; i < 4; i++) if (bytes[3 + i] !== roomTag[i]) return null
  const payload = bytes.subarray(HEADER)
  if (payload.length > LIMITS[type]) return null
  return { type, payload }
}

/** Normalize whatever a transport hands us into a Uint8Array (or null). */
export function toBytes(data) {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  return null
}

/** Simple per-peer token bucket for flood protection. */
export class RateLimiter {
  constructor({ rate, burst }) {
    this.rate = rate
    this.burst = burst
    this.buckets = new Map()
  }
  allow(peer, now = performance.now()) {
    let b = this.buckets.get(peer)
    if (!b) { b = { tokens: this.burst, at: now }; this.buckets.set(peer, b) }
    b.tokens = Math.min(this.burst, b.tokens + ((now - b.at) / 1000) * this.rate)
    b.at = now
    if (b.tokens < 1) return false
    b.tokens -= 1
    return true
  }
  forget(peer) { this.buckets.delete(peer) }
}
