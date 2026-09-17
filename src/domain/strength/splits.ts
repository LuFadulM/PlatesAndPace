import type { ExperienceTier, PrimaryGoal } from '../profile/types'

/** The shape of one gym day (PLAN.md §6.2). */
export type SessionKind =
  | 'full_body_a'
  | 'full_body_b'
  | 'full_body_c'
  | 'push'
  | 'pull'
  | 'legs'
  | 'upper'
  | 'lower'
  | 'lower_a'
  | 'upper_a'
  | 'glutes_lower_b'
  | 'upper_b'

export const MIN_GYM_DAYS = 2
export const MAX_GYM_DAYS = 6

/**
 * Picks the split for a given number of gym days.
 *
 * At three days the choice depends on experience: push/pull/legs concentrates
 * each muscle into one session a week, which suits a lifter who can already
 * generate enough stimulus in one go, while a beginner progresses faster
 * hitting everything three times a week.
 */
export function selectSplit(
  gymDays: number,
  experience: ExperienceTier,
  _goal: PrimaryGoal,
): SessionKind[] {
  if (!Number.isInteger(gymDays) || gymDays < MIN_GYM_DAYS || gymDays > MAX_GYM_DAYS) {
    throw new RangeError(`gym days must be an integer between ${MIN_GYM_DAYS} and ${MAX_GYM_DAYS}`)
  }

  switch (gymDays) {
    case 2:
      return ['full_body_a', 'full_body_b']
    case 3:
      return experience === 'beginner'
        ? ['full_body_a', 'full_body_b', 'full_body_c']
        : ['push', 'pull', 'legs']
    case 4:
      return ['upper', 'lower', 'upper', 'lower']
    case 5:
      return ['lower_a', 'upper_a', 'glutes_lower_b', 'upper_b', 'full_body_a']
    default:
      return ['push', 'pull', 'legs', 'push', 'pull', 'legs']
  }
}

/** Sessions that load the legs hard, and so interact with run days. */
const LOWER_BODY_SESSIONS: ReadonlySet<SessionKind> = new Set([
  'legs',
  'lower',
  'lower_a',
  'glutes_lower_b',
  'full_body_a',
  'full_body_b',
  'full_body_c',
])

export function isLowerBodySession(kind: SessionKind): boolean {
  return LOWER_BODY_SESSIONS.has(kind)
}

export type RunKind = 'easy' | 'long' | 'threshold' | 'interval' | 'run_walk' | 'none'

/** Hard running days, where leg work has to give way. */
export function isHardRunDay(run: RunKind): boolean {
  return run === 'interval' || run === 'long' || run === 'threshold'
}

export interface InterferenceLimits {
  /** Ceiling on hard lower-body sets for the day. */
  maxLowerBodySets: number
  /** Ceiling on RPE for lower-body primaries. */
  maxLowerBodyRpe: number
  /** Whether a heavy squat or deadlift pattern is allowed. */
  allowHeavyHinge: boolean
}

const UNRESTRICTED: InterferenceLimits = {
  maxLowerBodySets: Number.POSITIVE_INFINITY,
  maxLowerBodyRpe: 10,
  allowHeavyHinge: true,
}

/**
 * How much leg work a day can carry, given the running around it
 * (PLAN.md §6.3).
 *
 * Two separate cases. On a hard run day the legs are already taxed, so lifting
 * volume is capped. The day *before* a long run is the subtler one: nothing has
 * happened yet, but heavy lifting now is what turns Saturday's long run into a
 * session the athlete abandons at 6 km.
 */
export function interferenceLimits(
  goal: PrimaryGoal,
  todaysRun: RunKind,
  tomorrowsRun: RunKind,
): InterferenceLimits {
  const runMatters = goal === 'run_faster' || goal === 'hybrid'
  if (!runMatters) return UNRESTRICTED

  if (isHardRunDay(todaysRun)) {
    return { maxLowerBodySets: 4, maxLowerBodyRpe: 8, allowHeavyHinge: false }
  }

  if (tomorrowsRun === 'long') {
    return { maxLowerBodySets: 6, maxLowerBodyRpe: 7, allowHeavyHinge: false }
  }

  return UNRESTRICTED
}
