import { describe, expect, it } from 'vitest'
import {
  activityFactor,
  adaptationFromTrend,
  basalMetabolicRate,
  estimateNutrition,
  observedWeeklyChangeKg,
  PROTEIN_G_PER_KG,
  weightTrend,
  type NutritionInput,
} from '..'

const BASE: NutritionInput = {
  sex: 'female',
  ageYears: 28,
  weightKg: 62,
  heightCm: 166,
  goal: 'fat_loss',
  sessionsPerWeek: 3,
  sessionMinutes: 60,
}

describe('Mifflin–St Jeor', () => {
  it('matches the published constants for each sex', () => {
    const shared = { weightKg: 70, heightCm: 175, ageYears: 30 }
    const base = 10 * 70 + 6.25 * 175 - 5 * 30

    expect(basalMetabolicRate({ ...shared, sex: 'male' })).toBeCloseTo(base + 5, 6)
    expect(basalMetabolicRate({ ...shared, sex: 'female' })).toBeCloseTo(base - 161, 6)
  })

  it('places an undeclared sex between the two, not on one of them', () => {
    const shared = { weightKg: 70, heightCm: 175, ageYears: 30 }
    const male = basalMetabolicRate({ ...shared, sex: 'male' })
    const female = basalMetabolicRate({ ...shared, sex: 'female' })
    const unspecified = basalMetabolicRate({ ...shared, sex: 'unspecified' })

    expect(unspecified).toBeGreaterThan(female)
    expect(unspecified).toBeLessThan(male)
    expect(unspecified).toBeCloseTo((male + female) / 2, 6)
  })
})

describe('activityFactor', () => {
  it('rises with training frequency across the documented bands', () => {
    expect(activityFactor(1)).toBe(1.2)
    expect(activityFactor(3)).toBe(1.375)
    expect(activityFactor(5)).toBe(1.55)
    expect(activityFactor(6)).toBe(1.725)
    expect(activityFactor(8)).toBe(1.9)
  })

  it('never decreases as sessions increase', () => {
    for (let n = 1; n < 10; n += 1) {
      expect(activityFactor(n + 1)).toBeGreaterThanOrEqual(activityFactor(n))
    }
  })
})

describe('estimateNutrition', () => {
  it('applies a 20% deficit for fat loss', () => {
    const result = estimateNutrition(BASE)

    expect(result.targetKcal).toBe(Math.round(result.maintenanceKcal * 0.8))
    expect(result.deficitApplied).toBe(true)
  })

  it('applies a 10% surplus for building muscle', () => {
    const result = estimateNutrition({ ...BASE, goal: 'hypertrophy' })

    expect(result.targetKcal).toBe(Math.round(result.maintenanceKcal * 1.1))
    expect(result.deficitApplied).toBe(false)
  })

  it('holds every other goal at maintenance', () => {
    for (const goal of ['strength', 'general_health', 'endurance', 'recomposition', 'athletic_performance', 'mobility_rehab'] as const) {
      const result = estimateNutrition({ ...BASE, goal })
      expect(result.targetKcal).toBe(Math.round(result.maintenanceKcal))
    }
  })

  it('sets protein from the goal, per kilogram of bodyweight', () => {
    for (const goal of Object.keys(PROTEIN_G_PER_KG) as (keyof typeof PROTEIN_G_PER_KG)[]) {
      const result = estimateNutrition({ ...BASE, goal })
      expect(result.proteinG).toBe(Math.round(PROTEIN_G_PER_KG[goal] * BASE.weightKg))
    }
  })

  it('never puts a minor into a deficit, whatever the goal says', () => {
    const minor = estimateNutrition({ ...BASE, ageYears: 17 })

    expect(minor.targetKcal).toBeGreaterThanOrEqual(Math.round(minor.maintenanceKcal))
    expect(minor.deficitApplied).toBe(false)
    expect(minor.noteKeys).toContain('nutrition.notes.noDeficitUnder18')
  })

  it('never puts a conservative-mode athlete into a deficit', () => {
    const careful = estimateNutrition({ ...BASE, conservativeMode: true })

    expect(careful.targetKcal).toBeGreaterThanOrEqual(Math.round(careful.maintenanceKcal))
    expect(careful.deficitApplied).toBe(false)
    expect(careful.noteKeys).toContain('nutrition.notes.conservativeMode')
  })

  it('still allows a surplus in conservative mode — only deficits are suppressed', () => {
    const careful = estimateNutrition({ ...BASE, goal: 'hypertrophy', conservativeMode: true })

    expect(careful.targetKcal).toBe(Math.round(careful.maintenanceKcal * 1.1))
  })

  it('holds the calorie floor for a very small athlete', () => {
    const tiny = estimateNutrition({ ...BASE, weightKg: 40, heightCm: 148, sessionsPerWeek: 2 })

    expect(tiny.targetKcal).toBeGreaterThanOrEqual(1200)
    expect(tiny.noteKeys).toContain('nutrition.notes.calorieFloorApplied')
  })

  it('refuses to produce numbers for anyone under 16', () => {
    expect(() => estimateNutrition({ ...BASE, ageYears: 15 })).toThrow(RangeError)
  })

  it('scales water with bodyweight and session length', () => {
    const short = estimateNutrition({ ...BASE, sessionMinutes: 30 })
    const long = estimateNutrition({ ...BASE, sessionMinutes: 90 })

    expect(short.waterMlPerTrainingDay).toBe(Math.round(35 * 62 + 500 * 0.5))
    expect(long.waterMlPerTrainingDay).toBeGreaterThan(short.waterMlPerTrainingDay)
  })

  it('always labels the output as an estimate', () => {
    expect(estimateNutrition(BASE).noteKeys).toContain('nutrition.notes.estimateOnly')
  })

  it('returns note keys, never translated prose', () => {
    for (const key of estimateNutrition({ ...BASE, ageYears: 17 }).noteKeys) {
      expect(key).toMatch(/^nutrition\.notes\.[A-Za-z0-9]+$/)
    }
  })
})

