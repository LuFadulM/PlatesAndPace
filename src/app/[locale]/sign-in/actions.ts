'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { defaultLocale, isLocale, type Locale } from '@/i18n/routing'
import { classifySendFailure } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/server'

const signInSchema = z.object({
  email: z.string().trim().min(1).email(),
  locale: z.string().refine(isLocale),
  next: z.string().optional(),
})

export interface SignInState {
  /** A message key, never prose — the form translates it (PLAN.md §4). */
  errorKey?: string
}

/**
 * Sends a magic link.
 *
 * The locale travels with the callback URL so the link returns the visitor to
 * the language they signed in from, even from a mail client on another device.
 */
export async function sendMagicLink(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    locale: formData.get('locale'),
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return { errorKey: 'auth.errors.invalidEmail' }
  }

  const { email, locale, next } = parsed.data
  const origin = (await headers()).get('origin') ?? ''

  const callback = new URL('/auth/callback', origin || 'http://localhost:3000')
  callback.searchParams.set('locale', locale)
  if (next) callback.searchParams.set('next', next)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString() },
  })

  if (error) {
    return { errorKey: `auth.errors.${classifySendFailure(error)}` }
  }

  redirect(`/${locale}/check-email`)
}

/**
 * Starts an account with no email and no link to click.
 *
 * Supabase issues a real user row for an anonymous sign-in, so every row level
 * security policy in this schema — all of them keyed on `auth.uid() = user_id`
 * — applies unchanged. Nothing about the data model knows or cares that the
 * account has no address on it.
 *
 * The cost is honest and the interface says it plainly: the session lives in
 * this browser. Clear its storage or pick up another phone and the account is
 * gone, unless an email is attached from Settings first.
 */
export async function startWithoutEmail(locale: string): Promise<SignInState> {
  const target: Locale = isLocale(locale) ? locale : defaultLocale
  const supabase = await createClient()

  const { error } = await supabase.auth.signInAnonymously()
  if (error) {
    // The likeliest cause by far is the project setting still being off, which
    // is a one-switch fix rather than anything the athlete did wrong.
    return { errorKey: 'auth.errors.anonymousDisabled' }
  }

  redirect(`/${target}/onboarding`)
}

export async function signOut(locale: string) {
  const target: Locale = isLocale(locale) ? locale : defaultLocale
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(`/${target}`)
}
