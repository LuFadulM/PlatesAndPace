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

export type SendFailure = 'rateLimited' | 'sendFailed'

/**
 * Supabase's built-in mailer allows a handful of emails per hour per project
 * (two, at the time of writing). Hitting it looks nothing like a broken mail
 * server, so it gets its own message.
 */
export function classifySendFailure(error: AuthFailure): SendFailure {
  if (error.status === 429) return 'rateLimited'
  if (error.code === 'over_email_send_rate_limit') return 'rateLimited'
  if (/rate limit/i.test(error.message ?? '')) return 'rateLimited'
  return 'sendFailed'
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
