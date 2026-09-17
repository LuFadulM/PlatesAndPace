import { describe, expect, it } from 'vitest'
import {
  easyMinutesToAdd,
  estimatedMaxHeartRate,
  fiveKEquivalentSeconds,
  heartRateZones,
  intensityDistribution,
  isFasterThanCurrent,
  longRunProgression,
  predictSecondsFromVdot,
  riegelPredictSeconds,
  runWalkProgression,
  trainingPaces,
} from '..'

/** The owner's current run: 3 km in 20:00 (PLAN.md §1). */
const OWNER_RUN = { km: 3, seconds: 20 * 60 }

describe('Riegel', () => {
  it('predicts a longer race as slower than a flat extrapolation', () => {
    const flat = (20 * 60 * 5) / 3
    expect(riegelPredictSeconds(3, 20 * 60, 5)).toBeGreaterThan(flat)
  })

  it('reproduces the worked example: 3 km in 20:00 is a 34:22 5K', () => {
    const seconds = fiveKEquivalentSeconds(OWNER_RUN.km, OWNER_RUN.seconds)

    expect(seconds).toBeCloseTo(2062.2, 0)
    expect(Math.round(seconds / 60)).toBe(34)
  })

  it('is its own inverse across distances', () => {
    const tenK = riegelPredictSeconds(5, 1500, 10)
    expect(riegelPredictSeconds(10, tenK, 5)).toBeCloseTo(1500, 6)
  })

  it('is the identity when the target equals the known distance', () => {
    expect(riegelPredictSeconds(5, 1500, 5)).toBeCloseTo(1500, 9)
  })

  it('rejects impossible inputs rather than returning a nonsense pace', () => {
    expect(() => riegelPredictSeconds(0, 1200, 5)).toThrow(RangeError)
    expect(() => riegelPredictSeconds(3, 0, 5)).toThrow(RangeError)
    expect(() => riegelPredictSeconds(3, 1200, -1)).toThrow(RangeError)
  })
})

describe('trainingPaces (VDOT)', () => {
  const paces = trainingPaces(OWNER_RUN)

  it('reads a VDOT off the recent effort and derives every pace from it', () => {
    // 3 km in 20:00 is a modest effort: VDOT in the low twenties.
    expect(paces.vdot).toBeGreaterThan(20)
    expect(paces.vdot).toBeLessThan(30)
    // Easy well above 5K pace, threshold between, intervals faster than 5K.
    expect(paces.easy).toBeGreaterThan(paces.fiveK * 1.15)
    expect(paces.threshold).toBeGreaterThan(paces.fiveK)
    expect(paces.interval).toBeLessThan(paces.fiveK)
  })

  it('matches the published VDOT table within a few seconds per kilometre', () => {
    // Daniels: a 19:57 5K is VDOT 50; T pace ≈ 4:15/km, I pace ≈ 3:55/km, E ≈ 5:00–5:30/km.
    const fifty = trainingPaces({ km: 5, seconds: 19 * 60 + 57 })
    expect(Math.round(fifty.vdot)).toBe(50)
    expect(Math.abs(fifty.threshold - 255)).toBeLessThan(8)
    expect(Math.abs(fifty.interval - 235)).toBeLessThan(8)
    expect(fifty.easy).toBeGreaterThan(300)
    expect(fifty.easy).toBeLessThan(335)
  })

  it('orders paces from fastest to slowest', () => {
    expect(paces.repetition).toBeLessThan(paces.interval)
    expect(paces.interval).toBeLessThan(paces.threshold)
    expect(paces.threshold).toBeLessThan(paces.marathon)
    expect(paces.marathon).toBeLessThan(paces.easy)
    expect(paces.easy).toBeLessThan(paces.long)
  })

  it('omits goal pace until a race is chosen, then shows it as a band', () => {
    expect(paces.goal).toBeUndefined()
    const goal = trainingPaces(OWNER_RUN, '10k')
    expect(goal.goal).toBeDefined()
    expect(goal.goalRange!.fast).toBeLessThan(goal.goal!)
    expect(goal.goalRange!.slow).toBeGreaterThan(goal.goal!)
  })

  it('makes a longer goal race a slower goal pace', () => {
    const fiveK = trainingPaces(OWNER_RUN, '5k').goal!
    const tenK = trainingPaces(OWNER_RUN, '10k').goal!
    const half = trainingPaces(OWNER_RUN, 'half').goal!

    expect(fiveK).toBeLessThan(tenK)
    expect(tenK).toBeLessThan(half)
  })

  it('detects a faster run so paces can be recomputed', () => {
    expect(isFasterThanCurrent({ km: 3, seconds: 18 * 60 }, paces)).toBe(true)
    expect(isFasterThanCurrent({ km: 3, seconds: 22 * 60 }, paces)).toBe(false)
  })
})

describe('VDOT predictions', () => {
  it('predicts a 10K from a 5K close to the published tables', () => {
    // VDOT 50: 5K 19:57, 10K about 41:21.
    const seconds = predictSecondsFromVdot(50, 10_000)
    expect(Math.abs(seconds - (41 * 60 + 21))).toBeLessThan(45)
  })
})

