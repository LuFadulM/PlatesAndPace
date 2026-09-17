'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/routing'
import { sendMagicLink, type SignInState } from './actions'

export function SignInForm({ locale, next }: { locale: Locale; next?: string }) {
  const t = useTranslations('auth')
  const [state, formAction, pending] = useActionState<SignInState, FormData>(sendMagicLink, {})

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
          className="min-h-11 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 text-base"
        />
      </label>

      {state.errorKey ? (
        <p id="sign-in-error" role="alert" className="text-sm text-(--color-plate-red)">
          {t(state.errorKey.replace('auth.', ''))}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-(--color-plate-blue) px-4 font-semibold text-white disabled:opacity-60"
      >
        {pending ? t('sending') : t('sendLink')}
      </button>

      <p className="text-xs text-(--color-ink-muted)">{t('magicLinkHint')}</p>
    </form>
  )
}
