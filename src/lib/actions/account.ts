'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { defaultLocale, isLocale } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'

export async function exportMyData(): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('export_my_data')
  if (error) return null
  return JSON.stringify(data, null, 2)
}

export async function deleteMyAccount(locale: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_my_account')
  if (error) return { ok: false as const }
  await supabase.auth.signOut()
  redirect(`/${isLocale(locale) ? locale : defaultLocale}`)
}

export async function updateLocale(locale: string) {
  const parsed = z.enum(['en', 'es']).safeParse(locale)
  if (!parsed.success) return { ok: false as const }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  await supabase.from('profiles').update({ locale: parsed.data }).eq('user_id', user.id)
  return { ok: true as const }
}

export async function updateUnits(units: string) {
  const parsed = z.enum(['metric', 'imperial']).safeParse(units)
  if (!parsed.success) return { ok: false as const }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  await supabase.from('profiles').update({ units: parsed.data }).eq('user_id', user.id)
  return { ok: true as const }
}

export async function updateTimezone(timezone: string) {
  const parsed = z.string().min(1).max(64).safeParse(timezone)
  if (!parsed.success) return { ok: false as const }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: parsed.data })
  } catch {
    return { ok: false as const }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  await supabase.from('profiles').update({ timezone: parsed.data }).eq('user_id', user.id)
  return { ok: true as const }
}
