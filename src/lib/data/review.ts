import { createClient } from '@/lib/supabase/server'
import { addDays, endOfPlanWeek, startOfPlanWeek, toISODate, type PlainDate } from '@/domain/dates'
import { summariseWeek, weeklyReview, type LoggedSetSample, type ReviewOutcome } from '@/domain/review'
import { getDoneDates, getPlannedDays } from './plan'

/**
 * Dates with a logged run. Saving a run writes a `run_logs` row and never sets
 * the session's done flag, so a run day is invisible to `getDoneDates`.
 */
async function runDates(from: PlainDate, to: PlainDate): Promise<Set<string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data } = await supabase
    .from('run_logs')
    .select('date')
    .eq('user_id', user.id)
    .gte('date', toISODate(from))
    .lte('date', toISODate(to))
  return new Set((data ?? []).map((r) => r.date))
}

/** Every RPE the athlete logged in a date range, with the day it belongs to. */
async function loggedRpe(from: PlainDate, to: PlainDate): Promise<LoggedSetSample[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('set_logs')
    .select('exercise_id, rpe, session_logs!inner(date)')
    .eq('user_id', user.id)
    .eq('done', true)
    .not('rpe', 'is', null)
    .gte('session_logs.date', toISODate(from))
    .lte('session_logs.date', toISODate(to))
    .limit(500)

  const samples: LoggedSetSample[] = []
  for (const row of data ?? []) {
    const rel = row.session_logs as unknown as { date: string } | { date: string }[] | null
    const date = Array.isArray(rel) ? rel[0]?.date : rel?.date
    if (!date) continue
    samples.push({ date, exerciseId: row.exercise_id, rpe: row.rpe === null ? null : Number(row.rpe) })
  }
  return samples
}

/**
 * The coach's verdict on the week before `today` (PLAN.md §6.8).
 *
 * Null before there is a week to judge: an athlete in their first week gets a
 * plan, not a report card. The outcome is recomputed on every read rather than
 * stored, so it always reflects sets logged late.
 */
export async function getLastWeekReview(today: PlainDate): Promise<ReviewOutcome | null> {
  const lastWeekStart = addDays(startOfPlanWeek(today), -7)
  const lastWeekEnd = endOfPlanWeek(lastWeekStart)

  const [days, done, rpe, runs] = await Promise.all([
    getPlannedDays(lastWeekStart, lastWeekEnd),
    getDoneDates(lastWeekStart, lastWeekEnd),
    loggedRpe(lastWeekStart, lastWeekEnd),
    runDates(lastWeekStart, lastWeekEnd),
  ])
  if (days.length === 0) return null

  const summary = summariseWeek(days, done, rpe, runs)
  if (summary.plannedSessions === 0) return null
  return weeklyReview(summary)
}
