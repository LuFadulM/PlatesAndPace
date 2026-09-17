import { createClient } from '@/lib/supabase/server'
import { questionnaireSchema, type QuestionnaireAnswers } from '@/domain/profile/questionnaire'
import type { Tables } from '@/types/database'

export type Profile = Tables<'profiles'>

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle()
  return data
}

export async function getActiveAnswers(): Promise<QuestionnaireAnswers | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('questionnaire_answers')
    .select('answers')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle()
  if (!data) return null
  const parsed = questionnaireSchema.safeParse(data.answers)
  return parsed.success ? parsed.data : null
}

export async function getLatestWeightKg(): Promise<number | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('body_measurements')
    .select('weight_kg')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.weight_kg ?? null
}
