'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/routing'
import { verifyEmailCode, type SignInState } from '@/app/[locale]/sign-in/actions'

/**
 * The way in when the link does not work.
 *
 * It sits behind a disclosure rather than leading, because the link is still
 * the shorter path when it works. What it fixes is the case where it does not:
 * a mail app's built-in browser cannot complete the PKCE exchange, and a link
 * scanner that follows the URL first leaves a token already spent. A code typed
 * here is verified from this browser, on this device, and looking at an email
 * cannot spend it.
 */
export function CodeForm({ locale }: { locale: Locale }) {
  const t = useTranslations('auth')
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<SignInState, FormData>(verifyEmailCode, {})

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 text-sm font-semibold text-(--color-plate-blue) underline-offset-2 hover:underline"
      >
        {t('codeToggle')}
      </button>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
      <input type="hidden" name="locale" value={locale} />

      <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="code">
        {t('codeLabel')}
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          aria-describedby={state.errorKey ? 'code-error' : undefined}
          aria-invalid={state.errorKey ? true : undefined}
          className="min-h-11 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 text-center text-2xl tracking-[0.4em] tabular-nums"
        />
      </label>

      {state.errorKey ? (
        <p id="code-error" role="alert" className="text-sm text-(--color-plate-red)">
          {t(state.errorKey.replace('auth.', ''))}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-(--color-plate-blue) px-4 font-semibold text-white disabled:opacity-60"
      >
        {pending ? t('codeChecking') : t('codeSubmit')}
      </button>
    </form>
  )
}
