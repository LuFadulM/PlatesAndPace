'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/routing'
import { startWithoutEmail } from './actions'

/**
 * The way in that asks for nothing. An anonymous Supabase session is a real
 * account, so the plan, the logs and every row level security rule work
 * exactly as they do for an address-holder; the difference is that it lives in
 * this browser until an email is attached, which the hint says outright.
 */
export function StartFree({ locale }: { locale: Locale }) {
  const t = useTranslations('auth')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const result = await startWithoutEmail(locale)
          if (result?.errorKey) setErrorKey(result.errorKey)
        })}
        className="min-h-12 rounded-lg bg-(--color-plate-blue) px-4 font-semibold text-white disabled:opacity-60"
      >
        {pending ? t('sending') : t('startFree')}
      </button>
      <p className="text-xs text-(--color-ink-muted)">{t('startFreeHint')}</p>
      {errorKey && <p role="alert" className="text-sm text-(--color-plate-red)">{t(errorKey.replace('auth.', ''))}</p>}
    </div>
  )
}
