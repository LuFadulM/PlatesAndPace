import { createClient } from '@/lib/supabase/server'
import { estimatedOneRepMax } from '@/domain/strength/loads'
import { addDays, fromISODate, toISODate, type PlainDate } from '@/domain/dates'
import type { Tables } from '@/types/database'

export type SessionLog = Tables<'session_logs'>
export type SetLog = Tables<'set_logs'>
export type RunLog = Tables<'run_logs'>

/** The athlete's best estimated 1RM per exercise over the last `weeks`. */
export async function latestMaxes(today: PlainDate, weeks = 8): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}
  const since = toISODate(addDays(today, -weeks * 7))
  const { data } = await supabase
    .from('set_logs')
    .select('exercise_id, kg, reps, rpe, done, session_logs!inner(date)')
    .eq('user_id', user.id)
    .eq('done', true)
    .gte('session_logs.date', since)
  const maxes: Record<string, number> = {}
  for (const row of data ?? []) {
    if (row.kg === null || row.reps === null || row.rpe === null || row.kg <= 0 || row.reps <= 0) continue
    const e1rm = estimatedOneRepMax(Number(row.kg), row.reps, Number(row.rpe))
    if (!maxes[row.exercise_id] || e1rm > maxes[row.exercise_id]!) maxes[row.exercise_id] = e1rm
  }
  return maxes
}

export async function exerciseIdsUsedSince(date: PlainDate): Promise<Set<string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data } = await supabase
    .from('set_logs')
    .select('exercise_id, session_logs!inner(date)')
    .eq('user_id', user.id)
    .gte('session_logs.date', toISODate(date))
  return new Set((data ?? []).map((r) => r.exercise_id))
}

export async function getSessionLogWithSets(date: string): Promise<{ log: SessionLog | null; sets: SetLog[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { log: null, sets: [] }
  const { data: log } = await supabase.from('session_logs').select('*').eq('user_id', user.id).eq('date', date).maybeSingle()
  if (!log) return { log: null, sets: [] }
  const { data: sets } = await supabase.from('set_logs').select('*').eq('session_log_id', log.id).order('set_index')
  return { log, sets: sets ?? [] }
}

export async function getSwaps(): Promise<Map<string, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Map()
  const { data } = await supabase
    .from('exercise_preferences')
    .select('from_exercise_id, to_exercise_id')
    .eq('user_id', user.id)
    .eq('scope', 'global')
  const swaps = new Map<string, string>()
  for (const row of data ?? []) if (row.to_exercise_id) swaps.set(row.from_exercise_id, row.to_exercise_id)
  return swaps
}

export async function getGlobalExclusions(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('exercise_preferences')
    .select('from_exercise_id')
    .eq('user_id', user.id)
    .eq('scope', 'global')
    .is('to_exercise_id', null)
  return (data ?? []).map((r) => r.from_exercise_id)
}

export { fromISODate }
