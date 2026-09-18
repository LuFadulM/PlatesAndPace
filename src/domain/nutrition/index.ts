import type { PrimaryGoal, Sex } from '../profile/types'

/**
 * Nutrition targets (CLAUDE.md, rule 7).
 *
 * Everything here is an estimate shown with a disclaimer, never medical advice.
 * The guards matter more than the arithmetic: no deficit under 18, none in
 * conservative mode or with a history of disordered eating, a hard calorie
 * floor in every case, and a weekly rate of change that is capped before it
 * is ambitious.
 */

/** Within the 1.6–2.2 g/kg band; the top of it in a deficit. */
export const PROTEIN_G_PER_KG: Record<PrimaryGoal, number> = {
  fat_loss: 2.2,
  recomposition: 2.0,
  hypertrophy: 1.8,
  strength: 1.8,
  athletic_performance: 1.8,
  endurance: 1.6,
  general_health: 1.6,
  mobility_rehab: 1.6,
}

/** Fat within 0.6–1.0 g/kg; never below the floor whatever the carbs need. */
export const FAT_G_PER_KG = 0.8
export const FAT_FLOOR_G_PER_KG = 0.6

/** Applied to maintenance calories. Anything not listed holds at maintenance. */
const GOAL_CALORIE_ADJUSTMENT: Partial<Record<PrimaryGoal, number>> = {
  fat_loss: -0.2,
  hypertrophy: 0.1,
}

/** Bodyweight change a week the plan will not exceed, as a fraction of bodyweight. */
export const MAX_WEEKLY_LOSS_FRACTION = 0.0075
export const MAX_WEEKLY_GAIN_FRACTION = 0.0035

/** Roughly the energy in a kilogram of tissue lost or gained. A convention, not a law. */
export const KCAL_PER_KG = 7700

/** Carbohydrate moves between training and rest days by this much either way. */
export const CARB_CYCLE_FRACTION = 0.1

export const FIBRE_G_PER_1000_KCAL = 14

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
  'nutrition.notes.disorderedEating',
  'nutrition.notes.calorieFloorApplied',
  'nutrition.notes.rateCapped',
  'nutrition.notes.adaptedUp',
  'nutrition.notes.adaptedDown',
  'nutrition.notes.recompPatience',
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
  /** A history of disordered eating: the plan never asks for less food. */
  disorderedEating?: boolean
  /** Daily weights, oldest first, for the adaptive loop; optional. */
  recentWeights?: readonly WeightPoint[]
}

export interface Macros {
  proteinG: number
  fatG: number
  carbsG: number
  fibreG: number
}

export interface NutritionEstimate {
  bmrKcal: number
  activityFactor: number
  maintenanceKcal: number
  /** The average daily target after every guard and adaptation. */
  targetKcal: number
  /** Carbohydrate leans toward training days: the same weekly total, moved. */
  trainingDayKcal: number
  restDayKcal: number
  trainingDay: Macros
  restDay: Macros
  proteinG: number
  waterMlPerTrainingDay: number
  /** Expected bodyweight change per week at the target, in kilograms; negative is loss. */
  predictedWeeklyChangeKg: number
  /** Present when the 14-day trend moved the target. */
  adaptationKcal: number
  /** True when the goal's deficit was actually applied rather than suppressed. */
  deficitApplied: boolean
  noteKeys: string[]
}

/**
 * Mifflin–St Jeor. More accurate than Harris–Benedict for contemporary body
 * compositions, which is why it is the one the brief specifies.
 */
export function basalMetabolicRate(input: { sex: Sex; weightKg: number; heightCm: number; ageYears: number }): number {
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

export interface WeightPoint {
  /** ISO date. */
  date: string
  kg: number
}

/**
 * Exponentially weighted trend of daily weights, so a salty dinner or a hard
 * week's water does not move the plan. Returns the smoothed value for each
 * point, oldest first.
 */
export function weightTrend(points: readonly WeightPoint[], alpha = 0.3): number[] {
  const trend: number[] = []
  for (const p of points) {
    const last = trend.at(-1)
    trend.push(last === undefined ? p.kg : last + alpha * (p.kg - last))
  }
  return trend
}

/**
 * Observed change per week over the last fortnight of trend, or null when there
 * is not enough data to say anything (fewer than a week of points, or points
 * spanning under a week).
 */
export function observedWeeklyChangeKg(points: readonly WeightPoint[]): number | null {
  if (points.length < 5) return null
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]!
  const last = sorted.at(-1)!
  const days = (Date.UTC(+last.date.slice(0, 4), +last.date.slice(5, 7) - 1, +last.date.slice(8, 10)) - Date.UTC(+first.date.slice(0, 4), +first.date.slice(5, 7) - 1, +first.date.slice(8, 10))) / 86_400_000
  if (days < 7) return null
  const trend = weightTrend(sorted)
  return ((trend.at(-1)! - trend[0]!) / days) * 7
}

/** Kilocalories a day to move the target by, given what the scale did versus what was predicted. */
export function adaptationFromTrend(predictedWeeklyChangeKg: number, observedWeeklyChangeKg: number | null): number {
  if (observedWeeklyChangeKg === null) return 0
  const gapKg = observedWeeklyChangeKg - predictedWeeklyChangeKg
  // A quarter kilo a week off prediction is about 275 kcal a day; move by
  // half of that and cap, so two noisy weeks cannot swing the plan.
  const kcal = (-gapKg * KCAL_PER_KG) / 7 / 2
  const rounded = Math.round(kcal / 25) * 25
  return rounded === 0 ? 0 : Math.max(-300, Math.min(300, rounded))
}

