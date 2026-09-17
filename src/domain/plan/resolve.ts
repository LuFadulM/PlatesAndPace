import { getExercise } from '../exercises/library'
import type { PrimaryGoal, Units } from '../profile/types'
import { loadForTarget, roundLoad, type PlateInventory } from '../strength/loads'
import { phaseParameters } from '../strength/periodization'
import { doubleProgression, progressionScheme, type LoggedSetLike, type ProgressionReason, type ProgressionScheme } from '../strength/progression'
import type { GymSession, PlannedExercise } from './generator'

/** The smallest step the implement offers, for double progression. */
const INCREMENT_KG: Record<string, number> = { barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, bodyweight: 0 }

export interface ResolveOptions {
  goal?: PrimaryGoal
  /** Last completed sets per exercise, for double progression. */
  lastSets?: Readonly<Record<string, readonly LoggedSetLike[]>>
  plates?: PlateInventory
}

export interface ResolvedProgression {
  scheme: ProgressionScheme
  reason: ProgressionReason | 'max'
}

export type ResolvedExercise = PlannedExercise & { progression?: ResolvedProgression }

export interface ResolvedSession extends GymSession {
  exercises: ResolvedExercise[]
}

/**
 * Re-derives working loads at the moment a session is opened (PLAN.md §3).
 * A session generated four weeks ago still shows this week's weights: the
 * compounds from the athlete's latest estimated maxes, the accessories from
 * whether they cleared the rep range last time, and every load rounded to
 * what the rack can actually hold.
 */
export function resolveLoads(
  gym: GymSession,
  week: number,
  totalWeeks: number,
  maxes: Readonly<Record<string, number>>,
  units: Units,
  options: ResolveOptions = {},
): ResolvedSession {
  const phase = phaseParameters(week, totalWeeks)
  const resolve = (e: PlannedExercise): ResolvedExercise => {
    const def = getExercise(e.exerciseId)
    if (e.loadKg === 0 || e.holdSeconds) return e
    const scheme = progressionScheme(e.role, def.category, options.goal ?? 'hypertrophy')
    const round = (kg: number) => roundLoad(kg, def.implement, units, options.plates)

    if (scheme === 'double_progression') {
      const last = options.lastSets?.[e.exerciseId]
      if (last && last.length > 0) {
        const result = doubleProgression({ repMin: e.repMin, repMax: e.repMax, lastSets: last, incrementKg: INCREMENT_KG[def.implement] ?? 2.5, plannedKg: e.loadKg })
        return { ...e, loadKg: round(result.kg), progression: { scheme, reason: result.reason } }
      }
    }

    const max = maxes[e.exerciseId]
    if (!max) return { ...e, loadKg: round(e.loadKg), progression: { scheme, reason: 'first' } }
    const reps = Math.round((e.repMin + e.repMax) / 2)
    const raw = loadForTarget(max, reps, e.rpeTarget) * phase.loadMultiplier
    return { ...e, loadKg: round(raw), progression: { scheme, reason: 'max' } }
  }
  return { ...gym, exercises: gym.exercises.map(resolve), finisher: gym.finisher ? resolve(gym.finisher) : undefined }
}
