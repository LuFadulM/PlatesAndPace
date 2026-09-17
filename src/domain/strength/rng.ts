/**
 * Deterministic pseudo-random numbers.
 *
 * Plan generation must be reproducible: the same athlete and the same block
 * number produce the same plan, every time, on any machine. That is what makes
 * "different profiles produce different plans" testable rather than anecdotal,
 * and it means regenerating a block never silently reshuffles an athlete's week.
 *
 * Math.random is therefore banned everywhere in the engine — every tiebreak
 * goes through a seeded generator.
 */

/** FNV-1a. Small, fast, and stable across runtimes — which is the requirement. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export interface Rng {
  /** Next value in [0, 1). */
  next(): number
  /** Integer in [0, bound). */
  nextInt(bound: number): number
  /** A copy of `items` in a deterministic shuffled order. */
  shuffle<T>(items: readonly T[]): T[]
  /** One of `items`, deterministically. */
  pick<T>(items: readonly T[]): T
}

/** mulberry32 — good distribution for this purpose, and tiny. */
export function createRng(seed: string | number): Rng {
  let state = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 1

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const nextInt = (bound: number): number => {
    if (bound <= 0) throw new RangeError('bound must be positive')
    return Math.floor(next() * bound)
  }

  return {
    next,
    nextInt,
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items]
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = nextInt(i + 1)
        ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
      }
      return copy
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('cannot pick from an empty list')
      return items[nextInt(items.length)]!
    },
  }
}

/** The canonical seed for a block, so regeneration is idempotent. */
export function planSeed(userId: string, block: number): string {
  return `${userId}:${block}`
}
