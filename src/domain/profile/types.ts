/**
 * The vocabulary the questionnaire produces and the engine consumes.
 *
 * These are stored in `questionnaire_answers.answers` and snapshotted into
 * `plans.settings`, so the string values are part of the data contract: renaming
 * one is a migration, not a refactor.
 */

export type Sex = 'female' | 'male' | 'unspecified'

export type Units = 'metric' | 'imperial'

export type PrimaryGoal =
  | 'build_muscle'
  | 'get_strong'
  | 'lose_fat'
  | 'fit_and_firm'
  | 'run_faster'
  | 'hybrid'

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