function macrosFor(kcal: number, weightKg: number, goal: PrimaryGoal, inDeficit: boolean): Macros {
  const proteinG = Math.round((inDeficit ? 2.2 : PROTEIN_G_PER_KG[goal]) * weightKg)
  let fatG = Math.round(FAT_G_PER_KG * weightKg)
  let carbsG = Math.round((kcal - proteinG * 4 - fatG * 9) / 4)
  if (carbsG < 0) {
    // Not enough calories for the default fat: lower fat to its floor first.
    fatG = Math.round(FAT_FLOOR_G_PER_KG * weightKg)
    carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4))
  }
  return { proteinG, fatG, carbsG, fibreG: Math.round((kcal / 1000) * FIBRE_G_PER_1000_KCAL) }
}

export function estimateNutrition(input: NutritionInput): NutritionEstimate {
  if (input.ageYears < MINIMUM_AGE) {
    throw new RangeError(`Hyex is not for athletes under ${MINIMUM_AGE}`)
  }

  const noteKeys = ['nutrition.notes.estimateOnly']

  const bmrKcal = basalMetabolicRate(input)
  const factor = activityFactor(input.sessionsPerWeek)
  const maintenanceKcal = bmrKcal * factor

  const requestedAdjustment = GOAL_CALORIE_ADJUSTMENT[input.goal] ?? 0
  const isMinor = input.ageYears < ADULT_AGE
  const suppressDeficit = requestedAdjustment < 0 && (isMinor || input.conservativeMode === true || input.disorderedEating === true)

  if (isMinor) noteKeys.push('nutrition.notes.noDeficitUnder18')
  if (input.conservativeMode) noteKeys.push('nutrition.notes.conservativeMode')
  if (input.disorderedEating && requestedAdjustment < 0) noteKeys.push('nutrition.notes.disorderedEating')
  if (input.goal === 'recomposition') noteKeys.push('nutrition.notes.recompPatience')

  let adjustmentKcal = suppressDeficit ? 0 : maintenanceKcal * requestedAdjustment

  // A rate cap before ambition: never more than about three quarters of a
  // percent of bodyweight lost a week, or a third of a percent gained.
  const maxLossKcalPerDay = (MAX_WEEKLY_LOSS_FRACTION * input.weightKg * KCAL_PER_KG) / 7
  const maxGainKcalPerDay = (MAX_WEEKLY_GAIN_FRACTION * input.weightKg * KCAL_PER_KG) / 7
  if (adjustmentKcal < -maxLossKcalPerDay) {
    adjustmentKcal = -maxLossKcalPerDay
    noteKeys.push('nutrition.notes.rateCapped')
  } else if (adjustmentKcal > maxGainKcalPerDay) {
    adjustmentKcal = maxGainKcalPerDay
    noteKeys.push('nutrition.notes.rateCapped')
  }

  // The scale has the last word: what actually happened over the last two
  // weeks against what the arithmetic predicted.
  const predictedBeforeAdaptation = (adjustmentKcal * 7) / KCAL_PER_KG
  const observed = input.recentWeights ? observedWeeklyChangeKg(input.recentWeights) : null
  let adaptationKcal = adaptationFromTrend(predictedBeforeAdaptation, observed)
  // Adaptation never opens a deficit the guards closed.
  if (suppressDeficit && adjustmentKcal + adaptationKcal < 0) adaptationKcal = -adjustmentKcal
  if (adaptationKcal > 0) noteKeys.push('nutrition.notes.adaptedUp')
  if (adaptationKcal < 0) noteKeys.push('nutrition.notes.adaptedDown')

  const beforeFloor = maintenanceKcal + adjustmentKcal + adaptationKcal
  const floor = CALORIE_FLOOR[input.sex]
  const targetKcal = Math.max(beforeFloor, floor)
  if (targetKcal > beforeFloor) noteKeys.push('nutrition.notes.calorieFloorApplied')

  const inDeficit = targetKcal < maintenanceKcal - 1
  const trainingDayKcal = Math.round(targetKcal * (1 + CARB_CYCLE_FRACTION * 0.5))
  const restDayKcal = Math.round(targetKcal * (1 - CARB_CYCLE_FRACTION * 0.5))
  const trainingHours = input.sessionMinutes / 60

  return {
    bmrKcal: Math.round(bmrKcal),
    activityFactor: factor,
    maintenanceKcal: Math.round(maintenanceKcal),
    targetKcal: Math.round(targetKcal),
    trainingDayKcal,
    restDayKcal,
    trainingDay: macrosFor(trainingDayKcal, input.weightKg, input.goal, inDeficit),
    restDay: macrosFor(restDayKcal, input.weightKg, input.goal, inDeficit),
    proteinG: Math.round((inDeficit ? 2.2 : PROTEIN_G_PER_KG[input.goal]) * input.weightKg),
    waterMlPerTrainingDay: Math.round(WATER_ML_PER_KG * input.weightKg + WATER_ML_PER_TRAINING_HOUR * trainingHours),
    predictedWeeklyChangeKg: Math.round((((targetKcal - maintenanceKcal) * 7) / KCAL_PER_KG) * 100) / 100,
    adaptationKcal,
    deficitApplied: adjustmentKcal < 0 && targetKcal === beforeFloor,
    noteKeys,
  }
}
export * from './intake'
