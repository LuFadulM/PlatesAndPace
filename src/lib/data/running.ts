import { createClient } from '@/lib/supabase/server'
import { toISODate, type PlainDate } from '@/domain/dates'
import { improvedBaseline, trainingPaces, type RecentRun, type TrainingPaces } from '@/domain/running'
import type { RaceDistanceKey } from '@/domain/profile/types'

/** Logged runs, oldest first, so the baseline ratchets in the order they happened. */
export async function getRunEfforts(since?: PlainDate): Promise<RecentRun[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  let query = supabase
    .from('run_logs')
    .select('km, minutes, date')
    .eq('user_id', user.id)
    .order('date')
    .limit(400)
  if (since) query = query.gte('date', toISODate(since))
  const { data } = await query
  return (data ?? [])
    .filter((r) => r.km !== null && r.minutes !== null)
    .map((r) => ({ km: Number(r.km), seconds: Number(r.minutes) * 60 }))
}

/**
 * The athlete's paces right now: the effort they gave at onboarding, improved
 * by every qualifying run they have logged since. Null for someone who does
 * not run.
 */
export async function getCurrentPaces(
  startingRun: RecentRun | undefined,
  targetRace?: RaceDistanceKey,
): Promise<{ paces: TrainingPaces; baseline: RecentRun } | null> {
  const efforts = await getRunEfforts()
  const baseline = improvedBaseline(startingRun, efforts)
  if (!baseline) return null
  return { paces: trainingPaces(baseline, targetRace), baseline }
}
