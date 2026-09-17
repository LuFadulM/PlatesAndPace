/**
 * The vocabulary the questionnaire produces and the engine consumes.
 *
 * These are stored in `questionnaire_answers.answers` and snapshotted into
 * `plans.settings`, so the string values are part of the data contract: renaming
 * one is a migration, not a refactor.
 */

export type Sex = 'female' | 'male' | 'unspecified'

export type Units = 'metric' | 'imperial'

/**
 * The eight goals, each with its own programming signature (CLAUDE.md).
 * These strings are stored; see `normaliseGoal` for the values older
 * questionnaires wrote.
 */
export type PrimaryGoal =
  | 'hypertrophy'
  | 'strength'
  | 'fat_loss'
  | 'recomposition'
  | 'endurance'
  | 'athletic_performance'
  | 'general_health'
  | 'mobility_rehab'

export const PRIMARY_GOALS: readonly PrimaryGoal[] = [
  'hypertrophy',
  'strength',
  'fat_loss',
  'recomposition',
  'endurance',
  'athletic_performance',
  'general_health',
  'mobility_rehab',
]

/** What an athlete may add beside the primary goal. */
export type SecondaryGoal = 'endurance' | 'hypertrophy' | 'strength' | 'general_health'

export const SECONDARY_GOALS: readonly SecondaryGoal[] = ['endurance', 'hypertrophy', 'strength', 'general_health']

/** The first vocabulary. Still present in stored answers; never written again. */
export type LegacyGoal = 'build_muscle' | 'get_strong' | 'lose_fat' | 'fit_and_firm' | 'run_faster' | 'hybrid'

export const LEGACY_GOALS: readonly LegacyGoal[] = ['build_muscle', 'get_strong', 'lose_fat', 'fit_and_firm', 'run_faster', 'hybrid']

const LEGACY_GOAL_MAP: Record<LegacyGoal, { primary: PrimaryGoal; secondary?: SecondaryGoal }> = {
  build_muscle: { primary: 'hypertrophy' },
  get_strong: { primary: 'strength' },
  lose_fat: { primary: 'fat_loss' },
  fit_and_firm: { primary: 'general_health' },
  run_faster: { primary: 'endurance' },
  // "Both: lift and run" was a goal; it is now a primary with running beside it.
  hybrid: { primary: 'hypertrophy', secondary: 'endurance' },
}

export function isLegacyGoal(value: string): value is LegacyGoal {
  return (LEGACY_GOALS as readonly string[]).includes(value)
}

export function isPrimaryGoal(value: string): value is PrimaryGoal {
  return (PRIMARY_GOALS as readonly string[]).includes(value)
}

/** Maps any stored goal value, old or new, to the current vocabulary. */
export function normaliseGoal(value: string): { primary: PrimaryGoal; secondary?: SecondaryGoal } {
  if (isPrimaryGoal(value)) return { primary: value }
  if (isLegacyGoal(value)) return LEGACY_GOAL_MAP[value]
  throw new RangeError(`unknown goal: ${value}`)
}

export type LiftingExperience = 'none' | 'under_1_year' | '1_to_3_years' | '3_plus_years'

export type ExperienceTier = 'beginner' | 'intermediate' | 'advanced'

export type EquipmentSetting = 'full_gym' | 'dumbbells_bench' | 'home_none'

export type InjuryArea = 'knees' | 'lower_back' | 'shoulders' | 'hips' | 'wrists' | 'neck'

export type FocusArea = 'glutes' | 'legs' | 'arms' | 'shoulders' | 'back' | 'chest' | 'abs'

export type IntensityPreference = 'moderate' | 'hard' | 'very_hard'

/** Race distances the running engine can target, in kilometres. */
export const RACE_DISTANCES_KM = {
  '5k': 5,
  '10k': 10,
  half: 21.0975,
} as const

export type RaceDistanceKey = keyof typeof RACE_DISTANCES_KM

export function experienceTier(experience: LiftingExperience): ExperienceTier {
  switch (experience) {
    case 'none':
    case 'under_1_year':
      return 'beginner'
    case '1_to_3_years':
      return 'intermediate'
    case '3_plus_years':
      return 'advanced'
  }
}

/** Whole years from a birth date to a reference date, in calendar terms. */
export function ageOn(
  birth: { year: number; month: number; day: number },
  on: { year: number; month: number; day: number },
): number {
  let age = on.year - birth.year
  const hadBirthday =
    on.month > birth.month || (on.month === birth.month && on.day >= birth.day)
  if (!hadBirthday) age -= 1
  return age
}
