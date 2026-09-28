// Local persistence: every room lives in its own IndexedDB database.
import * as Y from 'yjs'
import { IndexeddbPersistence, clearDocument, storeState } from 'y-indexeddb'

export const dbName = roomId => `storyweave::${location.origin}::${roomId}`

export function persist(roomId, doc) {
  const p = new IndexeddbPersistence(dbName(roomId), doc)
  const ready = new Promise(resolve => {
    p.once('synced', () => resolve(true))
    setTimeout(() => resolve(false), 4000) // IndexedDB blocked (e.g. some private modes)
  })
  return { provider: p, ready }
}

/** Write a Yjs update into a (new) room's local store, e.g. for import / duplicate. */
export async function seedRoom(roomId, update) {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, update)
  const p = new IndexeddbPersistence(dbName(roomId), doc)
  await p.whenSynced
  await storeState(p, true)
  await p.destroy()
  doc.destroy()
}

export async function forgetLocal(roomId) {
  await clearDocument(dbName(roomId))
}
