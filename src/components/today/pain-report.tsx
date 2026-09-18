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
 *
 * The confirmation waits for the write to land. Showing it the moment the
 * button is tapped would tell an athlete their report was saved when it may
 * not have been, and a failed save here costs them the evidence the deload
 * trigger needs.
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
  /** True when this movement has already hurt on an earlier day. */
  repeated: boolean
}) {
  const t = useTranslations('today.pain')
  const [severity, setSeverity] = useState(initial)
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()

  const report = (next: number) => {
    const previous = severity
    setSeverity(next)
    setFailed(false)
    startTransition(async () => {
      const result = await reportPain({ date, exerciseId, severity: next })
      if (!result?.ok) {
        setSeverity(previous)
        setFailed(true)
      }
    })
  }

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
              onClick={() => report(level.severity)}
              className={`min-h-11 rounded-full border px-3 text-xs font-semibold ${on ? 'border-(--color-plate-red) bg-(--color-plate-red) text-white' : 'border-(--color-border)'}`}
            >
              {t(level.key)}
            </button>
          )
        })}
      </div>
      {failed && <p role="alert" className="text-xs text-(--color-plate-red)">{t('error')}</p>}
      {!failed && !pending && severity >= 2 && (
        <p className="text-xs text-(--color-ink-muted)">{t(repeated ? 'repeat' : 'saved')}</p>
      )}
    </div>
  )
}
