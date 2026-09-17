import { describe, expect, it } from 'vitest'
import { deloadWeeks, phaseParameters, weekPhase } from '../periodization'
import {
  MAX_SESSION_ADJUSTMENT,
  nextSetMultiplier,
  readinessAdjustment,
  readinessScore,
} from '../autoregulation'
import { createRng, hashSeed, planSeed } from '../rng'

describe('weekPhase', () => {
  it('runs calibration, build, intensify, deload through a four-week block', () => {
    expect([1, 2, 3, 4].map((week) => weekPhase(week, 4))).toEqual([
      'calibration',
      'build',
      'intensify',
      'deload',
    ])
  })

  it('repeats the microcycle across an eight-week block', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((week) => weekPhase(week, 8))).toEqual([
      'calibration',
      'build',
      'intensify',
      'deload',
      'calibration',
      'build',
      'intensify',
      'deload',
    ])
  })

  it('always deloads the final week, even out of cycle', () => {
    // Week 6 is not a multiple of 4, but it ends the block.
    expect(weekPhase(6, 6)).toBe('deload')
    expect(deloadWeeks(6)).toEqual([4, 6])
  })

  it('places deloads correctly for every supported block length', () => {
    expect(deloadWeeks(4)).toEqual([4])
    expect(deloadWeeks(8)).toEqual([4, 8])
    expect(deloadWeeks(12)).toEqual([4, 8, 12])
  })

  it('rejects a week outside the block', () => {
    expect(() => weekPhase(0, 8)).toThrow(RangeError)
    expect(() => weekPhase(9, 8)).toThrow(RangeError)
  })
})

describe('phaseParameters', () => {
  it('raises RPE from calibration through to intensify', () => {
    expect(phaseParameters(1, 8).rpeTarget).toBeLessThan(phaseParameters(2, 8).rpeTarget)
    expect(phaseParameters(2, 8).rpeTarget).toBeLessThan(phaseParameters(3, 8).rpeTarget)
  })

  it('cuts both volume and load in a deload', () => {
    const deload = phaseParameters(4, 8)

    expect(deload.volumeMultiplier).toBeLessThan(1)
    expect(deload.loadMultiplier).toBeLessThan(1)
    expect(deload.rpeTarget).toBeLessThan(7)
    expect(deload.intensityTechnique).toBe(false)
  })

  it('only uses intensity techniques in the intensify week', () => {
    expect(phaseParameters(3, 8).intensityTechnique).toBe(true)
    for (const week of [1, 2, 4]) {
      expect(phaseParameters(week, 8).intensityTechnique).toBe(false)
    }
  })

  it('returns message keys, never prose', () => {
    for (const week of [1, 2, 3, 4]) {
      expect(phaseParameters(week, 8).messageKey).toMatch(/^coach\.phase\.[a-z]+$/)
    }
  })
})

describe('within-session autoregulation', () => {
  it('leaves the load alone when RPE is close to target', () => {
    expect(nextSetMultiplier({ loggedRpe: 8, targetRpe: 8 }).multiplier).toBe(1)
    expect(nextSetMultiplier({ loggedRpe: 9, targetRpe: 8 }).multiplier).toBe(1)
  })

  it('backs off 5% when a set was much harder than asked', () => {
    expect(nextSetMultiplier({ loggedRpe: 9.5, targetRpe: 8 }).multiplier).toBeCloseTo(0.95, 9)
  })

  it('adds 5% when a set was much easier than asked', () => {
    expect(nextSetMultiplier({ loggedRpe: 6, targetRpe: 8 }).multiplier).toBeCloseTo(1.05, 9)
  })

  it('clamps cumulative drift so one bad entry cannot spiral', () => {
    let cumulative = 0
    for (let i = 0; i < 10; i += 1) {
      cumulative = nextSetMultiplier(
        { loggedRpe: 10, targetRpe: 6 },
        cumulative,
      ).cumulativeAdjustment
    }

    expect(cumulative).toBeCloseTo(-MAX_SESSION_ADJUSTMENT, 9)
    expect(nextSetMultiplier({ loggedRpe: 10, targetRpe: 6 }, cumulative).multiplier).toBeCloseTo(
      1 - MAX_SESSION_ADJUSTMENT,
      9,
    )
  })

  it('can recover upwards after backing off', () => {
    const down = nextSetMultiplier({ loggedRpe: 10, targetRpe: 8 }).cumulativeAdjustment
    const back = nextSetMultiplier({ loggedRpe: 6, targetRpe: 8 }, down)

    expect(back.cumulativeAdjustment).toBeCloseTo(0, 9)
  })
})

describe('readiness', () => {
  it('sums the three answers', () => {
    expect(readinessScore({ sleep: 4, soreness: 3, energy: 5 })).toBe(12)
  })

  it('leaves a good day untouched', () => {
    const adjustment = readinessAdjustment({ sleep: 4, soreness: 4, energy: 4 })

    expect(adjustment.loadMultiplier).toBe(1)
    expect(adjustment.dropLastAccessory).toBe(false)
  })

  it('trims a middling day slightly', () => {
    expect(readinessAdjustment({ sleep: 3, soreness: 3, energy: 3 }).loadMultiplier).toBe(0.95)
  })

  it('shortens a bad day rather than cancelling it', () => {
    const adjustment = readinessAdjustment({ sleep: 2, soreness: 2, energy: 2 })

    expect(adjustment.loadMultiplier).toBe(0.9)
    expect(adjustment.dropLastAccessory).toBe(true)
    // Still a session — a trimmed session beats a skipped one.
    expect(adjustment.loadMultiplier).toBeGreaterThan(0)
  })

  it('returns message keys, never prose', () => {
    for (const score of [15, 10, 4]) {
      const readiness = { sleep: score / 3, soreness: score / 3, energy: score / 3 }
      expect(readinessAdjustment(readiness).messageKey).toMatch(/^coach\.readiness\.[a-z]+$/)
    }
  })
})

describe('deterministic RNG', () => {
  it('produces the same stream for the same seed', () => {
    const a = createRng('user-1:1')
    const b = createRng('user-1:1')

    expect(Array.from({ length: 8 }, () => a.next())).toEqual(
      Array.from({ length: 8 }, () => b.next()),
    )
  })

  it('produces different streams for different blocks', () => {
    const first = createRng(planSeed('user-1', 1)).next()
    const second = createRng(planSeed('user-1', 2)).next()

    expect(first).not.toBe(second)
  })

  it('produces different streams for different athletes', () => {
    expect(createRng(planSeed('user-1', 1)).next()).not.toBe(
      createRng(planSeed('user-2', 1)).next(),
    )
  })

  it('shuffles deterministically without losing or duplicating items', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f']
    const once = createRng('seed').shuffle(items)
    const twice = createRng('seed').shuffle(items)

    expect(once).toEqual(twice)
    expect([...once].sort()).toEqual([...items].sort())
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e', 'f']) // input untouched
  })

  it('stays in range', () => {
    const rng = createRng('range')
    for (let i = 0; i < 500; i += 1) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
      expect(rng.nextInt(7)).toBeLessThan(7)
    }
  })

  it('hashes seeds stably', () => {
    expect(hashSeed('user-1:1')).toBe(hashSeed('user-1:1'))
    expect(hashSeed('user-1:1')).not.toBe(hashSeed('user-1:2'))
  })

  it('refuses to pick from nothing rather than returning undefined', () => {
    expect(() => createRng('x').pick([])).toThrow(RangeError)
  })
})
