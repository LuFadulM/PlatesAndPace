import type { PrimaryGoal, Sex } from '../profile/types'

/**
 * Nutrition estimates (PLAN.md §6.9).
 *
 * Everything here is an estimate shown with a disclaimer, never medical advice.
 * The guards matter more than the arithmetic: no deficit under 18, no deficit in
 * conservative mode, and a hard calorie floor in every case.
 */

export const PROTEIN_G_PER_KG: Record<PrimaryGoal, number> = {
  lose_fat: 2.0,
  build_muscle: 1.8,
  get_strong: 1.8,
  hybrid: 1.8,
  fit_and_firm: 1.6,
  run_faster: 1.5,
}

/** Applied to maintenance calories. Anything not listed holds at maintenance. */
const GOAL_CALORIE_ADJUSTMENT: Partial<Record<PrimaryGoal, number>> = {
  lose_fat: -0.2,
  build_muscle: 0.1,
}

export const MINIMUM_AGE = 16
export const ADULT_AGE = 18

/** Absolute floors, whatever the arithmetic says. */
const CALORIE_FLOOR: Record<Sex, number> = {
  female: 1200,
  male: 1500,
  // Without a stated sex, take the higher floor: it is the option that cannot
  // put someone into a deeper deficit than intended.
  unspecified: 1500,
}

export const WATER_ML_PER_KG = 35
export const WATER_ML_PER_TRAINING_HOUR = 500

/**
 * Every note the estimator can emit. Exported so the i18n suite can prove both
 * catalogues define them — a missing key here would surface as a blank caveat
 * next to a calorie number, which is exactly where silence is least acceptable.
 */
export const NUTRITION_NOTE_KEYS = [
  'nutrition.notes.estimateOnly',
  'nutrition.notes.noDeficitUnder18',
  'nutrition.notes.conservativeMode',
  'nutrition.notes.calorieFloorApplied',
] as const

export interface NutritionInput {
  sex: Sex
  ageYears: number
  weightKg: number
  heightCm: number
  goal: PrimaryGoal
  sessionsPerWeek: number
  sessionMinutes: number
  conservativeMode?: boolean
}

export interface NutritionEstimate {
  bmrKcal: number
  activityFactor: number
  maintenanceKcal: number
  targetKcal: number
  proteinG: number
  waterMlPerTrainingDay: number
  /** True when the goal's deficit was actually applied rather than suppressed. */
  deficitApplied: boolean
  /**
   * Message keys for the caveats to show, never English text — the UI
   * translates them (PLAN.md §4).
   */
  noteKeys: string[]
}

/**
 * Mifflin–St Jeor. More accurate than Harris–Benedict for contemporary body
 * compositions, which is why it is the one the brief specifies.
 */
export function basalMetabolicRate(input: {
  sex: Sex
  weightKg: number
  heightCm: number
  ageYears: number
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears
  switch (input.sex) {
    case 'male':
      return base + 5
    case 'female':
      return base - 161
    case 'unspecified':
      // Midpoint of the two constants, so an undeclared sex lands between them
      // rather than silently assuming one.
      return base + (5 + -161) / 2
  }
}

export function activityFactor(sessionsPerWeek: number): number {
  if (sessionsPerWeek <= 1) return 1.2
  if (sessionsPerWeek <= 3) return 1.375
  if (sessionsPerWeek <= 5) return 1.55
  if (sessionsPerWeek <= 6) return 1.725
  return 1.9
}

export function estimateNutrition(input: NutritionInput): NutritionEstimate {
  if (input.ageYears < MINIMUM_AGE) {
    throw new RangeError(`Plates & Pace is not for athletes under ${MINIMUM_AGE}`)
  }

  const noteKeys = ['nutrition.notes.estimateOnly']

  const bmrKcal = basalMetabolicRate(input)
  const factor = activityFactor(input.sessionsPerWeek)
  const maintenanceKcal = bmrKcal * factor

  const requestedAdjustment = GOAL_CALORIE_ADJUSTMENT[input.goal] ?? 0
  const isMinor = input.ageYears < ADULT_AGE
  const suppressDeficit = requestedAdjustment < 0 && (isMinor || input.conservativeMode === true)

  if (isMinor) noteKeys.push('nutrition.notes.noDeficitUnder18')
  if (input.conservativeMode) noteKeys.push('nutrition.notes.conservativeMode')

  const adjustment = suppressDeficit ? 0 : requestedAdjustment
  const beforeFloor = maintenanceKcal * (1 + adjustment)
  const floor = CALORIE_FLOOR[input.sex]
  const targetKcal = Math.max(beforeFloor, floor)

  if (targetKcal > beforeFloor) noteKeys.push('nutrition.notes.calorieFloorApplied')

  const trainingHours = input.sessionMinutes / 60

  return {
    bmrKcal: Math.round(bmrKcal),
    activityFactor: factor,
    maintenanceKcal: Math.round(maintenanceKcal),
    targetKcal: Math.round(targetKcal),
    proteinG: Math.round(PROTEIN_G_PER_KG[input.goal] * input.weightKg),
    waterMlPerTrainingDay: Math.round(
      WATER_ML_PER_KG * input.weightKg + WATER_ML_PER_TRAINING_HOUR * trainingHours,
    ),
    deficitApplied: adjustment < 0 && targetKcal === beforeFloor,
    noteKeys,
  }
}
