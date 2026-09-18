'use server'

import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { z } from 'zod'
import { defaultLocale, isLocale, type Locale } from '@/i18n/routing'
import { classifyPasswordFailure, classifySendFailure, classifyVerifyFailure } from '@/lib/auth/errors'
import { safeRedirectPath } from '@/lib/auth/routes'
import { createClient } from '@/lib/supabase/server'

/**
 * Where the address just typed is parked while the athlete goes to their inbox.
 *
 * `verifyOtp` needs the address alongside the code, and the check-email screen
 * has no other way to know it. It stays server-side in an httpOnly cookie
 * rather than riding in the URL, so it never reaches a browser history, a
 * referrer header or an access log. Where they were headed rides along for the
 * same reason, and so the screen keeps a static route.
 */
const PENDING_EMAIL = 'hyex_pending_email'
const PENDING_TTL_SECONDS = 60 * 60

interface PendingSignIn {
  email: string
  next?: string
}

async function readPending(): Promise<PendingSignIn | null> {
  const raw = (await cookies()).get(PENDING_EMAIL)?.value
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { email, next } = parsed as Record<string, unknown>
    if (typeof email !== 'string' || email.length === 0) return null
    return { email, next: typeof next === 'string' ? next : undefined }
  } catch {
    return null
  }
}

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

  const jar = await cookies()
  jar.set(PENDING_EMAIL, JSON.stringify({ email, next } satisfies PendingSignIn), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PENDING_TTL_SECONDS,
  })

  redirect(`/${locale}/check-email`)
}

/** Whether the check-email screen can offer the code box at all. */
export async function hasPendingEmail(): Promise<boolean> {
  return (await readPending()) !== null
}

const codeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
  locale: z.string().refine(isLocale),
})

/**
 * Signs in from the six-digit code in the email instead of the link.
 *
 * The link is the fragile half of this flow, for two reasons the project's auth
 * log shows plainly. It carries a PKCE code whose verifier lives in the browser
 * that asked for it, so opening it in a mail app's built-in browser cannot
 * work; and a single GET spends it, so a scanner that follows links before the
 * athlete does leaves them a token that is already gone.
 *
 * A typed code has neither problem. It is verified from the session that asked
 * for it, on the device in front of them, and nothing can spend it by looking
 * at it.
 */
export async function verifyEmailCode(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = codeSchema.safeParse({
    code: formData.get('code'),
    locale: formData.get('locale'),
  })
  if (!parsed.success) return { errorKey: 'auth.errors.codeInvalid' }

  const { code, locale } = parsed.data
  const pending = await readPending()
  if (!pending) return { errorKey: 'auth.errors.codeNoEmail' }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ email: pending.email, token: code, type: 'email' })
  if (error) return { errorKey: `auth.errors.${classifyVerifyFailure(error)}` }

  ;(await cookies()).delete(PENDING_EMAIL)
  // Already validated to a same-origin, locale-relative path; the cast is only
  // to satisfy typed routes, which cannot know that from a string.
  redirect(safeRedirectPath(pending.next ?? null, locale) as Route)
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

/**
 * A password is eight characters or more. Supabase's own floor is six; the two
 * extra are cheap here and this is the only secret on the account.
 */
const passwordSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(8).max(72),
  locale: z.string().refine(isLocale),
  next: z.string().optional(),
})

/**
 * Signing in with a password.
 *
 * This is the way in that costs nothing and asks nothing of an inbox. A magic
 * link has to be sent, delivered, found and opened in the right browser every
 * single time, on every device; a password is typed once and travels with the
 * person. It is also what makes the app usable by anyone other than its author,
 * because a second person can make their own account without waiting on a
 * mailer that allows two messages an hour.
 */
export async function signInWithPassword(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = passwordSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    locale: formData.get('locale'),
    next: formData.get('next') ?? undefined,
  })
  if (!parsed.success) return { errorKey: 'auth.errors.invalidCredentials' }

  const { email, password, locale, next } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { errorKey: `auth.errors.${classifyPasswordFailure(error)}` }

  redirect(safeRedirectPath(next ?? null, locale) as Route)
}

/**
 * Making an account with a password.
 *
 * With "Confirm email" off in the project, this signs the person straight in
 * and no message is ever sent. With it on, Supabase withholds the session until
 * a link is opened — so the absence of a session is the signal, and the screen
 * says to go and confirm rather than pretending it worked.
 */
export async function signUpWithPassword(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = passwordSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    locale: formData.get('locale'),
    next: formData.get('next') ?? undefined,
  })
  if (!parsed.success) return { errorKey: 'auth.errors.weakPassword' }

  const { email, password, locale, next } = parsed.data
  const origin = (await headers()).get('origin') ?? ''
  const callback = new URL('/auth/callback', origin || 'http://localhost:3000')
  callback.searchParams.set('locale', locale)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callback.toString() },
  })
  if (error) return { errorKey: `auth.errors.${classifyPasswordFailure(error)}` }
  if (!data.session) return { errorKey: 'auth.errors.confirmFirst' }

  redirect(safeRedirectPath(next ?? `/${locale}/onboarding`, locale) as Route)
}
