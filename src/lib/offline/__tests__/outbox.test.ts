import { describe, expect, it } from 'vitest'
import {
  collapseByKey,
  createMemoryStorage,
  isExhausted,
  MAX_ATTEMPTS,
  nextBackoffMs,
  Outbox,
  setLogKey,
  shouldSend,
  type OutboxEntry,
} from '../outbox'

function entry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    id: 'e1',
    kind: 'set_log',
    key: 'set:s1:back_squat:0',
    payload: { kg: 60, reps: 8, rpe: 8 },
    updatedAt: 1000,
    attempts: 0,
    ...overrides,
  }
}

describe('setLogKey', () => {
  it('identifies a set the same way the database unique index does', () => {
    expect(setLogKey('s1', 'back_squat', 0)).toBe('set:s1:back_squat:0')
    expect(setLogKey('s1', 'back_squat', 1)).not.toBe(setLogKey('s1', 'back_squat', 0))
  })
})

describe('collapseByKey', () => {
  it('keeps only the latest write for a key', () => {
    const collapsed = collapseByKey([
      entry({ id: 'a', updatedAt: 1000, payload: { kg: 60 } }),
      entry({ id: 'b', updatedAt: 2000, payload: { kg: 62.5 } }),
      entry({ id: 'c', updatedAt: 1500, payload: { kg: 61 } }),
    ])

    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]!.payload).toEqual({ kg: 62.5 })
  })

  it('keeps separate keys separate', () => {
    const collapsed = collapseByKey([
      entry({ id: 'a', key: 'set:s1:squat:0' }),
      entry({ id: 'b', key: 'set:s1:squat:1' }),
    ])

    expect(collapsed).toHaveLength(2)
  })

  it('returns writes oldest first so the server sees them in order', () => {
    const collapsed = collapseByKey([
      entry({ id: 'a', key: 'k2', updatedAt: 3000 }),
      entry({ id: 'b', key: 'k1', updatedAt: 1000 }),
    ])

    expect(collapsed.map((e) => e.key)).toEqual(['k1', 'k2'])
  })

  it('handles an empty queue', () => {
    expect(collapseByKey([])).toEqual([])
  })
})

describe('shouldSend', () => {
  it('sends when the server has nothing', () => {
    expect(shouldSend(entry({ updatedAt: 1000 }), undefined)).toBe(true)
  })

  it('sends when the queued write is newer', () => {
    expect(shouldSend(entry({ updatedAt: 2000 }), { key: 'k', updatedAt: 1000 })).toBe(true)
  })

  // The rule that matters: a correction made on another device wins.
  it('does not overwrite a newer online log of the same set', () => {
    expect(shouldSend(entry({ updatedAt: 1000 }), { key: 'k', updatedAt: 2000 })).toBe(false)
  })

  it('does not resend a write the server already has at the same moment', () => {
    expect(shouldSend(entry({ updatedAt: 1000 }), { key: 'k', updatedAt: 1000 })).toBe(false)
  })
})

describe('backoff', () => {
  it('grows exponentially from the first failure', () => {
    expect(nextBackoffMs(0)).toBe(0)
    expect(nextBackoffMs(1)).toBe(1000)
    expect(nextBackoffMs(2)).toBe(2000)
    expect(nextBackoffMs(3)).toBe(4000)
  })

  it('caps so a long outage does not park the queue for hours', () => {
    expect(nextBackoffMs(20)).toBe(5 * 60 * 1000)
  })

  it('never decreases', () => {
    for (let attempts = 1; attempts < 15; attempts += 1) {
      expect(nextBackoffMs(attempts + 1)).toBeGreaterThanOrEqual(nextBackoffMs(attempts))
    }
  })

  it('flags a write that has failed too often', () => {
    expect(isExhausted(entry({ attempts: MAX_ATTEMPTS - 1 }))).toBe(false)
    expect(isExhausted(entry({ attempts: MAX_ATTEMPTS }))).toBe(true)
  })
})

