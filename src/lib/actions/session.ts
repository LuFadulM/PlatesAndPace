'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { compareDates, fromISODate, todayInZone } from '@/domain/dates'
import { EXERCISE_IDS } from '@/domain/exercises/library'
import {
  EDIT_LIMITS,
  addExercise,
  moveExercise,
  removeExercise,
  swapExercise,
  updateExercise,
  type EditContext,
} from '@/domain/plan/edit'
import type { GymSession, PlannedDay } from '@/domain/plan'
import { buildAthleteModel } from '@/domain/profile/athlete'
import { latestMaxes } from '@/lib/data/logs'
import { getCurrentPlan } from '@/lib/data/plan'
import { getActiveAnswers } from '@/lib/data/profile'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const exerciseId = z.string().refine((id) => EXERCISE_IDS.includes(id), 'unknown exercise')

const editSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('swap'), from: exerciseId, to: exerciseId, scope: z.enum(['session', 'global']) }),
  z.object({ op: z.literal('add'), exerciseId }),
  z.object({ op: z.literal('remove'), exerciseId }),
  z.object({ op: z.literal('move'), exerciseId, direction: z.enum(['up', 'down']) }),
  z.object({
    op: z.literal('update'),
    exerciseId,
    sets: z.number().int().min(EDIT_LIMITS.sets.min).max(EDIT_LIMITS.sets.max),
    repMin: z.number().int().min(EDIT_LIMITS.reps.min).max(EDIT_LIMITS.reps.max),
    repMax: z.number().int().min(EDIT_LIMITS.reps.min).max(EDIT_LIMITS.reps.max),
    loadKg: z.number().min(EDIT_LIMITS.loadKg.min).max(EDIT_LIMITS.loadKg.max),
    restSec: z.number().int().min(EDIT_LIMITS.restSec.min).max(EDIT_LIMITS.restSec.max),
    rpeTarget: z.number().min(EDIT_LIMITS.rpeTarget.min).max(EDIT_LIMITS.rpeTarget.max),
  }),
])

export type SessionEdit = z.infer<typeof editSchema>

const inputSchema = z.object({ date: isoDate, edit: editSchema })

type Result = { ok: true } | { ok: false; errorKey: string }
const fail = (errorKey: string): Result => ({ ok: false, errorKey })

function applyEdit(gym: GymSession, edit: SessionEdit, ctx: EditContext): GymSession {
  switch (edit.op) {
    case 'swap':
      return swapExercise(gym, edit.from, edit.to, ctx)
    case 'add':
      return addExercise(gym, edit.exerciseId, ctx)
    case 'remove':
      return removeExercise(gym, edit.exerciseId)
    case 'move':
      return moveExercise(gym, edit.exerciseId, edit.direction)
    case 'update':
      return updateExercise(gym, edit.exerciseId, edit, ctx.model.units)
  }
}

/**
 * Edits one day's gym session by hand: swap, add, remove, reorder, or change
 * the numbers of an exercise. Today and later only — a past session is the
 * record of what happened. A permanent swap is also written to the athlete's
 * preferences (so the next block honours it) and applied to every day still
 * ahead in this block.
 */
export async function editSession(raw: unknown): Promise<Result> {
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) return fail('today.edit.error')
  const { date, edit } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('auth.errors.signedOut')

  const answers = await getActiveAnswers()
  if (!answers) return fail('today.edit.error')
  const today = todayInZone(answers.basics.timezone)
  if (compareDates(fromISODate(date), today) < 0) return fail('today.edit.errorPast')

  let model
  try {
    model = buildAthleteModel(answers, today)
  } catch {
    return fail('today.edit.error')
  }

  const [plan, maxes, { data: row }] = await Promise.all([
    getCurrentPlan(),
    latestMaxes(today),
    supabase.from('planned_sessions').select('id, content').eq('user_id', user.id).eq('date', date).maybeSingle(),
  ])
  const day = row?.content as unknown as PlannedDay | undefined
  if (!plan || !row || !day?.gym) return fail('today.edit.error')

  const ctx: EditContext = { model, week: day.week, totalWeeks: plan.weeks, maxes }
  let gym: GymSession
  try {
    gym = applyEdit(day.gym, edit, ctx)
  } catch {
    return fail('today.edit.error')
  }

  const { error } = await supabase
    .from('planned_sessions')
    .update({ content: { ...day, gym } as unknown as Json })
    .eq('id', row.id)
  if (error) return fail('today.edit.error')

  if (edit.op === 'swap') {
    await supabase.from('exercise_preferences').insert({
      user_id: user.id,
      from_exercise_id: edit.from,
      to_exercise_id: edit.to,
      scope: edit.scope,
      date: edit.scope === 'session' ? date : null,
    })
    if (edit.scope === 'global') await swapAhead(user.id, date, edit.from, edit.to, ctx)
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Applies a permanent swap to every later day of the block that still holds the old exercise. */
async function swapAhead(userId: string, afterDate: string, from: string, to: string, ctx: EditContext): Promise<void> {
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('planned_sessions')
    .select('id, content')
    .eq('user_id', userId)
    .gt('date', afterDate)
  for (const row of rows ?? []) {
    const day = row.content as unknown as PlannedDay
    const gym = day.gym
    if (!gym || !gym.exercises.some((e) => e.exerciseId === from) || gym.exercises.some((e) => e.exerciseId === to)) continue
    try {
      const swapped = swapExercise(gym, from, to, { ...ctx, week: day.week })
      await supabase.from('planned_sessions').update({ content: { ...day, gym: swapped } as unknown as Json }).eq('id', row.id)
    } catch {
      // A day where the swap cannot apply keeps its original exercise.
    }
  }
}
