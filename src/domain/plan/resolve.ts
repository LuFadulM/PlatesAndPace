import { loadForTarget, roundToIncrement } from '../strength/loads'
import { phaseParameters } from '../strength/periodization'
import { getExercise } from '../exercises/library'
import type { Units } from '../profile/types'
import type { GymSession } from './generator'

/**
 * Re-derives working loads from the athlete's latest estimated maxes at the
 * moment a session is opened (PLAN.md §3). A session generated four weeks ago
 * still shows this week's weights.
 */
export function resolveLoads(
  gym: GymSession,
  week: number,
  totalWeeks: number,
  maxes: Readonly<Record<string, number>>,
  units: Units,
): GymSession {
  const phase = phaseParameters(week, totalWeeks)
  const resolve = (e: GymSession['exercises'][number]) => {
    const max = maxes[e.exerciseId]
    if (!max || e.loadKg === 0) return e
    const reps = Math.round((e.repMin + e.repMax) / 2)
    const raw = loadForTarget(max, reps, e.rpeTarget) * phase.loadMultiplier
    return { ...e, loadKg: roundToIncrement(raw, getExercise(e.exerciseId).implement, units) }
  }
  return { ...gym, exercises: gym.exercises.map(resolve), finisher: gym.finisher ? resolve(gym.finisher) : undefined }
}
