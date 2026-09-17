import {
  addDays,
  compareDates,
  datesEqual,
  differenceInDays,
  plainDate,
  weekday,
  type PlainDate,
} from './plain-date'

/** Plans always start on a Monday (PLAN.md §5). */
export function startOfPlanWeek(date: PlainDate): PlainDate {
  return addDays(date, -(weekday(date) - 1))
}

export function endOfPlanWeek(date: PlainDate): PlainDate {
  return addDays(startOfPlanWeek(date), 6)
}

/** The Monday–Sunday run of dates containing `date`. Always exactly 7 entries. */
export function weekStrip(date: PlainDate): PlainDate[] {
  const monday = startOfPlanWeek(date)
  return Array.from({ length: 7 }, (_, offset) => addDays(monday, offset))
}

/** Which week of the block `date` falls in, 1-based. 0 or less means before it. */
export function weekIndex(date: PlainDate, blockStart: PlainDate): number {
  const startMonday = startOfPlanWeek(blockStart)
  return Math.floor(differenceInDays(date, startMonday) / 7) + 1
}

export type RelativeDayLabel = 'today' | 'tomorrow' | 'yesterday'

/**
 * The word to show above the date, or `null` when the date is far enough away
 * that the formatted date should stand alone.
 */
export function relativeDayLabel(date: PlainDate, today: PlainDate): RelativeDayLabel | null {
  switch (differenceInDays(date, today)) {
    case 0:
      return 'today'
    case 1:
      return 'tomorrow'
    case -1:
      return 'yesterday'
    default:
      return null
  }
}

export interface MonthGridDay {
  date: PlainDate
  /** False for the leading and trailing days borrowed from adjacent months. */
  inMonth: boolean
}

/**
 * A Monday-first grid covering `month`, padded with adjacent-month days so every
 * row holds 7 entries. Used by the Plan screen's month view.
 */
export function monthGrid(year: number, month: number): MonthGridDay[][] {
  const gridStart = startOfPlanWeek(plainDate(year, month, 1))
  const firstOfNextMonth =
    month === 12 ? plainDate(year + 1, 1, 1) : plainDate(year, month + 1, 1)
  const gridEnd = endOfPlanWeek(addDays(firstOfNextMonth, -1))

  const weeks: MonthGridDay[][] = []
  let cursor = gridStart

  while (compareDates(cursor, gridEnd) <= 0) {
    const week: MonthGridDay[] = []
    for (let i = 0; i < 7; i += 1) {
      week.push({ date: cursor, inMonth: cursor.month === month && cursor.year === year })
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
  }

  return weeks
}

export function isSameDay(a: PlainDate, b: PlainDate): boolean {
  return datesEqual(a, b)
}
