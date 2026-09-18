import { getTranslations } from 'next-intl/server'
import { formatDuration, formatPace } from '@/domain/dates'
import { racePredictions, type RecentRun, type TrainingPaces } from '@/domain/running'

const PACE_KEYS = ['easy', 'long', 'marathon', 'threshold', 'interval', 'repetition'] as const

/**
 * What the athlete can run right now: the effort every pace is derived from,
 * the paces themselves, and what those paces are worth over a race distance.
 * Predictions are a range, never a promise (CLAUDE.md, rule 6).
 */
export async function PacesCard({
  paces,
  baseline,
  learned,
  locale,
}: {
  paces: TrainingPaces
  baseline: RecentRun
  /** True when a logged run, not the onboarding answer, set the baseline. */
  learned: boolean
  locale: string
}) {
  const t = await getTranslations('running')
  const predictions = racePredictions(baseline)

  return (
    <section className="flex flex-col gap-3" aria-label={t('title')}>
      <h2 className="font-display text-xl font-bold">{t('title')}</h2>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-(--color-ink-muted)">{t('baseline')}</p>
          <p className="font-display text-xl font-bold tabular-nums">{formatDuration(Math.round(baseline.seconds), locale)}</p>
        </div>
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-(--color-ink-muted)">{t('vdot')}</p>
          <p className="font-display text-xl font-bold tabular-nums">{Math.round(paces.vdot)}</p>
        </div>
      </div>
      {learned && <p className="text-xs text-(--color-plate-green)">{t('learned')}</p>}

      <h3 className="font-display text-base font-bold">{t('paces')}</h3>
      <ul className="flex flex-col gap-1">
        {PACE_KEYS.map((key) => (
          <li key={key} className="flex items-baseline justify-between gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2">
            <span className="min-w-0">
              <span className="block font-semibold">{t(`pace.${key}`)}</span>
              <span className="block text-xs text-(--color-ink-muted)">{t(`paceHint.${key}`)}</span>
            </span>
            <span className="shrink-0 font-display font-bold tabular-nums">{formatPace(paces[key], locale)}</span>
          </li>
        ))}
      </ul>

      <h3 className="font-display text-base font-bold">{t('predictions')}</h3>
      <ul className="flex flex-col gap-1">
        {predictions.map((p) => (
          <li key={p.race} className="flex items-baseline justify-between gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2">
            <span className="font-semibold">{t(`race.${p.race}`)}</span>
            <span className="shrink-0 tabular-nums">
              {formatDuration(Math.round(p.fastSeconds), locale)}–{formatDuration(Math.round(p.slowSeconds), locale)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-(--color-ink-muted)">{t('predictionsHint')}</p>
    </section>
  )
}
