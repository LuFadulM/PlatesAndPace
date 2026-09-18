'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { startNextBlock } from '@/lib/actions/plan'

/**
 * The end of a block used to be the end of the app: Today said nothing was
 * planned, for ever. This is the way forward, and it says what carries over so
 * starting again does not feel like starting over.
 */
export function NextBlockCard({ weeks }: { weeks: number }) {
  const t = useTranslations('today.nextBlock')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <section aria-label={t('title')} className="flex flex-col gap-2 rounded-xl border-2 border-(--color-plate-blue) bg-(--color-surface) px-4 py-4">
      <h2 className="font-display text-xl font-bold">{t('title')}</h2>
      <p className="text-sm">{t('body', { weeks })}</p>
      {error && <p role="alert" className="text-sm text-(--color-plate-red)">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          setError(null)
          const result = await startNextBlock()
          if (!result.ok) setError(t('error'))
        })}
        className="min-h-12 rounded-full bg-(--color-plate-blue) px-4 font-semibold text-white disabled:opacity-60"
      >
        {pending ? t('starting') : t('start')}
      </button>
    </section>
  )
}
