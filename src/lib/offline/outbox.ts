/**
 * The offline write queue (PLAN.md §8).
 *
 * Logging a set has to work in a basement gym with no signal and survive a
 * refresh, so every write goes into this queue first and reaches Supabase when
 * it can. The queue logic is pure and storage is injected, which keeps the
 * conflict rules testable without a browser and lets the same code run over
 * IndexedDB in the app and over a map in tests.
 */

export type OutboxKind = 'set_log' | 'session_log' | 'run_log' | 'readiness'

export interface OutboxEntry<TPayload = unknown> {
  id: string
  kind: OutboxKind
  /**
   * Identifies the thing being written, not the write itself. Two edits to the
   * same set share a key, so only the later one is ever sent.
   */
  key: string
  payload: TPayload
  /** Client clock, milliseconds. Used only to order writes to the same key. */
  updatedAt: number
  attempts: number
}

export interface OutboxStorage {
  getAll(): Promise<OutboxEntry[]>
  put(entry: OutboxEntry): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

/** The dedupe key for a logged set — matches the unique index in Postgres. */
export function setLogKey(sessionLogId: string, exerciseId: string, setIndex: number): string {
  return `set:${sessionLogId}:${exerciseId}:${setIndex}`
}

export function sessionLogKey(date: string): string {
  return `session:${date}`
}

/**
 * Collapses a queue to one entry per key, keeping the most recent.
 *
 * Tapping a weight four times while correcting it should send one write, not
 * four, and the one that arrives should be the last thing the athlete typed.
 */
export function collapseByKey(entries: readonly OutboxEntry[]): OutboxEntry[] {
  const latest = new Map<string, OutboxEntry>()

  for (const entry of entries) {
    const existing = latest.get(entry.key)
    if (existing === undefined || entry.updatedAt >= existing.updatedAt) {
      latest.set(entry.key, entry)
    }
  }

  // Oldest first, so the server sees writes in the order they were made.
  return [...latest.values()].sort((a, b) => a.updatedAt - b.updatedAt)
}

export interface RemoteRecord {
  key: string
  updatedAt: number
}

/**
 * Whether a queued write should still be sent, given what the server already
 * holds for that key.
 *
 * A set logged offline must never overwrite a newer online log of the same set
 * (PLAN.md §8): if the athlete corrected it on their phone while the laptop was
 * offline, the phone's value is the one they meant.
 */
export function shouldSend(entry: OutboxEntry, remote: RemoteRecord | undefined): boolean {
  if (remote === undefined) return true
  return entry.updatedAt > remote.updatedAt
}

/** Exponential backoff, capped so a long outage does not park the queue forever. */
export const MAX_ATTEMPTS = 8
const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 5 * 60 * 1000

export function nextBackoffMs(attempts: number): number {
  if (attempts <= 0) return 0
  return Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS)
}

/** True once a write has failed so often that it needs a person to look at it. */
export function isExhausted(entry: OutboxEntry): boolean {
  return entry.attempts >= MAX_ATTEMPTS
}

export class Outbox {
  constructor(private readonly storage: OutboxStorage) {}

  async enqueue<TPayload>(
    entry: Omit<OutboxEntry<TPayload>, 'id' | 'attempts'> & { id?: string },
  ): Promise<OutboxEntry<TPayload>> {
    const stored: OutboxEntry<TPayload> = {
      id: entry.id ?? `${entry.key}@${entry.updatedAt}`,
      kind: entry.kind,
      key: entry.key,
      payload: entry.payload,
      updatedAt: entry.updatedAt,
      attempts: 0,
    }

    await this.storage.put(stored as OutboxEntry)
    return stored
  }

  /** Everything waiting to go, collapsed and in the order it was written. */
  async pending(): Promise<OutboxEntry[]> {
    return collapseByKey(await this.storage.getAll())
  }

  /**
   * Drops every queued write for a key once it lands, including the superseded
   * ones that collapsing hid — otherwise a stale edit would resurface after the
   * next reload.
   */
  async markSent(key: string): Promise<void> {
    const all = await this.storage.getAll()
    await Promise.all(all.filter((entry) => entry.key === key).map((entry) => this.storage.remove(entry.id)))
  }

  async markFailed(id: string): Promise<OutboxEntry | undefined> {
    const all = await this.storage.getAll()
    const entry = all.find((candidate) => candidate.id === id)
    if (entry === undefined) return undefined

    const updated = { ...entry, attempts: entry.attempts + 1 }
    await this.storage.put(updated)
    return updated
  }

  async clear(): Promise<void> {
    await this.storage.clear()
  }
}

/** In-memory storage: used by tests, and as the fallback where IndexedDB is blocked. */
export function createMemoryStorage(): OutboxStorage {
  const entries = new Map<string, OutboxEntry>()

  return {
    async getAll() {
      return [...entries.values()]
    },
    async put(entry) {
      entries.set(entry.id, entry)
    },
    async remove(id) {
      entries.delete(id)
    },
    async clear() {
      entries.clear()
    },
  }
}
