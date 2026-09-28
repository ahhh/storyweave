import { describe, it, expect } from 'vitest'
import { generatePrompts, selectTemplates, assign } from '../src/prompts/generate.js'
import { PROMPT_TEMPLATES } from '../src/prompts/library.js'

describe('prompt generation', () => {
  it('library has at least 75 unique templates', () => {
    expect(PROMPT_TEMPLATES.length).toBeGreaterThanOrEqual(75)
    expect(new Set(PROMPT_TEMPLATES.map(t => t.id)).size).toBe(PROMPT_TEMPLATES.length)
  })
  it('is deterministic for seed + roster + count + mode', () => {
    const args = { seed: 'x', count: 12, mode: 'shuffle', rosterIds: ['a', 'b', 'c'], batch: 1, selfId: 'a', idPrefix: 'q' }
    expect(generatePrompts(args)).toEqual(generatePrompts(args))
    expect(generatePrompts({ ...args, seed: 'y' })).not.toEqual(generatePrompts(args))
  })
  it('small decks cover the core slots', () => {
    const tags = new Set(selectTemplates({ seed: 'core', count: 6 }).flatMap(t => t.slotTags))
    for (const t of ['protagonist', 'antagonist', 'stakes', 'inciting-incident', 'climax']) expect(tags.has(t)).toBe(true)
  })
  it('avoids self-assignment with 2+ writers', () => {
    for (const mode of ['round-robin', 'cross-room', 'shuffle']) {
      for (const n of [2, 3, 5, 12]) {
        const ids = Array.from({ length: n }, (_, i) => 'p' + i)
        for (const p of assign({ seed: 's', rosterIds: ids, count: 30, mode })) expect(p.fromId).not.toBe(p.toId)
      }
    }
  })
})
