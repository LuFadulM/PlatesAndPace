import { toFormattableDate, type PlainDate } from './plain-date'

/**
 * Locale-aware date formatting (PLAN.md §4). Every formatter pins
 * `timeZone: 'UTC'` because a `PlainDate` is rendered as a UTC-midnight instant
 * — without that pin the host zone could shift the rendered day backwards.
 */
function format(date: PlainDate, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    toFormattableDate(date),
  )
}

/** "Tuesday, 15 September" / "martes, 15 de septiembre" */
export function formatLongDate(date: PlainDate, locale: string): string {
  return format(date, locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** "Tue" / "mar" — the week strip. */
export function formatWeekdayShort(date: PlainDate, locale: string): string {
  return format(date, locale, { weekday: 'short' })
}

/** "T" / "M" — the month grid header. */
export function formatWeekdayNarrow(date: PlainDate, locale: string): string {
  return format(date, locale, { weekday: 'narrow' })
}

/** "September 2026" / "septiembre de 2026" */
export function formatMonthYear(date: PlainDate, locale: string): string {
  return format(date, locale, { month: 'long', year: 'numeric' })
}

/** Seconds per kilometre as "5:42". */
export function formatPace(secondsPerKm: number, locale: string): string {
  const total = Math.round(secondsPerKm)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  const minutePart = new Intl.NumberFormat(locale).format(minutes)
  return `${minutePart}:${String(seconds).padStart(2, '0')}`
}

/** Seconds as "20:00" or "1:12:30". */
export function formatDuration(totalSeconds: number, locale: string): string {
  const total = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const lead = new Intl.NumberFormat(locale).format(hours > 0 ? hours : minutes)
  if (hours > 0) {
    return `${lead}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${lead}:${String(seconds).padStart(2, '0')}`
}
