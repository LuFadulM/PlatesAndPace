'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { Explanation } from '@/domain/plan/explain'

/**
 * The engine's reasoning, one line per decision, in the reader's language.
 * Opens by itself the first time a plan is built; a summary afterwards.
 */
export function PlanExplanation({ lines, welcome }: { lines: Explanation[]; welcome: boolean }) {
  const t = useTranslations()
  return (
    <details open={welcome} className="rounded-xl border border-(--color-border) bg-(--color-surface)">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 font-display text-lg font-bold">{t('explain.title')}</summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        {welcome && <p className="text-sm font-semibold">{t('explain.welcome')}</p>}
        <ol className="flex flex-col gap-2 text-sm">
          {lines.map((line, i) => (
            <li key={`${line.key}-${i}`} className="flex gap-3">
              <span aria-hidden="true" className="w-5 shrink-0 font-display font-bold text-(--color-plate-blue)">{i + 1}</span>
              <span>{t(line.key, line.params)}</span>
            </li>
          ))}
        </ol>
        {welcome && (
          <Link href="/today" className="flex min-h-12 items-center justify-center rounded-xl bg-(--color-plate-blue) font-display text-lg font-bold text-white">{t('explain.goToday')}</Link>
        )}
      </div>
    </details>
  )
}
