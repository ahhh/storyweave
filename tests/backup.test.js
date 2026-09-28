import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { makeBackup, parseBackup } from '../src/export/backup.js'

describe('backup', () => {
  it('round-trips document state', () => {
    const doc = new Y.Doc()
    doc.getText('title').insert(0, 'Hi')
    doc.getXmlFragment('story').insert(0, [new Y.XmlElement('paragraph')])
    const bytes = parseBackup(makeBackup(doc))
    const copy = new Y.Doc()
    Y.applyUpdate(copy, bytes)
    expect(copy.getText('title').toString()).toBe('Hi')
    expect(copy.getXmlFragment('story').length).toBe(1)
  })
  it('rejects hostile input with readable errors', () => {
    expect(() => parseBackup('not json')).toThrow(/invalid JSON/)
    expect(() => parseBackup('{}')).toThrow(/Not a StoryWeave/)
    expect(() => parseBackup(JSON.stringify({ format: 'storyweave-project', formatVersion: 1, schemaVersion: 99, yjsUpdateBase64: '' }))).toThrow(/newer/)
    expect(() => parseBackup(JSON.stringify({ format: 'storyweave-project', formatVersion: 1, schemaVersion: 1, yjsUpdateBase64: '<script>' }))).toThrow(/corrupted/)
  })
})
