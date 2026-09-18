import { describe, expect, it } from 'vitest'
import { resolveRunPaces } from '../resolve'
import type { RunSession } from '../generator'
import { trainingPaces } from '../../running'

const slow = trainingPaces({ km: 5, seconds: 30 * 60 })
const fast = trainingPaces({ km: 5, seconds: 24 * 60 })

const run = (over: Partial<RunSession> & { kind: RunSession['kind'] }): RunSession => ({
  titleKey: 't', intentKey: 'i', minutes: 40, km: 6, paceSecPerKm: slow.easy, hrZone: 2, hardMinutes: 0, ...over,
})

describe('resolveRunPaces', () => {
  it('leaves the session alone when there are no paces to work from', () => {
    const easy = run({ kind: 'easy' })
    expect(resolveRunPaces(easy, null)).toBe(easy)
  })

  it('keeps an easy run at its duration and covers more ground as the athlete improves', () => {
    const before = resolveRunPaces(run({ kind: 'easy', minutes: 40 }), slow)
    const after = resolveRunPaces(run({ kind: 'easy', minutes: 40 }), fast)
    expect(after.minutes).toBe(40)
    expect(after.km).toBeGreaterThan(before.km)
    expect(after.paceSecPerKm).toBe(fast.easy)
  })

  it('keeps a long run at its distance and finishes it sooner', () => {
    const before = resolveRunPaces(run({ kind: 'long', km: 14, minutes: 100 }), slow)
    const after = resolveRunPaces(run({ kind: 'long', km: 14, minutes: 100 }), fast)
    expect(after.km).toBe(14)
    expect(after.minutes).toBeLessThan(before.minutes)
    expect(after.paceSecPerKm).toBe(fast.long)
  })

  it('holds the threshold block at its hard minutes and keeps the shoulders', () => {
    const result = resolveRunPaces(run({ kind: 'threshold', hardMinutes: 20, minutes: 40, km: 7 }), fast)
    expect(result.hardMinutes).toBe(20)
    expect(result.minutes).toBe(40)
    expect(result.paceSecPerKm).toBe(fast.threshold)
  })

  it('repaces the interval reps and recomputes the hard minutes', () => {
    const session = run({ kind: 'interval', intervals: { reps: 6, workMeters: 400, restSec: 90, paceSecPerKm: slow.interval }, hardMinutes: 12, km: 5.4 })
    const result = resolveRunPaces(session, fast)
    expect(result.intervals?.reps).toBe(6)
    expect(result.intervals?.paceSecPerKm).toBe(fast.interval)
    expect(result.km).toBeCloseTo(5.4, 1)
    expect(result.hardMinutes).toBeLessThan(12)
  })

  it('leaves run/walk alone: it is prescribed in minutes, not at a pace', () => {
    const session = run({ kind: 'run_walk', runWalk: { week: 2, repeats: 6, runMinutes: 3, walkMinutes: 2, totalMinutes: 30, continuous: false } })
    expect(resolveRunPaces(session, fast)).toBe(session)
  })
})
