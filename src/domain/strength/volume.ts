import type { ExperienceTier, FocusArea } from '../profile/types'
import { startingVolumeFraction } from './goals'

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

/**
 * Weekly volume landmarks per muscle, in working sets (CLAUDE.md, rule 2).
 *
 * MV keeps what you have, MEV is the least that grows anything, MAV is where
 * most of the adaptation happens, MRV is the most you can recover from. The
 * numbers are Renaissance Periodization's landmarks; the evidence for exact
 * per-muscle values is thin and mixed, so they are a heuristic default kept in
 * one editable table, not a law. Abs and glutes get plenty of indirect work,
 * which is why their floors sit at zero.
 */
export interface VolumeLandmarks {
  mv: number
  mev: number
  mavMin: number
  mavMax: number
  mrv: number
}

export const VOLUME_LANDMARKS: Record<MuscleGroup, VolumeLandmarks> = {
  chest: { mv: 4, mev: 8, mavMin: 12, mavMax: 20, mrv: 22 },
  back: { mv: 6, mev: 10, mavMin: 14, mavMax: 22, mrv: 25 },
  shoulders: { mv: 6, mev: 8, mavMin: 16, mavMax: 22, mrv: 26 },
  biceps: { mv: 4, mev: 8, mavMin: 14, mavMax: 20, mrv: 26 },
  triceps: { mv: 4, mev: 6, mavMin: 10, mavMax: 14, mrv: 18 },
  quads: { mv: 6, mev: 8, mavMin: 12, mavMax: 18, mrv: 20 },
  hamstrings: { mv: 3, mev: 6, mavMin: 10, mavMax: 16, mrv: 20 },
  glutes: { mv: 0, mev: 4, mavMin: 8, mavMax: 16, mrv: 16 },
  calves: { mv: 6, mev: 8, mavMin: 12, mavMax: 16, mrv: 20 },
  abs: { mv: 0, mev: 0, mavMin: 16, mavMax: 20, mrv: 25 },
}

/** Direct sets per muscle in one session past which extra sets buy fatigue, not growth. */
export const MAX_SESSION_SETS_PER_MUSCLE = 10

/** Sets on one exercise before a second movement serves the muscle better. */
export const MAX_SETS_PER_SLOT = 5

/** A compound counts fully for its primary muscle and half for each secondary. */
export const SECONDARY_SET_CREDIT = 0.5

/** A muscle that has a slot in the split always gets at least this much practice a week. */
export const MIN_PRACTICE_SETS = 2

export interface WeeklyVolumeInput {
  tier: ExperienceTier
  /** 1-based week within the current accumulation (resets after a deload). */
  accumulationWeek: number
  deload: boolean
  focusAreas?: readonly FocusArea[]
  conservativeMode?: boolean
  /** The goal policy's volume scale; 1 for hypertrophy. */
  goalScale?: number
}

export const FOCUS_BONUS_SETS = 2
export const DELOAD_VOLUME_FRACTION = 0.55
export const SETS_ADDED_PER_WEEK = 1

/**
 * The week's target sets per muscle on the mesocycle ramp: start between MEV
 * and MAV by training age, add a set a week, never pass MRV, and drop to
 * about half in a deload.
 */
export function weeklyVolumeTargets(input: WeeklyVolumeInput): Record<MuscleGroup, number> {
  const targets = {} as Record<MuscleGroup, number>
  const focused = new Set<MuscleGroup>()
  for (const area of input.focusAreas ?? []) for (const m of FOCUS_AREA_MUSCLES[area]) focused.add(m)
  const scale = (input.goalScale ?? 1) * (input.conservativeMode ? CONSERVATIVE_VOLUME_FACTOR : 1)

  for (const muscle of MUSCLE_GROUPS) {
    const l = VOLUME_LANDMARKS[muscle]
    const start = l.mev + startingVolumeFraction(input.tier) * (l.mrv - l.mev)
    let sets = start + Math.max(0, input.accumulationWeek - 1) * SETS_ADDED_PER_WEEK
    if (focused.has(muscle)) sets += FOCUS_BONUS_SETS
    sets = Math.min(sets, l.mrv) * scale
    if (input.deload) sets = start * scale * DELOAD_VOLUME_FRACTION
    targets[muscle] = Math.max(MIN_PRACTICE_SETS, Math.round(sets))
  }
  return targets
}
