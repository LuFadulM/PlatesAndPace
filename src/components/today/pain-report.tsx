'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { reportPain } from '@/lib/actions/logs'

const LEVELS = [
  { severity: 0, key: 'none' },
  { severity: 1, key: 'twinge' },
  { severity: 2, key: 'hurts' },
  { severity: 3, key: 'stop' },
] as const

/**
 * Whether a movement hurt a joint today (CLAUDE.md, rule 2).
 *
 * Asked per exercise rather than per set, because that is how an athlete
 * thinks about it. Two reports on the same movement bring up a swap and count
 * toward a deload; one is just a bad day.
 */
export function PainReport({
  date,
  exerciseId,
  initial,
  repeated,
}: {
  date: string
  exerciseId: string
  initial: number
  /** True when this movement has already hurt before. */
  repeated: boolean
}) {
  const t = useTranslations('today.pain')
  const [severity, setSeverity] = useState(initial)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-1 border-t border-(--color-border) pt-2">
      <p className="text-xs font-semibold text-(--color-ink-muted)">{t('label')}</p>
      <div className="flex flex-wrap gap-1" role="group" aria-label={t('label')}>
        {LEVELS.map((level) => {
          const on = severity === level.severity
          return (
            <button
              key={level.key}
              type="button"
              aria-pressed={on}
              disabled={pending}
              onClick={() => {
                setSeverity(level.severity)
                startTransition(async () => { await reportPain({ date, exerciseId, severity: level.severity }) })
              }}
              className={`min-h-11 rounded-full border px-3 text-xs font-semibold ${on ? 'border-(--color-plate-red) bg-(--color-plate-red) text-white' : 'border-(--color-border)'}`}
            >
              {t(level.key)}
            </button>
          )
        })}
      </div>
      {severity >= 2 && <p className="text-xs text-(--color-ink-muted)">{t(repeated ? 'repeat' : 'saved')}</p>}
    </div>
  )
}
