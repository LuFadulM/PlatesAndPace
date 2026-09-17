'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  formatLongDate,
  formatWeekdayShort,
  fromISODate,
  relativeDayLabel,
  toISODate,
  weekStrip,
  type PlainDate,
} from '@/domain/dates'

export interface StripDay {
  date: string
  type: 'gym' | 'run' | 'gym_run' | 'rest'
  done: boolean
}

const DOT: Record<StripDay['type'], string> = {
  gym: 'bg-(--color-plate-blue)',
  run: 'bg-(--color-plate-yellow)',
  gym_run: 'bg-gradient-to-r from-(--color-plate-blue) to-(--color-plate-yellow)',
  rest: 'bg-transparent',
}

export function DayHeader({ date, today, strip }: { date: string; today: string; strip: StripDay[] }) {
  const locale = useLocale()
  const t = useTranslations('dates')
  const selected: PlainDate = fromISODate(date)
  const todayDate = fromISODate(today)
  const relative = relativeDayLabel(selected, todayDate)
  const byDate = new Map(strip.map((d) => [d.date, d]))

  return (
    <header className="flex flex-col gap-3">
      <div>
        {relative && <p className="text-xs font-bold uppercase tracking-wider text-(--color-plate-red)">{t(relative)}</p>}
        <h1 className="text-2xl font-bold capitalize">{formatLongDate(selected, locale)}</h1>
      </div>
      <ol className="grid grid-cols-7 gap-1" aria-label={t('weekStrip')}>
        {weekStrip(selected).map((d) => {
          const iso = toISODate(d)
          const info = byDate.get(iso)
          const isToday = iso === today
          const isSelected = iso === date
          return (
            <li key={iso}>
              <Link
                href={{ pathname: '/today', query: iso === today ? undefined : { date: iso } }}
                aria-current={isSelected ? 'date' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs font-semibold ${
                  isSelected ? 'bg-(--color-ink) text-(--color-bg)' : 'bg-(--color-surface)'
                } ${isToday && !isSelected ? 'ring-2 ring-(--color-plate-red)' : ''}`}
              >
                <span className="uppercase">{formatWeekdayShort(d, locale)}</span>
                <span className="text-base">{d.day}</span>
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${info?.done ? 'bg-(--color-plate-green)' : DOT[info?.type ?? 'rest']}`} />
              </Link>
            </li>
          )
        })}
      </ol>
    </header>
  )
}
