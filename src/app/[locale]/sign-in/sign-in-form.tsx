'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/routing'
import { sendMagicLink, signInWithPassword, signUpWithPassword, type SignInState } from './actions'

type Mode = 'signIn' | 'signUp' | 'link'

const field =
  'min-h-11 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 text-base'

/**
 * Email and a password, with the emailed link kept as a fallback.
 *
 * The link used to be the only way back in, which meant opening an inbox on
 * every new device, every time — and the project's mailer allows two messages
 * an hour, so the second person to try in the same hour simply could not sign
 * in. A password is typed once and travels with the person, costs nothing to
 * send, and lets anyone make their own account without waiting on a queue.
 *
 * The link stays because it is the only recovery path for a forgotten password
 * that does not need a support inbox, but it is no longer on the way in.
 */
export function SignInForm({ locale, next }: { locale: Locale; next?: string }) {
  const t = useTranslations('auth')
  const [mode, setMode] = useState<Mode>('signIn')

  const action =
    mode === 'signIn' ? signInWithPassword : mode === 'signUp' ? signUpWithPassword : sendMagicLink
  const [state, formAction, pending] = useActionState<SignInState, FormData>(action, {})

  const submitLabel =
    mode === 'signIn' ? t('signInButton') : mode === 'signUp' ? t('createAccount') : t('sendLink')
  const busyLabel = mode === 'link' ? t('sending') : t('signingIn')

  return (
    <div className="flex flex-col gap-4">
      {/* Remounted per mode: the three actions keep separate state, and a stale
          error from one must not sit under another's button. */}
      <form key={mode} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="locale" value={locale} />
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="email">
          {t('emailLabel')}
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby={state.errorKey ? 'sign-in-error' : undefined}
            aria-invalid={state.errorKey ? true : undefined}
            className={field}
          />
        </label>

        {mode !== 'link' && (
          <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="password">
            {t('passwordLabel')}
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              required
              minLength={8}
              aria-describedby={state.errorKey ? 'sign-in-error' : 'password-hint'}
              aria-invalid={state.errorKey ? true : undefined}
              className={field}
            />
          </label>
        )}

        {mode === 'signUp' && (
          <p id="password-hint" className="text-xs text-(--color-ink-muted)">
            {t('passwordHint')}
          </p>
        )}

        {state.errorKey ? (
          <p id="sign-in-error" role="alert" className="text-sm text-(--color-plate-red)">
            {t(state.errorKey.replace('auth.', ''))}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-lg bg-(--color-plate-blue) px-4 font-semibold text-white disabled:opacity-60"
        >
          {pending ? busyLabel : submitLabel}
        </button>
      </form>

      <div className="flex flex-col gap-1 text-sm">
        {mode !== 'signUp' && (
          <button type="button" onClick={() => setMode('signUp')} className="min-h-11 text-left text-(--color-plate-blue) underline-offset-2 hover:underline">
            {t('toSignUp')}
          </button>
        )}
        {mode !== 'signIn' && (
          <button type="button" onClick={() => setMode('signIn')} className="min-h-11 text-left text-(--color-plate-blue) underline-offset-2 hover:underline">
            {t('toSignIn')}
          </button>
        )}
        {mode !== 'link' && (
          <button type="button" onClick={() => setMode('link')} className="min-h-11 text-left text-(--color-ink-muted) underline-offset-2 hover:underline">
            {t('toLink')}
          </button>
        )}
      </div>

      {mode === 'link' && <p className="text-xs text-(--color-ink-muted)">{t('magicLinkHint')}</p>}
    </div>
  )
}
