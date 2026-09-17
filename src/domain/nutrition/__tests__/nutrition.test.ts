import { describe, expect, it } from 'vitest'
import {
  activityFactor,
  basalMetabolicRate,
  estimateNutrition,
  PROTEIN_G_PER_KG,
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
