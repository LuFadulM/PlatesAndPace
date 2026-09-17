'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const readinessSchema = z.object({ sleep: z.number().int().min(1).max(5), soreness: z.number().int().min(1).max(5), energy: z.number().int().min(1).max(5) })

/** Creates the day's session log if needed and returns its id. */
async function ensureSessionLog(date: string, plannedSessionId: string | null): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: existing } = await supabase.from('session_logs').select('id').eq('user_id', user.id).eq('date', date).maybeSingle()
  if (existing) return existing.id
  const { data } = await supabase
    .from('session_logs')
    .insert({ user_id: user.id, date, planned_session_id: plannedSessionId, started_at: new Date().toISOString() })
    .select('id')
    .single()
  return data?.id ?? null
}

export async function saveReadiness(input: { date: string; readiness: unknown }) {
  const date = isoDate.parse(input.date)
  const readiness = readinessSchema.parse(input.readiness)
  const supabase = await createClient()
  const id = await ensureSessionLog(date, null)
  if (!id) return { ok: false as const }
  await supabase.from('session_logs').update({ readiness: readiness as unknown as Json }).eq('id', id)
  return { ok: true as const }
}

const setSchema = z.object({
  exerciseId: z.string().min(1),
  setIndex: z.number().int().min(0),
  kg: z.number().min(0).nullable(),
  reps: z.number().int().min(0).max(100).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  done: z.boolean(),
  updatedAt: z.number(),
})

/**
 * Upserts a batch of set logs. Last write wins per (session, exercise, set) —
 * the same key the offline outbox collapses on — and an older client write
 * never overwrites a newer server row.
 */
export async function saveSets(input: { date: string; sets: unknown[] }) {
  const date = isoDate.parse(input.date)
  const sets = z.array(setSchema).parse(input.sets)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  const sessionLogId = await ensureSessionLog(date, null)
  if (!sessionLogId) return { ok: false as const }

  const { data: existing } = await supabase.from('set_logs').select('exercise_id, set_index, logged_at').eq('session_log_id', sessionLogId)
  const newerOnServer = new Set(
    (existing ?? [])
      .filter((row) => {
        const incoming = sets.find((s) => s.exerciseId === row.exercise_id && s.setIndex === row.set_index)
        return incoming !== undefined && new Date(row.logged_at).getTime() > incoming.updatedAt
      })
      .map((row) => `${row.exercise_id}:${row.set_index}`),
  )

  const rows = sets
    .filter((s) => !newerOnServer.has(`${s.exerciseId}:${s.setIndex}`))
    .map((s) => ({
      user_id: user.id,
      session_log_id: sessionLogId,
      exercise_id: s.exerciseId,
      set_index: s.setIndex,
      kg: s.kg,
      reps: s.reps,
      rpe: s.rpe,
      done: s.done,
      logged_at: new Date(s.updatedAt).toISOString(),
    }))

  if (rows.length > 0) {
    const { error } = await supabase.from('set_logs').upsert(rows, { onConflict: 'session_log_id,exercise_id,set_index' })
    if (error) return { ok: false as const }
  }
  return { ok: true as const, skipped: newerOnServer.size }
}

export async function finishSession(input: { date: string; notes?: string }) {
  const date = isoDate.parse(input.date)
  const supabase = await createClient()
  const id = await ensureSessionLog(date, null)
  if (!id) return { ok: false as const }
  await supabase.from('session_logs').update({ done: true, completed_at: new Date().toISOString(), notes: input.notes ?? null }).eq('id', id)
  revalidatePath('/', 'layout')
  return { ok: true as const }
}

const runSchema = z.object({
  date: isoDate,
  plannedType: z.enum(['easy', 'long', 'threshold', 'interval', 'run_walk', 'race', 'time_trial']).nullable(),
  minutes: z.number().positive(),
  km: z.number().positive(),
})

export async function saveRun(input: unknown) {
  const run = runSchema.parse(input)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  const sessionLogId = await ensureSessionLog(run.date, null)
  const pace = Math.round((run.minutes * 60) / run.km)
  const { error } = await supabase.from('run_logs').insert({
    user_id: user.id,
    session_log_id: sessionLogId,
    date: run.date,
    planned_type: run.plannedType,
    minutes: run.minutes,
    km: run.km,
    avg_pace_s_per_km: pace,
  })
  if (error) return { ok: false as const }
  revalidatePath('/', 'layout')
  return { ok: true as const }
}

const weightSchema = z.object({ date: isoDate, weightKg: z.number().min(25).max(400) })

/** One weight per day; a second entry for the same day replaces the first. */
export async function logWeight(input: unknown) {
  const parsed = weightSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  const { error } = await supabase
    .from('body_measurements')
    .upsert({ user_id: user.id, date: parsed.data.date, weight_kg: Math.round(parsed.data.weightKg * 100) / 100 }, { onConflict: 'user_id,date' })
  if (error) return { ok: false as const }
  revalidatePath('/', 'layout')
  return { ok: true as const }
}
