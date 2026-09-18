import type { PlannedDay } from '../plan/generator'
import type { RpeSample, WeekSummary } from '.'

/** One logged set, as the database hands it over. */
export interface LoggedSetSample {
  date: string
  exerciseId: string
  rpe: number | null
}

/**
 * Last week as the review reads it: what was asked, what happened, and how
 * hard it felt against what was asked.
 *
 * A rest day is not a missed session, so only days that carried work count
 * toward the denominator. An RPE is only a sample when the session that day
 * actually prescribed that exercise a target, so a lift the athlete added
 * themselves never argues that the programme was too hard.
 */
export function summariseWeek(
  days: readonly PlannedDay[],
  doneDates: ReadonlySet<string>,
  sets: readonly LoggedSetSample[],
): WeekSummary {
  const working = days.filter((d) => d.type !== 'rest')

  const targets = new Map<string, number>()
  for (const day of working) {
    for (const e of day.gym?.exercises ?? []) targets.set(`${day.date}:${e.exerciseId}`, e.rpeTarget)
    if (day.gym?.finisher) targets.set(`${day.date}:${day.gym.finisher.exerciseId}`, day.gym.finisher.rpeTarget)
  }

  const rpeSamples: RpeSample[] = []
  for (const set of sets) {
    if (set.rpe === null) continue
    const target = targets.get(`${set.date}:${set.exerciseId}`)
    if (target === undefined) continue
    rpeSamples.push({ logged: set.rpe, target })
  }

  return {
    plannedSessions: working.length,
    completedSessions: working.filter((d) => doneDates.has(d.date)).length,
    rpeSamples,
  }
}
