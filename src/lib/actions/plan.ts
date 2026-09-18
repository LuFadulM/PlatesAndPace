'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { addDays, compareDates, fromISODate, todayInZone, toISODate, type PlainDate } from '@/domain/dates'
import { generatePlan, regenerateGymSession, type GeneratedPlan, type PlannedDay } from '@/domain/plan'
import { buildAthleteModel } from '@/domain/profile/athlete'
import { improvedBaseline } from '@/domain/running'
import { getRunEfforts } from '@/lib/data/running'
import { anyHealthFlag, hasRedFlag, questionnaireSchema } from '@/domain/profile/questionnaire'
import { planSeed } from '@/domain/strength/rng'
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/strength/volume'
import { exerciseIdsUsedSince, getSwaps, latestMaxes } from '@/lib/data/logs'
import { blockHasEnded, getCurrentPlan, getPlannedDay } from '@/lib/data/plan'
import { getActiveAnswers } from '@/lib/data/profile'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

/**
 * Saves questionnaire answers and (re)generates the plan.
 *
 * Answers are versioned: a new row is written and the previous one is
 * deactivated, so history survives while exactly one version drives
 * generation. Sessions are only regenerated from today forward — the past is
 * immutable history and the logs attached to it stay valid (PLAN.md §3).
 */
export async function saveAnswersAndGeneratePlan(raw: unknown): Promise<{ ok: true } | { ok: false; errorKey: string }> {
  const parsed = questionnaireSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, errorKey: 'onboarding.errors.invalid' }
  const answers = parsed.data
  // A red flag gates the plan behind the medical notice, whatever the client did.
  if (hasRedFlag(answers.health) && !answers.health.medicalAcknowledged) return { ok: false, errorKey: 'onboarding.errors.medical' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, errorKey: 'auth.errors.signedOut' }

  const today = todayInZone(answers.basics.timezone)
  let model
  try {
    model = buildAthleteModel(answers, today)
  } catch {
    return { ok: false, errorKey: 'onboarding.errors.underage' }
  }

  // Profile is the denormalised view of the answers the rest of the app reads.
  const { error: profileError } = await supabase.from('profiles').upsert({
    user_id: user.id,
    display_name: answers.basics.displayName,
    locale: answers.basics.locale,
    timezone: answers.basics.timezone,
    units: answers.basics.units,
    sex: answers.body.sex,
    birth_date: answers.body.birthDate,
    height_cm: answers.body.heightCm,
    health_flags: answers.health,
    conservative_mode: anyHealthFlag(answers.health),
    onboarded_at: new Date().toISOString(),
  })
  if (profileError) return { ok: false, errorKey: 'onboarding.errors.save' }

  await supabase.from('body_measurements').upsert(
    { user_id: user.id, date: toISODate(today), weight_kg: answers.body.weightKg, waist_cm: answers.body.waistCm ?? null },
    { onConflict: 'user_id,date' },
  )

  // Version the answers.
  const { data: latest } = await supabase.from('questionnaire_answers').select('version').eq('user_id', user.id).order('version', { ascending: false }).limit(1).maybeSingle()
  const version = (latest?.version ?? 0) + 1
  await supabase.from('questionnaire_answers').update({ active: false }).eq('user_id', user.id).eq('active', true)
  const { error: answersError } = await supabase.from('questionnaire_answers').insert({ user_id: user.id, version, answers, active: true })
  if (answersError) return { ok: false, errorKey: 'onboarding.errors.save' }

  const result = await materialise(user.id, model, today)
  if (!result.ok) return result

  revalidatePath('/', 'layout')
  return { ok: true }
}

async function materialise(
  userId: string,
  model: ReturnType<typeof buildAthleteModel>,
  today: PlainDate,
): Promise<{ ok: true } | { ok: false; errorKey: string }> {
  const supabase = await createClient()

  const { data: current } = await supabase.from('plans').select('*').eq('user_id', userId).order('block', { ascending: false }).limit(1).maybeSingle()
  const block = (current?.block ?? 0) + 1

  const [maxes, swaps, recent, efforts] = await Promise.all([
    latestMaxes(today),
    getSwaps(),
    exerciseIdsUsedSince(addDays(today, -7)),
    getRunEfforts(),
  ])

  // A new block starts from the fitness the athlete has now, not the answer
  // they gave at signup: long runs and interval paces both come off this.
  const learned = improvedBaseline(model.recentRun, efforts)
  const fitNow = learned ? { ...model, recentRun: learned } : model

  const plan: GeneratedPlan = generatePlan(fitNow, {
    block,
    seed: planSeed(userId, block),
    previousMaxes: maxes,
    swaps,
    recentlyUsed: recent,
  })

  const { data: planRow, error: planError } = await supabase
    .from('plans')
    .insert({ user_id: userId, block, start_date: plan.startDate, weeks: plan.weeks, settings: plan.settings as unknown as Json })
    .select('id')
    .single()
  if (planError || !planRow) return { ok: false, errorKey: 'onboarding.errors.save' }

  // Keep history: only days from today forward are replaced.
  const cutoff = compareDates(fromISODate(plan.startDate), today) > 0 ? plan.startDate : toISODate(today)
  await supabase.from('planned_sessions').delete().eq('user_id', userId).gte('date', cutoff)

  const rows = plan.days
    .filter((day) => day.date >= cutoff)
    .map((day) => ({ user_id: userId, plan_id: planRow.id, date: day.date, type: day.type, content: day as unknown as Json }))

  const { error: sessionsError } = await supabase.from('planned_sessions').insert(rows)
  if (sessionsError) return { ok: false, errorKey: 'onboarding.errors.save' }

  return { ok: true }
}

const refocusSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  muscles: z.array(z.enum(MUSCLE_GROUPS as unknown as [MuscleGroup, ...MuscleGroup[]])).min(1).max(6),
})

/**
 * Rebuilds one day's gym session from muscle groups the athlete chose on the
 * spot. Only today or later can change — the past is history — and the run
 * scheduled for that day and the next still shapes the session.
 */
export async function refocusDay(raw: unknown): Promise<{ ok: true } | { ok: false; errorKey: string }> {
  const parsed = refocusSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, errorKey: 'today.refocus.error' }
  const { date, muscles } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, errorKey: 'auth.errors.signedOut' }

  const answers = await getActiveAnswers()
  if (!answers) return { ok: false, errorKey: 'today.refocus.error' }

  const today = todayInZone(answers.basics.timezone)
  if (compareDates(fromISODate(date), today) < 0) return { ok: false, errorKey: 'today.refocus.error' }

  let model
  try {
    model = buildAthleteModel(answers, today)
  } catch {
    return { ok: false, errorKey: 'today.refocus.error' }
  }

  const [plan, day, next, maxes, swaps, recent] = await Promise.all([
    getCurrentPlan(),
    getPlannedDay(date),
    getPlannedDay(toISODate(addDays(fromISODate(date), 1))),
    latestMaxes(today),
    getSwaps(),
    exerciseIdsUsedSince(addDays(fromISODate(date), -7)),
  ])
  if (!plan || !day) return { ok: false, errorKey: 'today.refocus.error' }

  const gym = regenerateGymSession(model, {
    focus: muscles,
    week: day.week,
    todaysRun: day.run?.kind ?? 'none',
    tomorrowsRun: next?.run?.kind ?? 'none',
    seed: `${user.id}:${date}:${muscles.join('+')}`,
    previousMaxes: maxes,
    swaps,
    recentlyUsed: recent,
  })

  const rebuilt: PlannedDay = { ...day, type: day.run ? 'gym_run' : 'gym', gym }
  const { error } = await supabase
    .from('planned_sessions')
    .update({ type: rebuilt.type, content: rebuilt as unknown as Json })
    .eq('user_id', user.id)
    .eq('date', date)
  if (error) return { ok: false, errorKey: 'today.refocus.error' }

  revalidatePath('/', 'layout')
  return { ok: true }
}

const deloadSchema = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })

/**
 * Marks a week as an easy one, on the athlete's say-so (CLAUDE.md, rule 2).
 *
 * The engine deloads every fourth week whatever happens, but a body that has
 * stalled, slept badly for days or piled up more volume than it can recover
 * from needs the easy week now. The recommendation is the engine's; taking it
 * is the athlete's, because a surprise half-session is worse coaching than a
 * hard one they chose.
 *
 * Stored on the plan rather than in a table of its own: it is a property of
 * this block, and it disappears with it.
 */
export async function takeDeloadWeek(input: unknown) {
  const parsed = deloadSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }

  const plan = await getCurrentPlan()
  if (!plan) return { ok: false as const }

  const settings = (plan.settings ?? {}) as Record<string, unknown>
  const taken = Array.isArray(settings.takenDeloads) ? (settings.takenDeloads as string[]) : []
  if (taken.includes(parsed.data.weekStart)) return { ok: true as const }

  const { error } = await supabase
    .from('plans')
    .update({ settings: { ...settings, takenDeloads: [...taken, parsed.data.weekStart] } as unknown as Json })
    .eq('id', plan.id)
    .eq('user_id', user.id)
  if (error) return { ok: false as const }

  revalidatePath('/', 'layout')
  return { ok: true as const }
}

/**
 * Starts the next training block when the current one has run out.
 *
 * A block is four to twelve weeks. Without this the app simply stopped: Today
 * said "nothing planned for this day" for ever and the athlete had to guess
 * that re-answering the questionnaire was what restarted it. The next block
 * carries everything the last one taught, because `materialise` already reads
 * the logged maxes, the permanent swaps, what was trained recently and the
 * running baseline learned from logged runs.
 */
export async function startNextBlock(): Promise<{ ok: true } | { ok: false; errorKey: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, errorKey: 'auth.errors.signedOut' }

  const answers = await getActiveAnswers()
  if (!answers) return { ok: false, errorKey: 'today.edit.error' }

  const today = todayInZone(answers.basics.timezone)
  const plan = await getCurrentPlan()
  // Only when the current block is genuinely over: starting a new one mid-block
  // would throw away the weeks the athlete has already banked.
  if (plan && !blockHasEnded(plan, today)) return { ok: false, errorKey: 'today.nextBlock.notYet' }

  let model
  try {
    model = buildAthleteModel(answers, today)
  } catch {
    return { ok: false, errorKey: 'onboarding.errors.underage' }
  }

  const result = await materialise(user.id, model, today)
  if (!result.ok) return result
  revalidatePath('/', 'layout')
  return { ok: true }
}
