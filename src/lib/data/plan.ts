import { createClient } from '@/lib/supabase/server'
import { addDays, toISODate, type PlainDate } from '@/domain/dates'
import type { PlannedDay } from '@/domain/plan'
import type { Tables } from '@/types/database'

export type PlanRow = Tables<'plans'>
export type PlannedSessionRow = Tables<'planned_sessions'>

export async function getCurrentPlan(): Promise<PlanRow | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('plans').select('*').eq('user_id', user.id).order('block', { ascending: false }).limit(1).maybeSingle()
  return data
}

export async function getPlannedDay(date: string): Promise<PlannedDay | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('planned_sessions').select('content').eq('user_id', user.id).eq('date', date).maybeSingle()
  return (data?.content as unknown as PlannedDay | undefined) ?? null
}

export async function getPlannedDays(from: PlainDate, to: PlainDate): Promise<PlannedDay[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('planned_sessions')
    .select('content')
    .eq('user_id', user.id)
    .gte('date', toISODate(from))
    .lte('date', toISODate(to))
    .order('date')
  return (data ?? []).map((r) => r.content as unknown as PlannedDay)
}

/** Done flags for a date range, for the calendar and the week strip. */
export async function getDoneDates(from: PlainDate, to: PlainDate): Promise<Set<string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data } = await supabase
    .from('session_logs')
    .select('date')
    .eq('user_id', user.id)
    .eq('done', true)
    .gte('date', toISODate(from))
    .lte('date', toISODate(to))
  return new Set((data ?? []).map((r) => r.date))
}

export { addDays }
