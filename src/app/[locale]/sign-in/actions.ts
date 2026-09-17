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

export async function signOut(locale: string) {
  const target: Locale = isLocale(locale) ? locale : defaultLocale
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(`/${target}`)
}
