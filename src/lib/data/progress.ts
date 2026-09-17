import { createClient } from '@/lib/supabase/server'
import { addDays, fromISODate, startOfPlanWeek, toISODate, type PlainDate } from '@/domain/dates'
import { getExercise, findExercise } from '@/domain/exercises/library'
import { estimatedOneRepMax } from '@/domain/strength/loads'
import { VOLUME_LANDMARKS, type MuscleGroup } from '@/domain/strength/volume'

export interface WeekPoint { week: string; value: number }
export interface LiftSeries { exerciseId: string; points: { week: string; e1rm: number }[] }
export interface MuscleSets { muscle: MuscleGroup; sets: number; mev: number; mrv: number }
export interface RunPoint { date: string; km: number; paceSecPerKm: number }
export interface BodyPoint { date: string; weightKg: number | null; waistCm: number | null }

export interface ProgressData {
  sessionsPerWeek: WeekPoint[]
  streak: number
  lifts: LiftSeries[]
  weeklyVolume: MuscleSets[]
  runs: RunPoint[]
  body: BodyPoint[]
}

const weekOf = (iso: string) => toISODate(startOfPlanWeek(fromISODate(iso)))

export async function getProgress(today: PlainDate, weeks = 12): Promise<ProgressData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { sessionsPerWeek: [], streak: 0, lifts: [], weeklyVolume: [], runs: [], body: [] }
  const since = toISODate(addDays(startOfPlanWeek(today), -(weeks - 1) * 7))

  const [{ data: sessions }, { data: streak }, { data: sets }, { data: runs }, { data: body }] = await Promise.all([
    supabase.from('session_logs').select('date').eq('user_id', user.id).eq('done', true).gte('date', since),
    supabase.rpc('training_streak', { p_user_id: user.id }),
    supabase.from('set_logs').select('exercise_id, kg, reps, rpe, done, session_logs!inner(date)').eq('user_id', user.id).eq('done', true).gte('session_logs.date', since),
    supabase.from('run_logs').select('date, km, avg_pace_s_per_km').eq('user_id', user.id).gte('date', since).order('date'),
    supabase.from('body_measurements').select('date, weight_kg, waist_cm').eq('user_id', user.id).gte('date', since).order('date'),
  ])

  // Sessions per week, every week present even when zero.
  const counts = new Map<string, number>()
  for (let i = weeks - 1; i >= 0; i -= 1) counts.set(toISODate(addDays(startOfPlanWeek(today), -i * 7)), 0)
  for (const s of sessions ?? []) counts.set(weekOf(s.date), (counts.get(weekOf(s.date)) ?? 0) + 1)
  const sessionsPerWeek = [...counts.entries()].map(([week, value]) => ({ week, value }))

  // e1RM per lift per week, for the four most-logged loaded exercises.
  type Row = { exercise_id: string; kg: number | null; reps: number | null; rpe: number | null; session_logs: { date: string } | { date: string }[] }
  const rows = (sets ?? []) as unknown as Row[]
  const dateOf = (r: Row) => (Array.isArray(r.session_logs) ? r.session_logs[0]?.date : r.session_logs?.date) ?? ''
  const frequency = new Map<string, number>()
  for (const r of rows) if (r.kg && r.kg > 0) frequency.set(r.exercise_id, (frequency.get(r.exercise_id) ?? 0) + 1)
  const topLifts = [...frequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id)
  const lifts: LiftSeries[] = topLifts.map((exerciseId) => {
    const byWeek = new Map<string, number>()
    for (const r of rows) {
      if (r.exercise_id !== exerciseId || !r.kg || !r.reps || r.rpe === null) continue
      const w = weekOf(dateOf(r))
      const e = estimatedOneRepMax(Number(r.kg), r.reps, Number(r.rpe))
      if ((byWeek.get(w) ?? 0) < e) byWeek.set(w, e)
    }
    return { exerciseId, points: [...byWeek.entries()].sort().map(([week, e1rm]) => ({ week, e1rm: Math.round(e1rm) })) }
  })

  // This week's hard sets per muscle group.
  const thisWeek = toISODate(startOfPlanWeek(today))
  const volume = new Map<MuscleGroup, number>()
  for (const r of rows) {
    if (weekOf(dateOf(r)) !== thisWeek) continue
    const ex = findExercise(r.exercise_id)
    if (!ex) continue
    volume.set(ex.primary, (volume.get(ex.primary) ?? 0) + 1)
  }
  const weeklyVolume = [...volume.entries()].map(([muscle, sets]) => ({ muscle, sets, mev: VOLUME_LANDMARKS[muscle].mev, mrv: VOLUME_LANDMARKS[muscle].mrv })).sort((a, b) => b.sets - a.sets)

  return {
    sessionsPerWeek,
    streak: streak ?? 0,
    lifts,
    weeklyVolume,
    runs: (runs ?? []).filter((r) => r.km && r.avg_pace_s_per_km).map((r) => ({ date: r.date, km: Number(r.km), paceSecPerKm: r.avg_pace_s_per_km! })),
    body: (body ?? []).map((b) => ({ date: b.date, weightKg: b.weight_kg === null ? null : Number(b.weight_kg), waistCm: b.waist_cm === null ? null : Number(b.waist_cm) })),
  }
}

export { getExercise }
