import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { SyncEngine } from '../src/collaboration/sync.js'
import { MemoryHub } from '../src/collaboration/transports.js'
import { encode, MSG } from '../src/collaboration/protocol.js'

const tag = new Uint8Array([7, 7, 7, 7])
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms))

function peer(hub, id) {
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  const sync = new SyncEngine({ doc, awareness, roomId: 'r', roomTag: tag, password: 'p', localPeerId: id })
  return { doc, awareness, sync, start: () => sync.setTransport(hub.transport()) }
}

describe('sync engine', () => {
  it('converges concurrent edits and late joiners with offline state', async () => {
    const hub = new MemoryHub()
    const a = peer(hub, 'a'), b = peer(hub, 'b'), c = peer(hub, 'c')
    await a.start(); await b.start()
    a.doc.getText('t').insert(0, 'Hello ')
    b.doc.getText('t').insert(0, 'World ')
    c.doc.getText('t').insert(0, 'Offline ') // edits before joining
    await tick()
    await c.start()
    await tick(50)
    const texts = [a, b, c].map(p => p.doc.getText('t').toString())
    expect(new Set(texts).size).toBe(1)
    expect(texts[0]).toContain('Offline')
    expect(texts[0]).toContain('Hello')
  })

  it('disconnected peer rejoins and converges', async () => {
    const hub = new MemoryHub()
    const a = peer(hub, 'a'), b = peer(hub, 'b')
    await a.start(); await b.start()
    await b.sync.stop()
    a.doc.getMap('m').set('x', 1)
    b.doc.getMap('m').set('y', 2)
    await tick()
    await b.start()
    await tick(50)
    expect(a.doc.getMap('m').toJSON()).toEqual({ x: 1, y: 2 })
    expect(b.doc.getMap('m').toJSON()).toEqual({ x: 1, y: 2 })
  })

  it('tolerates duplicate and out-of-order updates', () => {
    const src = new Y.Doc()
    const updates = []
    src.on('update', u => updates.push(u))
    for (let i = 0; i < 20; i++) src.getText('t').insert(i, String(i % 10))
    const dst = new Y.Doc()
    const shuffled = [...updates, ...updates].reverse()
    for (const u of shuffled) Y.applyUpdate(dst, u)
    expect(dst.getText('t').toString()).toBe(src.getText('t').toString())
  })

  it('ignores malformed frames from a hostile peer without throwing', async () => {
    const hub = new MemoryHub()
    const a = peer(hub, 'a')
    await a.start()
    const t = hub.transport()
    t.start({ localPeerId: 'evil', onMessage() {} })
    t.send(new Uint8Array([1, 2, 3]))
    t.send(encode(MSG.YJS_UPDATE, tag, new Uint8Array([255, 255, 255, 255, 1, 2])))
    t.send(encode(MSG.AWARENESS, tag, new Uint8Array([9, 9, 9])))
    await tick()
    expect(a.sync.dropped).toBeGreaterThanOrEqual(2)
    a.doc.getText('t').insert(0, 'still fine')
    expect(a.doc.getText('t').toString()).toBe('still fine')
  })
})
