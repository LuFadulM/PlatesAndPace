import { redirect } from '@/i18n/navigation'
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

/**
 * The profile, or a redirect to onboarding. Next renders a layout and its page
 * in parallel, so a page must not assume the layout's gate has already run —
 * a fresh account would dereference null for a moment before the redirect.
 */
export async function requireProfile(locale: 'en' | 'es'): Promise<Profile> {
  const profile = await getProfile()
  if (!profile?.onboarded_at) redirect({ href: '/onboarding', locale })
  return profile as Profile
}
