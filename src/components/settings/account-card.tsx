'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/routing'
import { attachEmail } from '@/lib/actions/account'

/**
 * Turning a device-only account into one that survives a lost phone.
 *
 * An account started without an email is real in every way except that there
 * is no way to prove it is yours from somewhere else. That is a fair trade for
 * skipping the inbox on day one and a bad one to leave in place for ever, so
 * this says what the trade is and makes ending it one field.
 */
export function AccountCard({ locale, email, anonymous }: { locale: Locale; email: string | null; anonymous: boolean }) {
  const t = useTranslations('settings.account')
  const tAuth = useTranslations('auth')
  const [value, setValue] = useState('')
  const [sent, setSent] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const row = 'flex flex-col gap-2 rounded-xl border border-(--color-border) bg-(--color-surface) p-4'

  if (!anonymous) {
    return (
      <section className={row}>
        <h2 className="font-display text-lg font-bold">{t('title')}</h2>
        {email && <p className="text-sm text-(--color-ink-muted)">{t('signedInAs', { email })}</p>}
      </section>
    )
  }

  return (
    <section className={`${row} border-(--color-plate-yellow)`}>
      <h2 className="font-display text-lg font-bold">{t('title')}</h2>
      <p className="text-sm font-semibold">{t('anonymous')}</p>
      <p className="text-sm text-(--color-ink-muted)">{t('anonymousHelp')}</p>

      {sent ? (
        <p role="status" className="text-sm font-semibold text-(--color-plate-green)">{t('attachSent')}</p>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(ev) => {
            ev.preventDefault()
            setErrorKey(null)
            startTransition(async () => {
              const result = await attachEmail({ email: value, locale })
              if (result.ok) setSent(true)
              else setErrorKey(result.errorKey)
            })
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('email')}
            <input
              type="email"
              autoComplete="email"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="min-h-11 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 text-base font-normal"
            />
          </label>
          {errorKey && (
            <p role="alert" className="text-sm text-(--color-plate-red)">
              {errorKey.startsWith('auth.')
                ? tAuth(errorKey.replace('auth.', ''))
                : t(errorKey.replace('settings.account.', ''))}
            </p>
          )}
          <button type="submit" disabled={pending || !value.trim()} className="min-h-11 rounded-lg bg-(--color-plate-blue) font-semibold text-white disabled:opacity-60">
            {pending ? t('attaching') : t('attach')}
          </button>
        </form>
      )}
    </section>
  )
}
