// Project backup / restore. Backups are untrusted input on import.
import * as Y from 'yjs'
import { bytesToB64, b64ToBytes } from '../util/bytes.js'
import { SCHEMA_VERSION, LIMITS, S } from '../collaboration/doc.js'

export function makeBackup(doc) {
  return JSON.stringify({
    format: 'storyweave-project',
    formatVersion: 1,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    roomLabel: S(doc).title.toString().slice(0, 200),
    yjsUpdateBase64: bytesToB64(Y.encodeStateAsUpdate(doc)),
  }, null, 1)
}

/** Validate a backup file's text. Returns the Yjs update bytes or throws a user-readable Error. */
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > LIMITS.importBytes * 1.4) throw new Error('File is too large.')
  let data
  try { data = JSON.parse(text) } catch { throw new Error('Not a StoryWeave backup (invalid JSON).') }
  if (!data || typeof data !== 'object' || data.format !== 'storyweave-project') throw new Error('Not a StoryWeave backup.')
  if (data.formatVersion !== 1) throw new Error('Unsupported backup format version.')
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion > SCHEMA_VERSION) throw new Error('This backup was made by a newer StoryWeave.')
  if (typeof data.yjsUpdateBase64 !== 'string') throw new Error('Backup is missing story data.')
  let bytes
  try { bytes = b64ToBytes(data.yjsUpdateBase64) } catch { throw new Error('Backup story data is corrupted.') }
  if (bytes.length > LIMITS.importBytes) throw new Error('Backup exceeds the 20 MB limit.')
  // trial-apply to a scratch doc to make sure it parses
  try { Y.applyUpdate(new Y.Doc(), bytes) } catch { throw new Error('Backup story data could not be read.') }
  return bytes
}
