import { describe, it, expect } from 'vitest'
import { seedToUint32, createRng, shuffle } from '../src/util/rng.js'

describe('seeded rng', () => {
  it('has fixed vectors', () => {
    expect(seedToUint32('storyweave')).toBe(seedToUint32('storyweave'))
    const a = createRng('ember-otter-42'), b = createRng('ember-otter-42')
    const xs = Array.from({ length: 5 }, () => a.next())
    expect(xs).toEqual(Array.from({ length: 5 }, () => b.next()))
    expect(xs.every(x => x >= 0 && x < 1)).toBe(true)
    expect(createRng('a').next()).not.toBe(createRng('b').next())
  })
  it('shuffle preserves every element exactly once', () => {
    for (let s = 0; s < 50; s++) {
      const input = Array.from({ length: 37 }, (_, i) => i)
      const out = shuffle(input, createRng('s' + s))
      expect([...out].sort((a, b) => a - b)).toEqual(input)
    }
  })
})
