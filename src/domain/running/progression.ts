/**
 * Week-to-week running progressions (PLAN.md §6.7).
 *
 * Two rules do most of the injury prevention here: the long run grows by at
 * most 10% a week, and every fourth week cuts back. Both are in the engine
 * rather than in a screen so that no plan can be generated without them.
 */
export const MAX_WEEKLY_LONG_RUN_GROWTH = 0.1
export const RECOVERY_WEEK_REDUCTION = 0.25
export const DEFAULT_RECOVERY_EVERY = 4

export interface LongRunWeek {
  week: number
  km: number
  recovery: boolean
}

export interface LongRunOptions {
  /** Cut back every Nth week. 3 or 4 in practice. */
  recoveryEvery?: number
  /** Ceiling for the long run, e.g. ~18–20 km when training for a half. */
  maxKm?: number
}

/** Rounds to the nearest half kilometre — the resolution a runner actually uses. */
function roundKm(km: number): number {
  return Math.round(km * 2) / 2
}

/**
 * Builds the long-run ladder for a block.
 *
 * Growth compounds from the last *build* week, not from the recovery week, so a
 * cutback does not cost the athlete two weeks of progress.
 */
export function longRunProgression(
  startKm: number,
  weeks: number,
  options: LongRunOptions = {},
): LongRunWeek[] {
  if (startKm <= 0) throw new RangeError('starting distance must be positive')
  if (weeks < 1) throw new RangeError('a block is at least one week')

  const recoveryEvery = options.recoveryEvery ?? DEFAULT_RECOVERY_EVERY
  const maxKm = options.maxKm ?? Number.POSITIVE_INFINITY

  const plan: LongRunWeek[] = []
  let lastBuild = Math.min(startKm, maxKm)

  for (let week = 1; week <= weeks; week += 1) {
    if (week === 1) {
      plan.push({ week, km: roundKm(lastBuild), recovery: false })
      continue
    }

    const isRecovery = week % recoveryEvery === 0
    if (isRecovery) {
      plan.push({ week, km: roundKm(lastBuild * (1 - RECOVERY_WEEK_REDUCTION)), recovery: true })
      continue
    }

    lastBuild = Math.min(lastBuild * (1 + MAX_WEEKLY_LONG_RUN_GROWTH), maxKm)
    plan.push({ week, km: roundKm(lastBuild), recovery: false })
  }

  return plan
}

export interface RunWalkWeek {
  week: number
  repeats: number
  runMinutes: number
  walkMinutes: number
  totalMinutes: number
  /** True once the athlete is running the whole session without walk breaks. */
  continuous: boolean
}

export const RUN_WALK_TARGET_MINUTES = 30
export const CONTINUOUS_GOAL_MINUTES = 30

/**
 * The ladder for someone who cannot yet run continuously (PLAN.md §6.7).
 *
 * Run intervals lengthen a minute a week and walk breaks shorten, holding the
 * session near half an hour, until the run interval reaches the goal and the
 * session becomes one continuous run.
 */
export function runWalkProgression(
  continuousMinutes: number,
  weeks: number,
  targetMinutes = RUN_WALK_TARGET_MINUTES,
): RunWalkWeek[] {
  if (continuousMinutes < 0) throw new RangeError('continuous minutes cannot be negative')
  if (weeks < 1) throw new RangeError('a block is at least one week')

  const plan: RunWalkWeek[] = []
  // Start at what they can already hold, capped so week one is never daunting.
  let runMinutes = Math.max(1, Math.min(Math.floor(continuousMinutes) || 1, 5))

  for (let week = 1; week <= weeks; week += 1) {
    if (runMinutes >= CONTINUOUS_GOAL_MINUTES) {
      plan.push({
        week,
        repeats: 1,
        runMinutes: CONTINUOUS_GOAL_MINUTES,
        walkMinutes: 0,
        totalMinutes: CONTINUOUS_GOAL_MINUTES,
        continuous: true,
      })
      continue
    }

    // Walk breaks shrink from 2 minutes to 1 as the run intervals grow.
    const walkMinutes = runMinutes >= 10 ? 1 : 2
    const repeats = Math.max(1, Math.round(targetMinutes / (runMinutes + walkMinutes)))

    plan.push({
      week,
      repeats,
      runMinutes,
      walkMinutes,
      totalMinutes: repeats * (runMinutes + walkMinutes),
      continuous: false,
    })

    runMinutes += 1
  }

  return plan
}
