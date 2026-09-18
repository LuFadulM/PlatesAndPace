/**
 * Turns Supabase Auth failures into message keys the sign-in screen can show.
 *
 * Pure so it can be unit tested without a Supabase client: the callers pass the
 * status and message they got back.
 */
export interface AuthFailure {
  status?: number
  code?: string
  message?: string
}

export type SendFailure = 'rateLimited' | 'emailDisabled' | 'sendFailed'

/**
 * Supabase's built-in mailer allows a handful of emails per hour per project
 * (two, at the time of writing). Hitting it looks nothing like a broken mail
 * server, so it gets its own message.
 *
 * `emailDisabled` is the other one worth naming. When the Email provider is
 * switched off, Supabase answers 422 "Email logins are disabled" — a project
 * setting, not anything the athlete did and not something retrying will fix.
 * Reported as "we could not send the link, try again in a moment" it sends
 * someone into a loop of retries against a door that is bolted; named, it is
 * one switch. The project's auth log showed exactly that loop.
 */
export function classifySendFailure(error: AuthFailure): SendFailure {
  if (error.status === 429) return 'rateLimited'
  if (error.code === 'over_email_send_rate_limit') return 'rateLimited'
  if (/rate limit/i.test(error.message ?? '')) return 'rateLimited'
  if (error.code === 'email_provider_disabled') return 'emailDisabled'
  if (/email (logins|provider).*disabled/i.test(error.message ?? '')) return 'emailDisabled'
  return 'sendFailed'
}

export type VerifyFailure = 'codeExpired' | 'codeInvalid'

/**
 * A typed code fails for two reasons worth telling apart: it was wrong, or it
 * was already spent. Supabase answers 403 "Token has expired or is invalid" for
 * a consumed one — which is what happens when a mail scanner follows the link
 * in the same message before the athlete gets to it.
 */
export function classifyVerifyFailure(error: AuthFailure): VerifyFailure {
  if (/expired|not found/i.test(error.message ?? '')) return 'codeExpired'
  return 'codeInvalid'
}

export type ExchangeFailure = 'other_device' | 'exchange_failed'

/**
 * A PKCE exchange needs the code verifier cookie set by the browser that asked
 * for the link. When the link is opened somewhere else — a mail app's built-in
 * browser is the usual case — Supabase answers that the verifier is missing.
 * That is not an expired link, and telling the athlete so saves the next
 * request (and the email quota).
 */
export function classifyExchangeFailure(error: AuthFailure): ExchangeFailure {
  if (/code verifier/i.test(error.message ?? '')) return 'other_device'
  return 'exchange_failed'
}
