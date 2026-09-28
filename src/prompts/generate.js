// Deterministic prompt selection and sender→recipient assignment.
// Same seed + library version + roster order + count + mode + batch => same result.

import { createRng, shuffle, subSeed } from '../util/rng.js'
import { PROMPT_TEMPLATES, SLOT_TIERS, LIBRARY_VERSION } from './library.js'

export const ASSIGNMENT_MODES = [
  { id: 'round-robin', label: 'Round robin', hint: 'A asks B, B asks C, …' },
  { id: 'cross-room', label: 'Cross room', hint: 'Pairs people across the circle' },
  { id: 'shuffle', label: 'Seeded shuffle', hint: 'Deterministic random pairs' },
  { id: 'manual', label: 'Manual', hint: 'Everyone starts with their own; reassign freely' },
]

export const MIN_PROMPTS = 4
export const MAX_PROMPTS = 48

/** Pick `count` templates, filling core slots first, enriching as count grows. */
export function selectTemplates({ seed, count, batch = 0, exclude = [] }) {
  const rng = createRng(subSeed(seed, 'prompts', `v${LIBRARY_VERSION}`, batch))
  const n = Math.max(1, Math.min(MAX_PROMPTS, count | 0))
  const excluded = new Set(exclude)
  const pool = shuffle(PROMPT_TEMPLATES.filter(t => !excluded.has(t.id)), rng)
  const chosen = []
  const used = new Set()

  for (const tier of SLOT_TIERS) {
    for (const tag of shuffle(tier, rng)) {
      if (chosen.length >= n) break
      const t = pool.find(t => !used.has(t.id) && t.slotTags.includes(tag))
      if (t) { chosen.push(t); used.add(t.id) }
    }
  }
  for (const t of pool) {
    if (chosen.length >= n) break
    if (!used.has(t.id)) { chosen.push(t); used.add(t.id) }
  }
  return chosen
}

/** Returns [{fromId, toId}] of length count. Avoids self-assignment when there are 2+ people. */
export function assign({ seed, rosterIds, count, mode, batch = 0, selfId }) {
  const ids = rosterIds.length ? rosterIds : [selfId]
  const n = ids.length
  const rng = createRng(subSeed(seed, 'assignments', mode, batch))
  const out = []
  for (let i = 0; i < count; i++) {
    const from = ids[i % n]
    let to
    if (n === 1) to = from
    else if (mode === 'round-robin') to = ids[(i + 1) % n]
    else if (mode === 'cross-room') {
      const offset = Math.max(1, Math.floor(n / 2)) + Math.floor(i / n) % Math.max(1, n - 1)
      to = ids[(i % n + offset) % n]
      if (to === from) to = ids[(i + 1) % n]
    } else if (mode === 'shuffle') {
      const others = ids.filter(x => x !== from)
      to = others[rng.int(others.length)]
    } else {
      to = selfId && ids.includes(selfId) ? selfId : from
      out.push({ fromId: to, toId: to })
      continue
    }
    out.push({ fromId: from, toId: to })
  }
  return out
}

export function generatePrompts({ seed, count, mode, rosterIds, batch, selfId, exclude, idPrefix }) {
  const templates = selectTemplates({ seed, count, batch, exclude })
  const pairs = assign({ seed, rosterIds, count: templates.length, mode, batch, selfId })
  return templates.map((t, i) => ({
    id: `${idPrefix}-${batch}-${i}`,
    templateId: t.id,
    category: t.category,
    slotTags: t.slotTags,
    question: t.question,
    ...pairs[i],
  }))
}