describe('Outbox', () => {
  it('queues a write and reports it as pending', async () => {
    const outbox = new Outbox(createMemoryStorage())
    await outbox.enqueue({
      kind: 'set_log',
      key: setLogKey('s1', 'back_squat', 0),
      payload: { kg: 60 },
      updatedAt: 1000,
    })

    const pending = await outbox.pending()
    expect(pending).toHaveLength(1)
    expect(pending[0]!.attempts).toBe(0)
  })

  it('collapses repeated edits to the same set into one write', async () => {
    const outbox = new Outbox(createMemoryStorage())
    const key = setLogKey('s1', 'back_squat', 0)

    for (const [i, kg] of [60, 62.5, 65].entries()) {
      await outbox.enqueue({ kind: 'set_log', key, payload: { kg }, updatedAt: 1000 + i })
    }

    const pending = await outbox.pending()
    expect(pending).toHaveLength(1)
    expect(pending[0]!.payload).toEqual({ kg: 65 })
  })

  it('removes superseded writes too, so a stale edit cannot resurface', async () => {
    const storage = createMemoryStorage()
    const outbox = new Outbox(storage)
    const key = setLogKey('s1', 'back_squat', 0)

    await outbox.enqueue({ kind: 'set_log', key, payload: { kg: 60 }, updatedAt: 1000 })
    await outbox.enqueue({ kind: 'set_log', key, payload: { kg: 65 }, updatedAt: 2000 })

    await outbox.markSent(key)

    expect(await storage.getAll()).toEqual([])
    expect(await outbox.pending()).toEqual([])
  })

  it('leaves other keys alone when one is sent', async () => {
    const outbox = new Outbox(createMemoryStorage())

    await outbox.enqueue({
      kind: 'set_log',
      key: setLogKey('s1', 'squat', 0),
      payload: {},
      updatedAt: 1000,
    })
    await outbox.enqueue({
      kind: 'set_log',
      key: setLogKey('s1', 'squat', 1),
      payload: {},
      updatedAt: 1001,
    })

    await outbox.markSent(setLogKey('s1', 'squat', 0))

    const pending = await outbox.pending()
    expect(pending).toHaveLength(1)
    expect(pending[0]!.key).toBe(setLogKey('s1', 'squat', 1))
  })

  it('counts failures so the caller can back off', async () => {
    const outbox = new Outbox(createMemoryStorage())
    const queued = await outbox.enqueue({
      kind: 'set_log',
      key: 'k',
      payload: {},
      updatedAt: 1000,
    })

    const first = await outbox.markFailed(queued.id)
    expect(first?.attempts).toBe(1)

    const second = await outbox.markFailed(queued.id)
    expect(second?.attempts).toBe(2)
    expect(nextBackoffMs(second!.attempts)).toBe(2000)
  })

  it('keeps a failed write queued rather than dropping it', async () => {
    const outbox = new Outbox(createMemoryStorage())
    const queued = await outbox.enqueue({
      kind: 'set_log',
      key: 'k',
      payload: { kg: 60 },
      updatedAt: 1000,
    })

    await outbox.markFailed(queued.id)

    const pending = await outbox.pending()
    expect(pending).toHaveLength(1)
    expect(pending[0]!.payload).toEqual({ kg: 60 })
  })

  it('reports nothing for an unknown id rather than throwing', async () => {
    const outbox = new Outbox(createMemoryStorage())
    expect(await outbox.markFailed('nope')).toBeUndefined()
  })

  it('survives a reload: what was queued is still queued', async () => {
    const storage = createMemoryStorage()

    const before = new Outbox(storage)
    await before.enqueue({
      kind: 'set_log',
      key: setLogKey('s1', 'squat', 0),
      payload: { kg: 60, reps: 8, rpe: 8 },
      updatedAt: 1000,
    })

    // A new instance over the same storage is what a page refresh looks like.
    const after = new Outbox(storage)
    const pending = await after.pending()

    expect(pending).toHaveLength(1)
    expect(pending[0]!.payload).toEqual({ kg: 60, reps: 8, rpe: 8 })
  })
})
