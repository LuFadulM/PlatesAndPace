import { getExercise } from '../exercises/library'
import type { PrimaryGoal, Units } from '../profile/types'
import { loadForTarget, roundLoad, type PlateInventory } from '../strength/loads'
import { phaseParameters } from '../strength/periodization'
import { doubleProgression, progressionScheme, type LoggedSetLike, type ProgressionReason, type ProgressionScheme } from '../strength/progression'
import type { GymSession, PlannedExercise, RunSession } from './generator'
import type { TrainingPaces } from '../running'

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

/** Warm-up and cool-down either side of a threshold block, in minutes. */
const THRESHOLD_SHOULDER_MINUTES = 20
/** Easy kilometres either side of an interval session. */
const INTERVAL_SHOULDER_KM = 3
/** Warm-up plus cool-down around the reps, as the generator counts them. */
const INTERVAL_WARMUP_MINUTES = 15

const round1 = (km: number) => Math.round(km * 10) / 10

/**
 * Re-derives a run's targets from the athlete's current paces, the same way
 * `resolveLoads` re-derives weights.
 *
 * A session generated in week one still shows this week's paces, so the runs
 * an athlete logs actually change what the plan asks of them. Each kind keeps
 * whatever the generator treated as fixed — a long run keeps its distance and
 * an easy run keeps its duration — so getting faster means covering more
 * ground in the same time, not being handed a longer session.
 */
export function resolveRunPaces(run: RunSession, paces: TrainingPaces | null): RunSession {
  if (!paces) return run

  switch (run.kind) {
    case 'easy':
      return { ...run, paceSecPerKm: paces.easy, km: round1((run.minutes * 60) / paces.easy) }

    case 'long':
      return { ...run, paceSecPerKm: paces.long, minutes: Math.round((run.km * paces.long) / 60) }

    case 'threshold': {
      const work = run.hardMinutes
      const km = (work * 60) / paces.threshold + (THRESHOLD_SHOULDER_MINUTES * 60) / paces.easy
      return { ...run, paceSecPerKm: paces.threshold, minutes: work + THRESHOLD_SHOULDER_MINUTES, km: round1(km) }
    }

    case 'interval': {
      if (!run.intervals) return { ...run, paceSecPerKm: paces.interval }
      const intervals = { ...run.intervals, paceSecPerKm: paces.interval }
      const workKm = (intervals.reps * intervals.workMeters) / 1000
      const hardMinutes = (workKm * paces.interval) / 60
      return {
        ...run,
        intervals,
        paceSecPerKm: paces.interval,
        km: round1(workKm + INTERVAL_SHOULDER_KM),
        hardMinutes: Math.round(hardMinutes),
        // Warm-up and cool-down, the reps, and the rest between them. Left
        // alone it would still quote the old pace's total.
        minutes: Math.round(INTERVAL_WARMUP_MINUTES + hardMinutes + (intervals.reps * intervals.restSec) / 60),
      }
    }

    // Run/walk is prescribed in minutes by someone who cannot yet hold a pace.
    default:
      return run
  }
}
