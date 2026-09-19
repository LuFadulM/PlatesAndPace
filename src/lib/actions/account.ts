'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { defaultLocale, isLocale } from '@/i18n/routing'
import { classifyPasswordFailure } from '@/lib/auth/errors'
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
 *
 * Only an account with no address at all may do this. A Server Action is a
 * public endpoint, and this one takes no password and no second factor: left
 * open, a stolen session cookie on a normal account could be used to move the
 * account's email somewhere the thief controls. Changing an address that
 * already exists needs a re-authentication flow the app does not have, so it is
 * refused here rather than half-built.
 */
export async function attachEmail(input: unknown): Promise<{ ok: true } | { ok: false; errorKey: string }> {
  const parsed = attachEmailSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errorKey: 'auth.errors.invalidEmail' }
  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : defaultLocale

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, errorKey: 'auth.errors.signedOut' }
  const anonymous = (user as { is_anonymous?: boolean }).is_anonymous ?? user.email == null
  if (!anonymous || user.email) return { ok: false, errorKey: 'settings.account.attachNotAllowed' }

  const origin = (await headers()).get('origin') ?? ''
  const callback = new URL('/auth/callback', origin || 'http://localhost:3000')
  callback.searchParams.set('locale', locale)
  callback.searchParams.set('next', `/${locale}/settings`)

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: callback.toString() },
  )
  if (error) return { ok: false, errorKey: 'settings.account.attachFailed' }

  // Supabase hides whether the address is already taken (email-enumeration
  // protection), and rightly so: telling this caller would turn the form into a
  // "does this person use Hyex?" oracle. Nothing here can tell a sent link from
  // a silently dropped one, so the copy promises a link only if the address is
  // free rather than claiming one is on its way.
  revalidatePath('/', 'layout')
  return { ok: true }
}

const changePasswordSchema = z.object({
  current: z.string().min(1).max(72),
  next: z.string().min(8).max(72),
})

/**
 * Changing the password on an account that has one.
 *
 * The current password is checked first, by signing in with it, rather than
 * trusting the session alone. A session cookie is something a borrowed or
 * stolen phone already has; the old password is something only the account's
 * owner knows, and without that check an unlocked phone left on a bench would
 * be enough to lock its owner out for good.
 *
 * Supabase issues a fresh session on that sign-in, for the same user, so the
 * person stays signed in throughout.
 */
export async function changePassword(input: unknown): Promise<{ ok: true } | { ok: false; errorKey: string }> {
  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errorKey: 'auth.errors.weakPassword' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, errorKey: 'auth.errors.signedOut' }
  // An account with no address has no password to change: it is reached by the
  // session cookie alone, and Settings offers it an email instead.
  if (!user.email) return { ok: false, errorKey: 'settings.password.noEmail' }

  const { error: reauth } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current,
  })
  if (reauth) return { ok: false, errorKey: 'settings.password.wrongCurrent' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.next })
  if (error) return { ok: false, errorKey: `auth.errors.${classifyPasswordFailure(error)}` }

  revalidatePath('/', 'layout')
  return { ok: true }
}
