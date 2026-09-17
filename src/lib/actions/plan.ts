'use server'

import { revalidatePath } from 'next/cache'
import { addDays, compareDates, fromISODate, todayInZone, toISODate, type PlainDate } from '@/domain/dates'
import { generatePlan, type GeneratedPlan } from '@/domain/plan'
import { buildAthleteModel } from '@/domain/profile/athlete'
import { anyHealthFlag, questionnaireSchema } from '@/domain/profile/questionnaire'
import { planSeed } from '@/domain/strength/rng'
import { exerciseIdsUsedSince, getSwaps, latestMaxes } from '@/lib/data/logs'
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

  const [maxes, swaps, recent] = await Promise.all([
    latestMaxes(today),
    getSwaps(),
    exerciseIdsUsedSince(addDays(today, -7)),
  ])

  const plan: GeneratedPlan = generatePlan(model, {
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
