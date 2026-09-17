import { describe, expect, it } from 'vitest'
import {
  interferenceLimits,
  isHardRunDay,
  isLowerBodySession,
  selectSplit,
  type SessionKind,
} from '../splits'
import {
  CONSERVATIVE_VOLUME_FACTOR,
  MAX_WEEKLY_SETS,
  MUSCLE_GROUPS,
  weeklySetTargets,
} from '../volume'

describe('selectSplit', () => {
  it('follows the table in the brief for each day count', () => {
    expect(selectSplit(2, 'intermediate', 'build_muscle')).toEqual([
      'full_body_a',
      'full_body_b',
    ])
    expect(selectSplit(4, 'intermediate', 'build_muscle')).toEqual([
      'upper',
      'lower',
      'upper',
      'lower',
    ])
    expect(selectSplit(5, 'intermediate', 'fit_and_firm')).toEqual([
      'lower_a',
      'upper_a',
      'glutes_lower_b',
      'upper_b',
      'full_body_a',
    ])
    expect(selectSplit(6, 'advanced', 'build_muscle')).toEqual([
      'push',
      'pull',
      'legs',
      'push',
      'pull',
      'legs',
    ])
  })

  it('gives a three-day beginner full body and a three-day lifter PPL', () => {
    expect(selectSplit(3, 'beginner', 'build_muscle')).toEqual([
      'full_body_a',
      'full_body_b',
      'full_body_c',
    ])
    expect(selectSplit(3, 'intermediate', 'build_muscle')).toEqual(['push', 'pull', 'legs'])
    expect(selectSplit(3, 'advanced', 'get_strong')).toEqual(['push', 'pull', 'legs'])
  })

  it('always returns one session per gym day', () => {
    for (let days = 2; days <= 6; days += 1) {
      expect(selectSplit(days, 'intermediate', 'hybrid')).toHaveLength(days)
    }
  })

  it('rejects a day count it has no split for', () => {
    expect(() => selectSplit(1, 'beginner', 'lose_fat')).toThrow(RangeError)
    expect(() => selectSplit(7, 'advanced', 'build_muscle')).toThrow(RangeError)
    expect(() => selectSplit(3.5, 'advanced', 'build_muscle')).toThrow(RangeError)
  })

  it('knows which sessions load the legs', () => {
    const lower: SessionKind[] = ['legs', 'lower', 'lower_a', 'glutes_lower_b']
    for (const kind of lower) expect(isLowerBodySession(kind)).toBe(true)
    for (const kind of ['push', 'pull', 'upper', 'upper_a'] as SessionKind[]) {
      expect(isLowerBodySession(kind)).toBe(false)
    }
  })
})

describe('interference between lifting and running', () => {
  it('treats intervals, threshold and long runs as hard days', () => {
    expect(isHardRunDay('interval')).toBe(true)
    expect(isHardRunDay('long')).toBe(true)
    expect(isHardRunDay('threshold')).toBe(true)
    expect(isHardRunDay('easy')).toBe(false)
    expect(isHardRunDay('none')).toBe(false)
  })

  it('caps leg work on a hard run day for a hybrid athlete', () => {
    const limits = interferenceLimits('hybrid', 'interval', 'none')

    expect(limits.maxLowerBodySets).toBe(4)
    expect(limits.allowHeavyHinge).toBe(false)
  })

  it('keeps legs fresh the day before a long run', () => {
    const limits = interferenceLimits('hybrid', 'none', 'long')

    expect(limits.maxLowerBodyRpe).toBeLessThanOrEqual(7)
    expect(limits.allowHeavyHinge).toBe(false)
  })

  it('leaves a pure lifter unrestricted, whatever the running', () => {
    const limits = interferenceLimits('build_muscle', 'interval', 'long')

    expect(limits.maxLowerBodySets).toBe(Number.POSITIVE_INFINITY)
    expect(limits.allowHeavyHinge).toBe(true)
  })

  it('leaves an easy run day alone even for a hybrid athlete', () => {
    expect(interferenceLimits('hybrid', 'easy', 'none').allowHeavyHinge).toBe(true)
  })
})

describe('weeklySetTargets', () => {
  it('scales the base budget with training age', () => {
    expect(weeklySetTargets('beginner').quads).toEqual({ min: 8, max: 12 })
    expect(weeklySetTargets('intermediate').quads).toEqual({ min: 12, max: 16 })
    expect(weeklySetTargets('advanced').quads).toEqual({ min: 14, max: 20 })
  })

  it('adds sets to focus areas and nothing else', () => {
    const targets = weeklySetTargets('intermediate', ['glutes'])

    expect(targets.glutes.min).toBe(16)
    expect(targets.chest.min).toBe(12)
  })

  it('expands a focus area to every muscle it covers', () => {
    const targets = weeklySetTargets('intermediate', ['legs'])

    for (const muscle of ['quads', 'hamstrings', 'calves'] as const) {
      expect(targets[muscle].min).toBe(16)
    }
    expect(targets.glutes.min).toBe(12)
  })

  it('never exceeds the ceiling, however many focus areas are chosen', () => {
    const targets = weeklySetTargets('advanced', ['legs', 'glutes', 'back', 'arms', 'chest'])

    for (const muscle of MUSCLE_GROUPS) {
      expect(targets[muscle].max).toBeLessThanOrEqual(MAX_WEEKLY_SETS)
    }
  })

  it('trims the whole budget in conservative mode', () => {
    const normal = weeklySetTargets('intermediate')
    const careful = weeklySetTargets('intermediate', [], true)

    expect(careful.quads.min).toBe(Math.round(normal.quads.min * CONSERVATIVE_VOLUME_FACTOR))
    expect(careful.quads.max).toBeLessThan(normal.quads.max)
  })

  it('never returns a range whose max is below its min', () => {
    for (const tier of ['beginner', 'intermediate', 'advanced'] as const) {
      const targets = weeklySetTargets(tier, ['legs', 'back'], true)
      for (const muscle of MUSCLE_GROUPS) {
        expect(targets[muscle].max).toBeGreaterThanOrEqual(targets[muscle].min)
      }
    }
  })

  it('covers every muscle group', () => {
    const targets = weeklySetTargets('intermediate')
    for (const muscle of MUSCLE_GROUPS) {
      expect(targets[muscle]).toBeDefined()
    }
  })
})
