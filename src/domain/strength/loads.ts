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

/** Brzycki's estimate: kg × 36 / (37 − reps). Diverges from Epley past ten reps. */
export function brzyckiOneRepMax(kg: number, reps: number): number {
  if (kg < 0) throw new RangeError('load cannot be negative')
  if (reps < 1 || reps >= 37) throw new RangeError('Brzycki holds for 1 to 36 reps')
  return (kg * 36) / (37 - reps)
}

export type MaxConfidence = 'high' | 'medium' | 'low'

/**
 * How much to trust an estimated max from a set of this many reps. Epley is
 * reliable to about ten; past twelve the estimate is more about endurance
 * than strength, and the UI says so.
 */
export function oneRepMaxConfidence(reps: number): MaxConfidence {
  if (reps <= 10) return 'high'
  if (reps <= 12) return 'medium'
  return 'low'
}

/** What is actually on the rack: a bar and the plate pairs available. Kilograms throughout. */
export interface PlateInventory {
  barKg: number
  /** Each weight assumed available in unlimited pairs. */
  platePairsKg: readonly number[]
}

const LB = KG_PER_LB
export const DEFAULT_PLATES: Record<Units, PlateInventory> = {
  metric: { barKg: 20, platePairsKg: [25, 20, 15, 10, 5, 2.5, 1.25] },
  imperial: { barKg: 45 * LB, platePairsKg: [45 * LB, 35 * LB, 25 * LB, 10 * LB, 5 * LB, 2.5 * LB] },
}

export interface BarbellLoad {
  kg: number
  /** Plates on one side, heaviest first, in kilograms. */
  perSideKg: number[]
}

/** The heaviest bar the inventory can make at or under the target. */
export function heaviestLoadableUnder(targetKg: number, inventory: PlateInventory): BarbellLoad {
  const plates = [...inventory.platePairsKg].sort((a, b) => b - a)
  let side = Math.max(0, (targetKg - inventory.barKg) / 2)
  const perSideKg: number[] = []
  for (const plate of plates) {
    while (side + 1e-9 >= plate) {
      perSideKg.push(plate)
      side -= plate
    }
  }
  const kg = inventory.barKg + 2 * perSideKg.reduce((a, b) => a + b, 0)
  return { kg: Math.round(kg * 100) / 100, perSideKg }
}

/**
 * The loadable bar nearest the target: the heaviest under it, or one smallest
 * plate pair up when that is closer. A target below the bar is the bar.
 */
export function nearestLoadable(targetKg: number, inventory: PlateInventory): BarbellLoad {
  if (targetKg <= inventory.barKg) return { kg: inventory.barKg, perSideKg: [] }
  const under = heaviestLoadableUnder(targetKg, inventory)
  const smallest = Math.min(...inventory.platePairsKg)
  if (!Number.isFinite(smallest)) return under
  const over = heaviestLoadableUnder(under.kg + 2 * smallest + 1e-6, inventory)
  return over.kg - targetKg < targetKg - under.kg ? over : under
}

/** Rounds to a real load: plates for a barbell when the rack is known, increments otherwise. */
export function roundLoad(kg: number, implement: Implement, units: Units, plates?: PlateInventory): number {
  if (kg <= 0) return 0
  if (implement === 'barbell' && plates) return nearestLoadable(kg, plates).kg
  return roundToIncrement(kg, implement, units)
}
