// Local (per-browser) identity. Not authenticated: display names are labels, not proof.
import { randomId } from '../util/bytes.js'
import { cleanLabel } from '../util/dom.js'

const KEY = 'storyweave:identity'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}

export function getIdentity() {
  let id = load()
  if (!id || typeof id.id !== 'string') {
    id = { id: 'p-' + randomId(8), name: '', colorSeed: Math.floor(Math.random() * 360), symbol: '' }
    save(id)
  }
  id.name = cleanLabel(id.name, 32)
  return id
}

export function save(identity) {
  try { localStorage.setItem(KEY, JSON.stringify(identity)) } catch { /* private mode */ }
}

/** Hue (0–359) -> hex colour. Hex because y-prosemirror cursors only accept hex. */
export function colorFor(seed) {
  const hue = ((Number(seed) % 360) + 360) % 360
  const s = 0.62, l = 0.5
  const f = n => {
    const k = (n + hue / 30) % 12
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// ---- recent rooms (local convenience list; tokens stay on this device) ----
const ROOMS = 'storyweave:rooms'

export function recentRooms() {
  try {
    const list = JSON.parse(localStorage.getItem(ROOMS) || '[]')
    return Array.isArray(list) ? list.filter(r => r && typeof r.token === 'string') : []
  } catch { return [] }
}

export function rememberRoom(token, title) {
  const list = recentRooms().filter(r => r.token !== token)
  list.unshift({ token, title: cleanLabel(title, 80), openedAt: Date.now() })
  try { localStorage.setItem(ROOMS, JSON.stringify(list.slice(0, 30))) } catch {}
}

export function forgetRoom(token) {
  try { localStorage.setItem(ROOMS, JSON.stringify(recentRooms().filter(r => r.token !== token))) } catch {}
}
