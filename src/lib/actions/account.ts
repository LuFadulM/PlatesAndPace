'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
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

const attachEmailSchema = z.object({ email: z.string().trim().min(1).email(), locale: z.string() })

/**
 * Puts an address on an account that started without one.
 *
 * Until this happens the account exists only in this browser's session: no
 * address means no way to prove ownership from another device, so clearing
 * site data loses it. Supabase sends a confirmation to the new address and the
 * link lands on the same callback a magic link uses, which turns the anonymous
 * user into a permanent one without touching a single row of their data.
 */
export async function attachEmail(input: unknown): Promise<{ ok: true } | { ok: false; errorKey: string }> {
  const parsed = attachEmailSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errorKey: 'auth.errors.invalidEmail' }
  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : defaultLocale

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, errorKey: 'auth.errors.signedOut' }

  const origin = (await headers()).get('origin') ?? ''
  const callback = new URL('/auth/callback', origin || 'http://localhost:3000')
  callback.searchParams.set('locale', locale)
  callback.searchParams.set('next', `/${locale}/settings`)

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: callback.toString() },
  )
  if (error) return { ok: false, errorKey: 'settings.account.attachFailed' }

  revalidatePath('/', 'layout')
  return { ok: true }
}
