'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import type { DeloadAdvice } from '@/domain/strength/deload'
import { STALL_SESSIONS } from '@/domain/strength/deload'
import { takeDeloadWeek } from '@/lib/actions/plan'

/**
 * The engine recommends the easy week; the athlete takes it. A surprise
 * half-session is worse coaching than a hard one they chose, so this asks.
 */
export function DeloadCard({ advice, weekStart, taken }: { advice: DeloadAdvice; weekStart: string; taken: boolean }) {
  const t = useTranslations('deload')
  const tM = useTranslations('muscles')
  const tEx = useTranslations('exercises')
  const [dismissed, setDismissed] = useState(false)
  const [pending, startTransition] = useTransition()

  if (taken) {
    return (
      <p role="status" className="rounded-xl bg-(--color-plate-blue) px-4 py-3 text-center text-sm font-semibold text-white">
        {t('taken')}
      </p>
    )
  }

  if (!advice.recommended || dismissed) return null

  const lifts = advice.stalledLifts.map((id) => tEx(`${id}.name`)).join(', ')
  const muscles = advice.overreachedMuscles.map((m) => tM(m)).join(', ')
  const painful = advice.painfulLifts.map((id) => tEx(`${id}.name`)).join(', ')

  return (
    <section aria-label={t('title')} className="flex flex-col gap-2 rounded-xl border-2 border-(--color-plate-yellow) bg-(--color-surface) px-4 py-3">
      <h2 className="font-display text-lg font-bold">{t('title')}</h2>
      <ul className="list-disc pl-5 text-sm">
        {advice.triggers.includes('stalled') && (
          <li>{t(advice.stalledLifts.length > 1 ? 'stalledPlural' : 'stalled', { lifts, n: STALL_SESSIONS + 1 })}</li>
        )}
        {advice.triggers.includes('readiness') && <li>{t('readiness')}</li>}
        {advice.triggers.includes('mrv') && (
          <li>{t(advice.overreachedMuscles.length > 1 ? 'mrvPlural' : 'mrv', { muscles })}</li>
        )}
        {advice.triggers.includes('joint_pain') && (
          <li>{t(advice.painfulLifts.length > 1 ? 'jointPainPlural' : 'jointPain', { lifts: painful })}</li>
        )}
      </ul>
      <p className="text-xs text-(--color-ink-muted)">{t('why')}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => { await takeDeloadWeek({ weekStart }) })}
          className="min-h-11 flex-1 rounded-full bg-(--color-plate-blue) px-4 font-semibold text-white disabled:opacity-60"
        >
          {pending ? t('taking') : t('take')}
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="min-h-11 rounded-full border border-(--color-border) px-4 font-semibold">
          {t('dismiss')}
        </button>
      </div>
    </section>
  )
}
