import { openDB, type IDBPDatabase } from 'idb'
import type { OutboxEntry, OutboxStorage } from './outbox'

/**
 * IndexedDB storage for the outbox.
 *
 * Every call is guarded: IndexedDB is unavailable in server rendering, and it
 * throws rather than returning empty in a private window or with site data
 * blocked. A logging screen that crashes because storage is disabled is worse
 * than one that quietly keeps the queue in memory for the session.
 */
// Named before the app was called Hyex. Renaming the database would orphan
// any sets a phone logged offline and has not yet synced, so it stays.
const DB_NAME = 'plates-and-pace'
const STORE = 'outbox'
const VERSION = 1

let database: Promise<IDBPDatabase> | null = null

function connect(): Promise<IDBPDatabase> {
  database ??= openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('key', 'key')
      }
    },
  })
  return database
}

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined'
  } catch {
    return false
  }
}

export function createIndexedDbStorage(): OutboxStorage {
  return {
    async getAll() {
      const db = await connect()
      return (await db.getAll(STORE)) as OutboxEntry[]
    },
    async put(entry) {
      const db = await connect()
      await db.put(STORE, entry)
    },
    async remove(id) {
      const db = await connect()
      await db.delete(STORE, id)
    },
    async clear() {
      const db = await connect()
      await db.clear(STORE)
    },
  }
}
