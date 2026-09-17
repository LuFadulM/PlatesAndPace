import { describe, expect, it } from 'vitest'
import {
  estimatedOneRepMax,
  loadForTarget,
  roundToIncrement,
  sessionOneRepMax,
  startingLoadKg,
  type StartingLoadInput,
} from '../loads'

describe('roundToIncrement', () => {
  it('rounds to the plates a barbell actually takes', () => {
    expect(roundToIncrement(61.3, 'barbell', 'metric')).toBe(62.5)
    expect(roundToIncrement(60.1, 'barbell', 'metric')).toBe(60)
  })

  it('uses 5 kg steps on machines and 2.5 on cables', () => {
    expect(roundToIncrement(47, 'machine', 'metric')).toBe(45)
    expect(roundToIncrement(47, 'cable', 'metric')).toBe(47.5)
  })

  it('uses 1 kg steps for light dumbbells and 2 kg for heavy ones', () => {
    expect(roundToIncrement(6.4, 'dumbbell', 'metric')).toBe(6)
    expect(roundToIncrement(23.1, 'dumbbell', 'metric')).toBe(24)
  })

  it('never rounds a real load down to zero', () => {
    expect(roundToIncrement(0.4, 'machine', 'metric')).toBe(5)
    expect(roundToIncrement(0, 'machine', 'metric')).toBe(0)
  })

  it('rounds imperial athletes in pounds, not in kilos', () => {
    // 47.5 kg is 104.7 lb, which no rack offers. 105 lb does.
    const kg = roundToIncrement(47.5, 'barbell', 'imperial')
    const lb = kg / 0.45359237

    expect(Math.round(lb)).toBe(105)
    expect(lb % 5).toBeCloseTo(0, 6)
  })

  it('keeps machine loads on 10 lb steps in imperial', () => {
    const lb = roundToIncrement(50, 'machine', 'imperial') / 0.45359237
    expect(lb % 10).toBeCloseTo(0, 6)
  })
})

describe('startingLoadKg', () => {
  const base: StartingLoadInput = {
    bodyweightKg: 70,
    strengthRatio: 1.0,
    region: 'lower',
    implement: 'barbell',
    sex: 'male',
    experience: '1_to_3_years',
    units: 'metric',
  }

  it('scales with bodyweight and the exercise ratio', () => {
    expect(startingLoadKg(base)).toBe(70)
    expect(startingLoadKg({ ...base, strengthRatio: 0.5 })).toBe(35)
  })

  it('separates upper and lower body when applying sex factors', () => {
    const lower = startingLoadKg({ ...base, sex: 'female', region: 'lower' })
    const upper = startingLoadKg({ ...base, sex: 'female', region: 'upper' })

    // A single blanket factor would leave one of these badly wrong.
    expect(lower).toBeGreaterThan(upper)
    expect(lower).toBe(roundToIncrement(70 * 0.8, 'barbell', 'metric'))
    expect(upper).toBe(roundToIncrement(70 * 0.65, 'barbell', 'metric'))
  })

  it('puts an undeclared sex between the two', () => {
    const female = startingLoadKg({ ...base, sex: 'female', region: 'upper' })
    const male = startingLoadKg({ ...base, sex: 'male', region: 'upper' })
    const unspecified = startingLoadKg({ ...base, sex: 'unspecified', region: 'upper' })

    expect(unspecified).toBeGreaterThan(female)
    expect(unspecified).toBeLessThan(male)
  })

  it('rises with experience', () => {
    const loads = (['none', 'under_1_year', '1_to_3_years', '3_plus_years'] as const).map(
      (experience) => startingLoadKg({ ...base, experience }),
    )

    for (let i = 1; i < loads.length; i += 1) {
      expect(loads[i]!).toBeGreaterThan(loads[i - 1]!)
    }
  })

  it('starts a conservative athlete about 15% lighter', () => {
    const normal = startingLoadKg(base)
    const careful = startingLoadKg({ ...base, conservativeMode: true })

    expect(careful).toBeLessThan(normal)
    expect(careful).toBeCloseTo(roundToIncrement(70 * 0.85, 'barbell', 'metric'), 6)
  })
})

describe('estimatedOneRepMax', () => {
  it('matches the formula from the brief', () => {
    // 100 kg × 5 at RPE 8 → 100 × (1 + (5 + 2) / 30)
    expect(estimatedOneRepMax(100, 5, 8)).toBeCloseTo(100 * (1 + 7 / 30), 9)
  })

  it('treats an easier set of the same load and reps as a higher max', () => {
    expect(estimatedOneRepMax(100, 5, 7)).toBeGreaterThan(estimatedOneRepMax(100, 5, 9))
  })

  it('makes a true single at RPE 10 the load itself', () => {
    expect(estimatedOneRepMax(140, 1, 10)).toBeCloseTo(140 * (1 + 1 / 30), 9)
  })

  it('round-trips through loadForTarget', () => {
    const e1rm = estimatedOneRepMax(100, 5, 8)
    expect(loadForTarget(e1rm, 5, 8)).toBeCloseTo(100, 9)
  })

  it('asks for less weight for more reps at the same RPE', () => {
    const e1rm = estimatedOneRepMax(100, 5, 8)
    expect(loadForTarget(e1rm, 10, 8)).toBeLessThan(loadForTarget(e1rm, 5, 8))
  })

  it('rejects an RPE outside the scale', () => {
    expect(() => estimatedOneRepMax(100, 5, 11)).toThrow(RangeError)
    expect(() => estimatedOneRepMax(100, 5, 0)).toThrow(RangeError)
    expect(() => loadForTarget(120, 5, 12)).toThrow(RangeError)
  })
})

describe('sessionOneRepMax', () => {
  it('takes the best completed set, not the last one', () => {
    const best = sessionOneRepMax([
      { kg: 100, reps: 5, rpe: 8, done: true },
      { kg: 105, reps: 5, rpe: 8, done: true },
      { kg: 80, reps: 8, rpe: 7, done: true },
    ])

    expect(best).toBeCloseTo(estimatedOneRepMax(105, 5, 8), 9)
  })

  it('ignores sets that were never completed', () => {
    const best = sessionOneRepMax([
      { kg: 100, reps: 5, rpe: 8, done: true },
      { kg: 200, reps: 5, rpe: 8, done: false },
    ])

    expect(best).toBeCloseTo(estimatedOneRepMax(100, 5, 8), 9)
  })

  it('returns null when nothing was logged', () => {
    expect(sessionOneRepMax([])).toBeNull()
    expect(sessionOneRepMax([{ kg: 0, reps: 0, rpe: 8, done: true }])).toBeNull()
  })
})
