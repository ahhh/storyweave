// Seeded, deterministic randomness. Story generation must never use Math.random().

/** Hash any string to an unsigned 32-bit integer (FNV-1a + murmur3 finalizer). */
export function seedToUint32(seed) {
  let h = 2166136261 >>> 0
  const s = String(seed)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** mulberry32 PRNG seeded from a string. */
export function createRng(seed) {
  let a = seedToUint32(seed)
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: n => Math.floor(next() * n),
  }
}

/** Fisher–Yates on a copy. */
export function shuffle(items, rng) {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function pick(items, rng) {
  if (!items.length) return undefined
  return items[rng.int(items.length)]
}

/** Stable sub-seed naming, e.g. subSeed(seed, 'beat', id). */
export const subSeed = (seed, ...parts) => [seed, ...parts].join('/')
