// Room identity.
//
// A room is identified by a secret *token* that lives only in the URL fragment
// (#token). Fragments are never sent to GitHub Pages or any other server.
//
// From the token we derive:
//   - roomId:  SHA-256 based public name used for relay rendezvous + local storage keys.
//              Relays only ever see this hash, never the token.
//   - password: the token itself, used by Trystero to encrypt WebRTC signaling
//              (peers without the token cannot complete a handshake).
//   - defaultSeed: a friendly deterministic seed so every peer agrees on
//              generation even before the shared document has synced.

import { bytesToB64url, toHex } from '../util/bytes.js'

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/

export function newToken() {
  return bytesToB64url(crypto.getRandomValues(new Uint8Array(16))) // 128 bits
}

export const isValidToken = t => typeof t === 'string' && TOKEN_RE.test(t)

export function tokenFromHash(hash = location.hash) {
  const raw = decodeURIComponent(hash.replace(/^#/, '')).trim()
  const t = raw.startsWith('r=') ? raw.slice(2) : raw
  return isValidToken(t) ? t : null
}

export function shareUrl(token) {
  const u = new URL(location.href)
  u.hash = token
  u.search = ''
  return u.toString()
}

const WORDS_A = ['amber', 'ashen', 'brass', 'cinder', 'copper', 'dusk', 'ember', 'fern', 'frost', 'gilded', 'hollow', 'indigo', 'ivory', 'lantern', 'lunar', 'moss', 'north', 'opal', 'quiet', 'rook', 'rust', 'salt', 'silver', 'storm', 'thorn', 'tidal', 'velvet', 'willow', 'winter', 'wren', 'ochre', 'cobalt']
const WORDS_B = ['atlas', 'bell', 'cartographer', 'compass', 'crown', 'engine', 'ferry', 'garden', 'harbor', 'heron', 'key', 'kite', 'library', 'lighthouse', 'loom', 'map', 'mask', 'mirror', 'orchard', 'otter', 'raven', 'river', 'sparrow', 'spire', 'star', 'tower', 'vessel', 'violin', 'wolf', 'archive', 'orbit', 'veil']

/** Human-friendly seed from arbitrary bytes, e.g. "cinder-lighthouse-417". */
export function seedFromBytes(b) {
  const n = ((b[2] << 8) | b[3]) % 900 + 100
  return `${WORDS_A[b[0] % WORDS_A.length]}-${WORDS_B[b[1] % WORDS_B.length]}-${n}`
}

export function randomSeed() {
  return seedFromBytes(crypto.getRandomValues(new Uint8Array(4)))
}

export async function deriveRoom(token) {
  const enc = new TextEncoder()
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('storyweave/v1/room/' + token)))
  return {
    token,
    roomId: 'sw1-' + toHex(digest.subarray(0, 16)),
    roomTag: digest.subarray(16, 20), // 4 bytes stamped on every wire frame
    password: token,
    defaultSeed: seedFromBytes(digest.subarray(20, 24)),
  }
}
