import { describe, it, expect } from 'vitest'
import { encode, decode, MSG, HEADER } from '../src/collaboration/protocol.js'
import { createRng } from '../src/util/rng.js'

const tag = new Uint8Array([1, 2, 3, 4])

describe('wire protocol', () => {
  it('round-trips', () => {
    const payload = new Uint8Array([9, 8, 7])
    const m = decode(encode(MSG.YJS_UPDATE, tag, payload), tag)
    expect(m.type).toBe(MSG.YJS_UPDATE)
    expect([...m.payload]).toEqual([9, 8, 7])
  })
  it('rejects wrong room, bad magic, unknown type, oversize', () => {
    const f = encode(MSG.HELLO, tag, new Uint8Array(2))
    expect(decode(f, new Uint8Array([1, 2, 3, 5]))).toBeNull()
    const bad = f.slice(); bad[0] = 0
    expect(decode(bad, tag)).toBeNull()
    const unk = f.slice(); unk[2] = 200
    expect(decode(unk, tag)).toBeNull()
    expect(decode(encode(MSG.PING, tag, new Uint8Array(1000)), tag)).toBeNull()
    expect(decode('nope', tag)).toBeNull()
  })
  it('never throws on arbitrary bytes', () => {
    const rng = createRng('fuzz')
    for (let i = 0; i < 5000; i++) {
      const len = rng.int(64)
      const bytes = Uint8Array.from({ length: len }, () => rng.int(256))
      if (len > 3 && rng.next() < .5) { bytes[0] = 0x53; bytes[1] = 1; bytes.set(tag.subarray(0, Math.min(4, len - 3)), 3) }
      expect(() => decode(bytes, tag)).not.toThrow()
    }
    expect(HEADER).toBe(7)
  })
})
