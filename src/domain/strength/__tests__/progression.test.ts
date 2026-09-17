import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLATES,
  brzyckiOneRepMax,
  estimatedOneRepMax,
  heaviestLoadableUnder,
  nearestLoadable,
  oneRepMaxConfidence,
  roundLoad,
} from '../loads'
import { doubleProgression, progressionScheme } from '../progression'

describe('estimated max', () => {
  it('Brzycki and Epley agree closely for a heavy set and diverge past ten reps', () => {
    const epley = (kg: number, reps: number) => estimatedOneRepMax(kg, reps, 10)
    expect(Math.abs(brzyckiOneRepMax(100, 3) - epley(100, 3))).toBeLessThan(5)
    expect(Math.abs(brzyckiOneRepMax(60, 15) - epley(60, 15))).toBeGreaterThan(5)
  })

  it('flags an estimate from a long set as low confidence', () => {
    expect(oneRepMaxConfidence(5)).toBe('high')
    expect(oneRepMaxConfidence(10)).toBe('high')
    expect(oneRepMaxConfidence(12)).toBe('medium')
    expect(oneRepMaxConfidence(15)).toBe('low')
  })
})

describe('plate math', () => {
  const metric = DEFAULT_PLATES.metric

  it('builds the heaviest bar under the target with the plates available', () => {
    expect(heaviestLoadableUnder(100, metric)).toEqual({ kg: 100, perSideKg: [25, 15] })
    expect(heaviestLoadableUnder(61, metric)).toEqual({ kg: 60, perSideKg: [20] })
  })

  it('goes one small pair up when that is closer', () => {
    expect(nearestLoadable(62, metric).kg).toBe(62.5)
    expect(nearestLoadable(61, metric).kg).toBe(60)
  })

  it('never asks for less than the bar, and never for a plate the athlete does not own', () => {
    expect(nearestLoadable(12, metric)).toEqual({ kg: 20, perSideKg: [] })
    const poor = { barKg: 20, platePairsKg: [10, 5] }
    for (const target of [23, 47, 52, 88]) {
      const load = nearestLoadable(target, poor)
      for (const p of load.perSideKg) expect([10, 5]).toContain(p)
      expect(load.kg % 10).toBe(0)
    }
  })

  it('an imperial rack rounds in pounds, not kilos', () => {
    // 61.5 kg is 135.6 lb: the 45 lb bar with a 45 on each side, not 130 or 137.5.
    const load = nearestLoadable(61.5, DEFAULT_PLATES.imperial)
    expect(Math.round(load.kg / 0.45359237)).toBe(135)
    expect(load.perSideKg.map((p) => Math.round(p / 0.45359237))).toEqual([45])
  })

  it('roundLoad uses plates for a barbell and increments for everything else', () => {
    expect(roundLoad(61, 'barbell', 'metric', metric)).toBe(60)
    expect(roundLoad(61, 'machine', 'metric', metric)).toBe(60)
    expect(roundLoad(11, 'dumbbell', 'metric', metric)).toBe(12)
    expect(roundLoad(0, 'barbell', 'metric', metric)).toBe(0)
  })
})

describe('progression schemes', () => {
  it('picks the scheme by role and goal, never one rule for everything', () => {
    expect(progressionScheme('primary', 'compound', 'hypertrophy')).toBe('rir_autoregulation')
    expect(progressionScheme('primary', 'compound', 'strength')).toBe('percentage')
    expect(progressionScheme('isolation', 'isolation', 'hypertrophy')).toBe('double_progression')
    expect(progressionScheme('power', 'power', 'athletic_performance')).toBe('volume')
    expect(progressionScheme('mobility', 'mobility', 'general_health')).toBe('volume')
  })

  const set = (kg: number, reps: number) => ({ kg, reps, done: true })

  it('raises the load once every set clears the top of the range', () => {
    const r = doubleProgression({ repMin: 8, repMax: 12, lastSets: [set(20, 12), set(20, 12), set(20, 13)], incrementKg: 2, plannedKg: 20 })
    expect(r).toEqual({ kg: 22, reason: 'increase' })
  })

  it('holds the load while the reps are still being chased', () => {
    const r = doubleProgression({ repMin: 8, repMax: 12, lastSets: [set(20, 12), set(20, 10), set(20, 9)], incrementKg: 2, plannedKg: 24 })
    expect(r).toEqual({ kg: 20, reason: 'hold' })
  })

  it('drops the load when half the sets missed the bottom of the range', () => {
    const r = doubleProgression({ repMin: 8, repMax: 12, lastSets: [set(20, 7), set(20, 6), set(20, 9)], incrementKg: 2, plannedKg: 20 })
    expect(r).toEqual({ kg: 18, reason: 'decrease' })
  })

  it('uses the planned load the first time, and judges only the load actually worked at', () => {
    expect(doubleProgression({ repMin: 8, repMax: 12, lastSets: [], incrementKg: 2, plannedKg: 20 })).toEqual({ kg: 20, reason: 'first' })
    const warmupThenWork = [set(10, 15), set(20, 12), set(20, 12)]
    expect(doubleProgression({ repMin: 8, repMax: 12, lastSets: warmupThenWork, incrementKg: 2, plannedKg: 20 })).toEqual({ kg: 22, reason: 'increase' })
  })
})
