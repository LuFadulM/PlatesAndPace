import type { ExperienceTier, FocusArea } from '../profile/types'

/** Muscle groups the weekly volume budget is tracked against (PLAN.md §6.4). */
export type MuscleGroup =
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'abs'

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'abs',
]

export interface SetRange {
  min: number
  max: number
}

/** Weekly hard sets per muscle group, by training age. */
const BASE_TARGETS: Record<ExperienceTier, SetRange> = {
  beginner: { min: 8, max: 12 },
  intermediate: { min: 12, max: 16 },
  advanced: { min: 14, max: 20 },
}

export const FOCUS_AREA_BONUS_SETS = 4
/** Above this, added sets stop buying adaptation and start buying fatigue. */
export const MAX_WEEKLY_SETS = 22
export const CONSERVATIVE_VOLUME_FACTOR = 0.8

const FOCUS_AREA_MUSCLES: Record<FocusArea, readonly MuscleGroup[]> = {
  glutes: ['glutes'],
  legs: ['quads', 'hamstrings', 'calves'],
  arms: ['biceps', 'triceps'],
  shoulders: ['shoulders'],
  back: ['back'],
  chest: ['chest'],
  abs: ['abs'],
}

export function musclesForFocusArea(area: FocusArea): readonly MuscleGroup[] {
  return FOCUS_AREA_MUSCLES[area]
}

/**
 * The week's set budget per muscle group.
 *
 * Focus areas get more work, but never past the ceiling: past roughly 22 hard
 * sets a week the extra volume costs recovery without buying growth, so
 * "prioritise everything" is quietly not an option.
 */
export function weeklySetTargets(
  experience: ExperienceTier,
  focusAreas: readonly FocusArea[] = [],
  conservativeMode = false,
): Record<MuscleGroup, SetRange> {
  const base = BASE_TARGETS[experience]

  const focused = new Set<MuscleGroup>()
  for (const area of focusAreas) {
    for (const muscle of FOCUS_AREA_MUSCLES[area]) focused.add(muscle)
  }

  const targets = {} as Record<MuscleGroup, SetRange>

  for (const muscle of MUSCLE_GROUPS) {
    const bonus = focused.has(muscle) ? FOCUS_AREA_BONUS_SETS : 0
    let min = base.min + bonus
    let max = Math.min(base.max + bonus, MAX_WEEKLY_SETS)

    if (conservativeMode) {
      min = Math.round(min * CONSERVATIVE_VOLUME_FACTOR)
      max = Math.round(max * CONSERVATIVE_VOLUME_FACTOR)
    }

    targets[muscle] = { min, max: Math.max(min, max) }
  }

  return targets
}

/** Total weekly sets across every muscle group, for a sanity check on time. */
export function totalWeeklySets(targets: Record<MuscleGroup, SetRange>): SetRange {
  return MUSCLE_GROUPS.reduce<SetRange>(
    (total, muscle) => ({
      min: total.min + targets[muscle].min,
      max: total.max + targets[muscle].max,
    }),
    { min: 0, max: 0 },
  )
}
