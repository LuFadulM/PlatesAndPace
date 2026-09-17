'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  formatMonthYear,
  formatWeekdayNarrow,
  fromISODate,
  monthGrid,
  plainDate,
  startOfPlanWeek,
  toISODate,
  weekStrip,
  type PlainDate,
} from '@/domain/dates'
import type { PlannedDay } from '@/domain/plan'

interface Props {
  today: string
  startDate: string
  weeks: number
  days: PlannedDay[]
  doneDates: string[]
}

export function MonthCalendar({ today, startDate, weeks, days, doneDates }: Props) {
  const locale = useLocale()
  const t = useTranslations('plan')
  const tAll = useTranslations()
  const byDate = new Map(days.map((d) => [d.date, d]))
  const done = new Set(doneDates)
  const todayDate = fromISODate(today)
  const [cursor, setCursor] = useState<PlainDate>(plainDate(todayDate.year, todayDate.month, 1))
  const [selectedWeek, setSelectedWeek] = useState<PlainDate>(startOfPlanWeek(todayDate))

  const start = fromISODate(startDate)
  const grid = monthGrid(cursor.year, cursor.month)
  const shift = (delta: number) => {
    const m = cursor.month + delta
    setCursor(m < 1 ? plainDate(cursor.year - 1, 12, 1) : m > 12 ? plainDate(cursor.year + 1, 1, 1) : plainDate(cursor.year, m, 1))
  }
  const week = weekStrip(selectedWeek)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label={t('previousMonth')} className="min-h-11 min-w-11 rounded-lg border border-(--color-border) font-bold">‹</button>
        <h2 className="font-display text-xl font-bold capitalize">{formatMonthYear(cursor, locale)}</h2>
        <button type="button" onClick={() => shift(1)} aria-label={t('nextMonth')} className="min-h-11 min-w-11 rounded-lg border border-(--color-border) font-bold">›</button>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-1 text-center text-xs">
        <thead>
          <tr>{grid[0]!.map((c) => <th key={c.date.day} scope="col" className="font-semibold uppercase text-(--color-ink-muted)">{formatWeekdayNarrow(c.date, locale)}</th>)}</tr>
        </thead>
        <tbody>
          {grid.map((row) => {
            const rowStart = toISODate(row[0]!.date)
            return (
              <tr key={rowStart}>
                {row.map((cell) => {
                  const iso = toISODate(cell.date)
                  const day = byDate.get(iso)
                  const isToday = iso === today
                  const isDone = done.has(iso)
                  const colour = isDone ? 'bg-(--color-plate-green) text-white' : day?.type === 'gym' ? 'bg-(--color-plate-blue) text-white' : day?.type === 'run' ? 'bg-(--color-plate-yellow)' : day?.type === 'gym_run' ? 'bg-gradient-to-br from-(--color-plate-blue) to-(--color-plate-yellow) text-white' : 'bg-(--color-surface)'
                  return (
                    <td key={iso} className="p-0">
                      <button type="button" onClick={() => setSelectedWeek(startOfPlanWeek(cell.date))} aria-label={iso} aria-current={isToday ? 'date' : undefined} className={`flex h-11 w-full items-center justify-center rounded-md font-semibold ${colour} ${cell.inMonth ? '' : 'opacity-30'} ${isToday ? 'ring-2 ring-(--color-plate-red) ring-offset-1' : ''}`}>{cell.date.day}</button>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      <ul className="flex flex-wrap gap-3 text-xs">
        <li className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-(--color-plate-blue)" />{t('legend.gym')}</li>
        <li className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-(--color-plate-yellow)" />{t('legend.run')}</li>
        <li className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-(--color-plate-green)" />{t('legend.done')}</li>
        <li className="flex items-center gap-1"><span className="h-3 w-3 rounded ring-2 ring-(--color-plate-red)" />{t('legend.today')}</li>
      </ul>

      <section>
        <h3 className="font-display text-lg font-bold">{t('weekOf', { week: Math.floor((Date.UTC(selectedWeek.year, selectedWeek.month - 1, selectedWeek.day) - Date.UTC(start.year, start.month - 1, start.day)) / 604800000) + 1, total: weeks })}</h3>
        <table className="mt-2 w-full text-sm">
          <thead className="text-left text-xs uppercase text-(--color-ink-muted)"><tr><th scope="col" className="py-1">{t('table.day')}</th><th scope="col">{t('table.session')}</th><th scope="col" className="text-right">{t('table.time')}</th></tr></thead>
          <tbody>
            {week.map((d) => {
              const iso = toISODate(d)
              const day = byDate.get(iso)
              return (
                <tr key={iso} className="border-t border-(--color-border)">
                  <td className="py-2 font-semibold">{d.day}</td>
                  <td className="py-2">
                    {day?.gym && <Link href={{ pathname: '/today', query: { date: iso } }} className="block text-(--color-plate-blue) underline-offset-2 hover:underline">{tAll(day.gym.titleKey)}</Link>}
                    {day?.run && <Link href={{ pathname: '/today', query: { date: iso } }} className="block text-(--color-ink)">{tAll(day.run.titleKey)}</Link>}
                    {!day?.gym && !day?.run && <span className="text-(--color-ink-muted)">{t('rest')}</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums text-(--color-ink-muted)">{day?.gym ? `${day.gym.estimatedMinutes}′` : ''}{day?.gym && day?.run ? ' + ' : ''}{day?.run ? `${day.run.minutes}′` : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
