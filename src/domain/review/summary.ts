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
 * toward the denominator. A run-only day counts as done when a run was logged
 * for it: saving a run writes a `run_logs` row and never touches the session's
 * done flag, so without this a runner reads as having missed every session
 * they actually ran. A day that is both gym and run still needs the session
 * finished, because the run alone is half of it. An RPE is only a sample when the session that day
 * actually prescribed that exercise a target, so a lift the athlete added
 * themselves never argues that the programme was too hard.
 */
export function summariseWeek(
  days: readonly PlannedDay[],
  doneDates: ReadonlySet<string>,
  sets: readonly LoggedSetSample[],
  /** Dates with a logged run. Saving a run never sets the session's done flag. */
  runDates: ReadonlySet<string> = new Set(),
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
    completedSessions: working.filter((d) => doneDates.has(d.date) || (d.type === 'run' && runDates.has(d.date))).length,
    rpeSamples,
  }
}
