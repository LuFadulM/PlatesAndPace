import { describe, expect, it } from 'vitest'
import {
  estimatedMaxHeartRate,
  fiveKEquivalentSeconds,
  heartRateZones,
  isFasterThanCurrent,
  longRunProgression,
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

describe('trainingPaces', () => {
  const paces = trainingPaces(OWNER_RUN)

  it('derives the owner-example paces stated in the plan', () => {
    // 5K pace 6:53/km; easy 8:56; threshold 7:17; intervals 6:40.
    expect(Math.round(paces.fiveK)).toBe(412)
    expect(Math.round(paces.easy)).toBe(536)
    expect(Math.round(paces.threshold)).toBe(437)
    expect(Math.round(paces.interval)).toBe(400)
  })

  it('orders paces from fastest to slowest', () => {
    expect(paces.interval).toBeLessThan(paces.fiveK)
    expect(paces.fiveK).toBeLessThan(paces.threshold)
    expect(paces.threshold).toBeLessThan(paces.easy)
    expect(paces.easy).toBeLessThan(paces.long)
  })

  it('omits goal pace until a race is chosen', () => {
    expect(paces.goal).toBeUndefined()
    expect(trainingPaces(OWNER_RUN, '10k').goal).toBeDefined()
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

describe('heart-rate zones', () => {
  it('uses the Tanaka estimate rather than 220 − age', () => {
    expect(estimatedMaxHeartRate(30)).toBeCloseTo(187, 5)
    expect(estimatedMaxHeartRate(50)).toBeCloseTo(173, 5)
  })

  it('returns five contiguous zones ending at max', () => {
    const zones = heartRateZones(30)

    expect(zones).toHaveLength(5)
    for (let i = 1; i < zones.length; i += 1) {
      expect(zones[i]!.minBpm).toBe(zones[i - 1]!.maxBpm)
    }
    expect(zones[4]!.maxBpm).toBe(Math.round(estimatedMaxHeartRate(30)))
  })

  it('gives an older athlete lower zone boundaries', () => {
    expect(heartRateZones(50)[3]!.minBpm).toBeLessThan(heartRateZones(25)[3]!.minBpm)
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
