import type { LiftingExperience, Sex, Units } from '../profile/types'

/**
 * Starting loads, real-world rounding, and the estimated-1RM maths that drives
 * every later session (PLAN.md §6.5).
 */

export type Implement = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight'

/** Which strength ratios and sex factors apply. */
export type BodyRegion = 'upper' | 'lower' | 'core'

const KG_PER_LB = 0.45359237

/** Increments a real gym actually offers, in the unit the gym is marked in. */
const INCREMENT_KG: Record<Implement, number> = {
  barbell: 2.5,
  dumbbell: 2,
  machine: 5,
  cable: 2.5,
  bodyweight: 0.5,
}

const INCREMENT_LB: Record<Implement, number> = {
  barbell: 5,
  dumbbell: 5,
  machine: 10,
  cable: 5,
  bodyweight: 1,
}

/**
 * Rounds a load to something that can actually be loaded on the equipment.
 *
 * Imperial athletes get rounded in pounds and converted back, not rounded in
 * kilos and converted — otherwise the app asks for 47.5 kg on a rack that only
 * has 45 lb and 50 lb selectorised plates.
 */
export function roundToIncrement(kg: number, implement: Implement, units: Units): number {
  if (kg <= 0) return 0

  if (units === 'imperial') {
    const lb = kg / KG_PER_LB
    const rounded = Math.round(lb / INCREMENT_LB[implement]) * INCREMENT_LB[implement]
    return Math.max(INCREMENT_LB[implement], rounded) * KG_PER_LB
  }

  // Light dumbbells come in 1 kg steps; heavy ones do not.
  const step =
    implement === 'dumbbell' && kg < 10 ? 1 : INCREMENT_KG[implement]
  const rounded = Math.round(kg / step) * step
  return Math.max(step, rounded)
}

/**
 * Sex factors applied to the reference strength ratios.
 *
 * The gap is much larger in the upper body than the lower, which is why one
 * blanket multiplier would leave women under-loaded on squats and over-loaded
 * on presses. An undeclared sex sits between the two rather than assuming one.
 */
const SEX_FACTOR: Record<Sex, Record<BodyRegion, number>> = {
  male: { upper: 1.0, lower: 1.0, core: 1.0 },
  female: { upper: 0.65, lower: 0.8, core: 0.75 },
  unspecified: { upper: 0.825, lower: 0.9, core: 0.875 },
}

const EXPERIENCE_FACTOR: Record<LiftingExperience, number> = {
  none: 0.6,
  under_1_year: 0.8,
  '1_to_3_years': 1.0,
  '3_plus_years': 1.15,
}

/** Health flags start an athlete 15% lighter (PLAN.md §6.5). */
export const CONSERVATIVE_FACTOR = 0.85

export interface StartingLoadInput {
  bodyweightKg: number
  /** Reference working load as a fraction of bodyweight for this exercise. */
  strengthRatio: number
  region: BodyRegion
  implement: Implement
  sex: Sex
  experience: LiftingExperience
  units: Units
  conservativeMode?: boolean
}

export function startingLoadKg(input: StartingLoadInput): number {
  const raw =
    input.bodyweightKg *
    input.strengthRatio *
    SEX_FACTOR[input.sex][input.region] *
    EXPERIENCE_FACTOR[input.experience] *
    (input.conservativeMode ? CONSERVATIVE_FACTOR : 1)

  return roundToIncrement(raw, input.implement, input.units)
}

/**
 * Estimated one-rep max from a logged set (PLAN.md §6.5):
 *
 *   e1RM = kg × (1 + (reps + (10 − RPE)) / 30)
 *
 * Epley extended with reps in reserve, so a hard set of 5 and an easy set of 8
 * can be compared on one scale.
 */
export function estimatedOneRepMax(kg: number, reps: number, rpe: number): number {
  if (kg < 0) throw new RangeError('load cannot be negative')
  if (reps < 0) throw new RangeError('reps cannot be negative')
  if (rpe < 1 || rpe > 10) throw new RangeError('RPE is a 1–10 scale')
  return kg * (1 + (reps + (10 - rpe)) / 30)
}

/** Inverts the same formula: the load that should hit `reps` at `rpe`. */
export function loadForTarget(oneRepMax: number, reps: number, rpe: number): number {
  if (reps < 0) throw new RangeError('reps cannot be negative')
  if (rpe < 1 || rpe > 10) throw new RangeError('RPE is a 1–10 scale')
  return oneRepMax / (1 + (reps + (10 - rpe)) / 30)
}

/** The best estimate across a session's sets — the day's true top effort. */
export function sessionOneRepMax(
  sets: ReadonlyArray<{ kg: number; reps: number; rpe: number; done: boolean }>,
): number | null {
  const completed = sets.filter((set) => set.done && set.reps > 0 && set.kg > 0)
  if (completed.length === 0) return null
  return Math.max(...completed.map((set) => estimatedOneRepMax(set.kg, set.reps, set.rpe)))
}
