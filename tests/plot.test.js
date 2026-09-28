import { describe, it, expect } from 'vitest'
import { CATALOG, buildOutline } from '../src/story-engine/catalog.js'
import { CAMPBELL_STAGES, ROLE_TO_CAMPBELL } from '../src/story-engine/campbell.js'

const ingredients = [
  { promptId: 'a', answer: 'Oona, a lighthouse keeper who lies', tags: ['protagonist', 'flaw'], question: 'q' },
  { promptId: 'b', answer: 'The Harbour Authority', tags: ['antagonist'], question: 'q' },
  { promptId: 'c', answer: 'The lamp goes dark on the longest night', tags: ['inciting-incident'], question: 'q' },
]

describe('plot catalog', () => {
  it('has 300 unique variants (>= 200 required)', () => {
    expect(CATALOG.length).toBe(300)
    expect(new Set(CATALOG.map(v => v.id)).size).toBe(300)
  })
  it('every variant resolves to a valid 12-beat outline', () => {
    for (const v of CATALOG) {
      const o = buildOutline({ seed: 's', variantId: v.id, ingredients })
      expect(o.beats).toHaveLength(12)
      o.beats.forEach((b, i) => {
        expect(b.ordinal).toBe(i)
        expect(b.label && b.purpose && b.guidance).toBeTruthy()
        expect([-2, -1, 0, 1, 2]).toContain(b.fortune)
        expect(b.campbell.length).toBeGreaterThan(0)
      })
    }
  })
  it('is deterministic and never mutates source answers', () => {
    const copy = structuredClone(ingredients)
    const a = buildOutline({ seed: 's', variantId: CATALOG[42].id, ingredients })
    const b = buildOutline({ seed: 's', variantId: CATALOG[42].id, ingredients })
    expect(JSON.stringify(a.beats)).toBe(JSON.stringify(b.beats))
    expect(ingredients).toEqual(copy)
  })
  it('maps every Campbell stage onto at least one beat', () => {
    const used = new Set(ROLE_TO_CAMPBELL.flat())
    for (const s of CAMPBELL_STAGES) expect(used.has(s.id)).toBe(true)
    expect(CAMPBELL_STAGES.filter(s => s.phase !== 'Prelude')).toHaveLength(17)
  })
})