describe('heart-rate zones', () => {
  it('uses the Nes estimate (211 − 0.64 × age) and says it is an estimate', () => {
    expect(estimatedMaxHeartRate(30)).toBeCloseTo(191.8, 5)
    expect(estimatedMaxHeartRate(50)).toBeCloseTo(179, 5)
    expect(heartRateZones(30).maxEstimated).toBe(true)
    expect(heartRateZones(30, { maxHr: 195 }).maxEstimated).toBe(false)
  })

  it('returns five contiguous zones ending at max by default', () => {
    const { zones, method } = heartRateZones(30)
    expect(method).toBe('max')
    expect(zones).toHaveLength(5)
    for (let i = 1; i < zones.length; i += 1) {
      expect(zones[i]!.minBpm).toBe(zones[i - 1]!.maxBpm)
    }
    expect(zones[4]!.maxBpm).toBe(Math.round(estimatedMaxHeartRate(30)))
  })

  it('prefers heart-rate reserve when resting HR is known: zone 2 sits higher than with percent of max', () => {
    const byMax = heartRateZones(30)
    const byReserve = heartRateZones(30, { restingHr: 50 })
    expect(byReserve.method).toBe('hrr')
    expect(byReserve.zones[1]!.minBpm).toBeGreaterThan(byMax.zones[1]!.minBpm)
    // Karvonen: 50 + (191.8 − 50) × 0.6 ≈ 135.
    expect(byReserve.zones[1]!.minBpm).toBe(135)
  })

  it('prefers Friel zones when LTHR is known, with zone 4 ending at LTHR', () => {
    const friel = heartRateZones(30, { restingHr: 50, lthr: 170 })
    expect(friel.method).toBe('lthr')
    expect(friel.zones[3]!.maxBpm).toBe(170)
    expect(friel.zones[4]!.minBpm).toBe(170)
  })

  it('gives an older athlete lower zone boundaries', () => {
    expect(heartRateZones(50).zones[3]!.minBpm).toBeLessThan(heartRateZones(25).zones[3]!.minBpm)
  })
})

describe('80/20 distribution', () => {
  it('counts only the hard minutes as hard, and says how much easy running would restore the balance', () => {
    const week = intensityDistribution([
      { kind: 'easy', minutes: 30, hardMinutes: 0 },
      { kind: 'interval', minutes: 35, hardMinutes: 12 },
      { kind: 'long', minutes: 50, hardMinutes: 0 },
    ])
    expect(week.hardMinutes).toBe(12)
    expect(week.easyShare).toBeCloseTo(103 / 115, 5)
    expect(easyMinutesToAdd(week)).toBe(0)
    const lopsided = intensityDistribution([{ kind: 'interval', minutes: 40, hardMinutes: 20 }, { kind: 'easy', minutes: 30, hardMinutes: 0 }])
    expect(easyMinutesToAdd(lopsided)).toBe(30)
  })
})

describe('longRunProgression', () => {
  it('never grows more than 10% in a build week', () => {
    const plan = longRunProgression(10, 8)

    for (let i = 1; i < plan.length; i += 1) {
      if (plan[i]!.recovery || plan[i - 1]!.recovery) continue
      expect(plan[i]!.km).toBeLessThanOrEqual(plan[i - 1]!.km * 1.1 + 0.5)
    }
  })

  it('cuts back every fourth week', () => {
    const plan = longRunProgression(10, 12)
    const recoveryWeeks = plan.filter((week) => week.recovery).map((week) => week.week)

    expect(recoveryWeeks).toEqual([4, 8, 12])
  })

  it('resumes from the last build week, not from the cutback', () => {
    const plan = longRunProgression(10, 6)
    const beforeRecovery = plan[2]! // week 3
    const recovery = plan[3]! // week 4
    const after = plan[4]! // week 5

    expect(recovery.km).toBeLessThan(beforeRecovery.km)
    expect(after.km).toBeGreaterThan(beforeRecovery.km)
  })

  it('honours a ceiling on the long run', () => {
    const plan = longRunProgression(16, 12, { maxKm: 18 })

    expect(Math.max(...plan.map((week) => week.km))).toBeLessThanOrEqual(18)
  })

  it('supports a three-week cycle as well as four', () => {
    const plan = longRunProgression(8, 9, { recoveryEvery: 3 })

    expect(plan.filter((week) => week.recovery).map((week) => week.week)).toEqual([3, 6, 9])
  })

  it('rejects a nonsensical block', () => {
    expect(() => longRunProgression(0, 8)).toThrow(RangeError)
    expect(() => longRunProgression(10, 0)).toThrow(RangeError)
  })
})

describe('runWalkProgression', () => {
  it('starts from what the athlete can already hold', () => {
    expect(runWalkProgression(3, 8)[0]!.runMinutes).toBe(3)
  })

  it('starts at one minute for someone who cannot run at all', () => {
    expect(runWalkProgression(0, 8)[0]!.runMinutes).toBe(1)
  })

  it('lengthens the run interval every week', () => {
    const plan = runWalkProgression(1, 10)

    for (let i = 1; i < plan.length; i += 1) {
      expect(plan[i]!.runMinutes).toBeGreaterThanOrEqual(plan[i - 1]!.runMinutes)
    }
  })

  it('keeps every session close to half an hour', () => {
    for (const week of runWalkProgression(1, 12)) {
      expect(week.totalMinutes).toBeGreaterThanOrEqual(20)
      expect(week.totalMinutes).toBeLessThanOrEqual(40)
    }
  })

  it('shortens walk breaks as the run intervals grow', () => {
    const plan = runWalkProgression(1, 16)
    const early = plan.find((week) => week.runMinutes === 4)!
    const later = plan.find((week) => week.runMinutes === 12)!

    expect(early.walkMinutes).toBe(2)
    expect(later.walkMinutes).toBe(1)
  })

  it('graduates to one continuous run and stays there', () => {
    const plan = runWalkProgression(5, 40)
    const firstContinuous = plan.findIndex((week) => week.continuous)

    expect(firstContinuous).toBeGreaterThan(0)
    expect(plan.slice(firstContinuous).every((week) => week.continuous)).toBe(true)
    expect(plan.at(-1)!.walkMinutes).toBe(0)
  })
})