describe('macros and carb cycling', () => {
  it('fills the day with protein first, fat second, carbs last, and adds fibre by the calories', () => {
    const result = estimateNutrition({ ...BASE, goal: 'hypertrophy' })
    const day = result.trainingDay
    expect(day.proteinG).toBe(Math.round(PROTEIN_G_PER_KG.hypertrophy * BASE.weightKg))
    expect(day.fatG).toBe(Math.round(0.8 * BASE.weightKg))
    expect(Math.abs(day.proteinG * 4 + day.fatG * 9 + day.carbsG * 4 - result.trainingDayKcal)).toBeLessThan(5)
    expect(day.fibreG).toBe(Math.round((result.trainingDayKcal / 1000) * 14))
  })

  it('moves carbohydrate toward training days without changing the average', () => {
    const result = estimateNutrition({ ...BASE, goal: 'hypertrophy' })
    expect(result.trainingDayKcal).toBeGreaterThan(result.restDayKcal)
    expect(Math.abs((result.trainingDayKcal + result.restDayKcal) / 2 - result.targetKcal)).toBeLessThanOrEqual(1)
    expect(result.trainingDay.carbsG).toBeGreaterThan(result.restDay.carbsG)
    expect(result.trainingDay.proteinG).toBe(result.restDay.proteinG)
  })

  it('takes protein to the top of the band in a deficit', () => {
    expect(estimateNutrition({ ...BASE, goal: 'fat_loss' }).proteinG).toBe(Math.round(2.2 * BASE.weightKg))
  })
})

describe('rate caps and the adaptive loop', () => {
  it('caps a deficit at about three quarters of a percent of bodyweight a week', () => {
    // A very light athlete on a large frame: 20 percent would out-run the cap.
    const light = estimateNutrition({ ...BASE, sex: 'male', weightKg: 45, heightCm: 190, ageYears: 20, sessionsPerWeek: 6, goal: 'fat_loss' })
    expect(light.noteKeys).toContain('nutrition.notes.rateCapped')
    expect(Math.abs(light.predictedWeeklyChangeKg)).toBeLessThanOrEqual(45 * 0.0075 + 0.01)
  })

  it('never lets someone with a history of disordered eating into a deficit', () => {
    const result = estimateNutrition({ ...BASE, goal: 'fat_loss', disorderedEating: true })
    expect(result.deficitApplied).toBe(false)
    expect(result.targetKcal).toBe(result.maintenanceKcal)
    expect(result.noteKeys).toContain('nutrition.notes.disorderedEating')
  })

  it('smooths daily weights so one heavy morning does not move the trend', () => {
    const points = [
      { date: '2026-09-01', kg: 70 },
      { date: '2026-09-02', kg: 70.1 },
      { date: '2026-09-03', kg: 71.5 },
      { date: '2026-09-04', kg: 70 },
    ]
    const trend = weightTrend(points)
    expect(trend[2]!).toBeLessThan(70.6)
  })

  it('needs at least a week of points before it judges the trend', () => {
    expect(observedWeeklyChangeKg([{ date: '2026-09-01', kg: 70 }, { date: '2026-09-03', kg: 69 }])).toBeNull()
    const days = Array.from({ length: 14 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, kg: 70 - i * 0.05 }))
    expect(observedWeeklyChangeKg(days)).toBeLessThan(0)
  })

  it('raises the target when weight falls faster than predicted, lowers it when nothing moves, within limits', () => {
    expect(adaptationFromTrend(-0.4, -0.9)).toBeGreaterThan(0)
    expect(adaptationFromTrend(-0.4, 0)).toBeLessThan(0)
    expect(adaptationFromTrend(-0.4, -0.4)).toBe(0)
    // Weight climbing while a loss was planned: the target comes down, hard-capped.
    expect(adaptationFromTrend(-0.4, 3)).toBe(-300)
    expect(adaptationFromTrend(-0.4, -5)).toBe(300)
    expect(adaptationFromTrend(0.3, -2)).toBe(300)
    expect(adaptationFromTrend(0, 2)).toBe(-300)
  })

  it('applies the trend to the target and says so', () => {
    const stalled = Array.from({ length: 14 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, kg: 62 }))
    const result = estimateNutrition({ ...BASE, goal: 'fat_loss', recentWeights: stalled })
    expect(result.adaptationKcal).toBeLessThan(0)
    expect(result.noteKeys).toContain('nutrition.notes.adaptedDown')
    expect(result.targetKcal).toBeLessThan(estimateNutrition({ ...BASE, goal: 'fat_loss' }).targetKcal)
  })
})
