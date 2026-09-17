import { createIndexedDbStorage, isIndexedDbAvailable } from './indexeddb'
import { createMemoryStorage, Outbox, type OutboxStorage } from './outbox'

export * from './outbox'
export { isIndexedDbAvailable } from './indexeddb'

/**
 * The outbox for this device.
 *
 * Falls back to memory when IndexedDB is missing or blocked: the queue then
 * lasts only for the session, which is a real loss but a much smaller one than
 * refusing to let someone log their workout at all.
 */
export function createOutbox(): Outbox {
  let storage: OutboxStorage

  if (isIndexedDbAvailable()) {
    try {
      storage = createIndexedDbStorage()
    } catch {
      storage = createMemoryStorage()
    }
  } else {
    storage = createMemoryStorage()
  }

  return new Outbox(storage)
}
