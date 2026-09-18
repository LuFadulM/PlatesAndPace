import { createClient } from '@/lib/supabase/server'
import { addDays, endOfPlanWeek, startOfPlanWeek, toISODate, type PlainDate } from '@/domain/dates'
import { estimatedOneRepMax } from '@/domain/strength/loads'
import { deloadAdvice, type DeloadAdvice, type LiftHistory } from '@/domain/strength/deload'
import { getExercise } from '@/domain/exercises/library'
import { SECONDARY_SET_CREDIT, type MuscleGroup } from '@/domain/strength/volume'

/** Sessions of history to read when looking for a stall. */
const STALL_WINDOW_SESSIONS = 4
const READINESS_DAYS = 10

/** The embedded session row arrives as an object or a one-element array. */
function dateOf(row: { session_logs?: unknown }): string | undefined {
  const rel = row.session_logs as { date: string } | { date: string }[] | null | undefined
  if (!rel) return undefined
  return Array.isArray(rel) ? rel[0]?.date : rel.date
}

/**
 * The evidence behind a deload recommendation (CLAUDE.md, rule 2): whether the
 * main lifts have stopped moving, whether readiness has been poor for days
 * running, and whether this week's volume has reached what the athlete can
 * recover from.
 */
export async function getDeloadAdvice(today: PlainDate, pain: PainHistory): Promise<DeloadAdvice> {
  const empty = { lifts: [], readinessScores: [], weeklySets: {} }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return deloadAdvice(empty)

  const weekStart = startOfPlanWeek(today)
  const [{ data: sets }, { data: logs }, { data: weekSets }] = await Promise.all([
    supabase
      .from('set_logs')
      .select('exercise_id, kg, reps, rpe, session_logs!inner(date)')
      .eq('user_id', user.id)
      .eq('done', true)
      .gte('session_logs.date', toISODate(addDays(today, -56)))
      // Newest first: a high-volume athlete crosses the cap inside the window,
      // and an arbitrary subset can flip the stall trigger either way.
      .order('logged_at', { ascending: false })
      .limit(2000),
    supabase
      .from('session_logs')
      .select('date, readiness')
      .eq('user_id', user.id)
      .not('readiness', 'is', null)
      .gte('date', toISODate(addDays(today, -READINESS_DAYS)))
      .lte('date', toISODate(today))
      .order('date'),
    supabase
      .from('set_logs')
      .select('exercise_id, session_logs!inner(date)')
      .eq('user_id', user.id)
      .eq('done', true)
      .gte('session_logs.date', toISODate(weekStart))
      .lte('session_logs.date', toISODate(endOfPlanWeek(today)))
      .limit(1000),
  ])

  // Best estimate per lift per session, oldest session first.
  const perLift = new Map<string, Map<string, number>>()
  for (const row of sets ?? []) {
    const date = dateOf(row)
    if (!date || row.kg === null || row.reps === null || row.rpe === null || row.kg <= 0 || row.reps <= 0) continue
    const e1rm = estimatedOneRepMax(Number(row.kg), row.reps, Number(row.rpe))
    const byDate = perLift.get(row.exercise_id) ?? new Map<string, number>()
    byDate.set(date, Math.max(byDate.get(date) ?? 0, e1rm))
    perLift.set(row.exercise_id, byDate)
  }

  const lifts: LiftHistory[] = []
  for (const [exerciseId, byDate] of perLift) {
    const e1rms = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, e1rm]) => e1rm)
    // Only the compounds are worth judging: an isolation lift's estimate is
    // noise, and nobody deloads because their lateral raise held steady.
    let category
    try {
      category = getExercise(exerciseId).category
    } catch {
      continue // a row for an exercise no longer in the library
    }
    if (category !== 'compound') continue
    lifts.push({ exerciseId, e1rms: e1rms.slice(-STALL_WINDOW_SESSIONS) })
  }

  // One entry per calendar day so "three days running" measures consecutive
  // days. A day with no answer is null and breaks the run, rather than being
  // skipped so that three flat gym days across a week look consecutive.
  const answered = new Map<string, number>()
  for (const log of logs ?? []) {
    const r = log.readiness as { sleep?: number; soreness?: number; energy?: number } | null
    if (!r?.sleep || !r?.soreness || !r?.energy) continue
    answered.set(log.date, (r.sleep + r.soreness + r.energy) / 3)
  }
  const readinessScores: (number | null)[] = []
  for (let back = READINESS_DAYS - 1; back >= 0; back -= 1) {
    readinessScores.push(answered.get(toISODate(addDays(today, -back))) ?? null)
  }

  const weeklySets: Partial<Record<MuscleGroup, number>> = {}
  for (const row of weekSets ?? []) {
    let def
    try {
      def = getExercise(row.exercise_id)
    } catch {
      continue // a row for an exercise no longer in the library
    }
    weeklySets[def.primary] = (weeklySets[def.primary] ?? 0) + 1
    for (const m of def.secondary) weeklySets[m] = (weeklySets[m] ?? 0) + SECONDARY_SET_CREDIT
  }

  return deloadAdvice({ lifts, readinessScores, weeklySets, painReports: painByExercise(pain) })
}

export interface PainEntry {
  date: string
  exerciseId: string
  severity: number
}

export interface PainHistory {
  /** Every report in the window, oldest first. */
  entries: PainEntry[]
}

/** What was reported on one day, for the control's current state. */
export function painOn(history: PainHistory, date: string): Record<string, number> {
  const result: Record<string, number> = {}
  for (const entry of history.entries) if (entry.date === date) result[entry.exerciseId] = entry.severity
  return result
}

/**
 * How often each movement hurt on days *other than* this one. The control says
 * "this has hurt before", so counting the report the athlete just made would
 * make every first report read as a repeat.
 */
export function painBefore(history: PainHistory, date: string): Record<string, number> {
  const result: Record<string, number> = {}
  for (const entry of history.entries) {
    if (entry.date === date || entry.severity < 2) continue
    result[entry.exerciseId] = (result[entry.exerciseId] ?? 0) + 1
  }
  return result
}

/** Severities per exercise, oldest first, as the deload trigger reads them. */
export function painByExercise(history: PainHistory): Record<string, number[]> {
  const result: Record<string, number[]> = {}
  for (const entry of history.entries) (result[entry.exerciseId] ??= []).push(entry.severity)
  return result
}

/**
 * Pain reported per movement over recent sessions, oldest first. One read
 * serves both the fourth deload trigger and the per-exercise control, which
 * would otherwise ask the same column two different ways.
 */
export async function getPainReports(today: PlainDate, days = 42): Promise<PainHistory> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { entries: [] }
  const { data } = await supabase
    .from('session_logs')
    .select('date, pain')
    .eq('user_id', user.id)
    .not('pain', 'is', null)
    .gte('date', toISODate(addDays(today, -days)))
    .lte('date', toISODate(today))
    .order('date')

  const entries: PainEntry[] = []
  for (const row of data ?? []) {
    const pain = row.pain as Record<string, unknown> | null
    if (!pain) continue
    for (const [exerciseId, value] of Object.entries(pain)) {
      const severity = Number(value)
      if (!Number.isFinite(severity) || severity <= 0) continue
      entries.push({ date: row.date, exerciseId, severity })
    }
  }
  return { entries }
}

