/**
 * A calendar date with no time and no zone — the unit a training day is
 * measured in. A session belongs to a date in the athlete's zone, never to an
 * instant, so nothing in the engine may compare `Date` objects directly.
 *
 * All arithmetic runs through `Date.UTC`, which has no DST and no offset, so it
 * behaves as a pure proleptic Gregorian calculator regardless of the host zone.
 */
export interface PlainDate {
  /** Full year, e.g. 2026. */
  readonly year: number
  /** 1–12. */
  readonly month: number
  /** 1–31. */
  readonly day: number
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Builds a UTC `Date` positioned at midnight of the given calendar date. */
function toUtcInstant(date: PlainDate): Date {
  const instant = new Date(Date.UTC(date.year, date.month - 1, date.day))
  // Date.UTC maps years 0–99 into 1900–1999; undo that.
  if (date.year >= 0 && date.year <= 99) instant.setUTCFullYear(date.year)
  return instant
}

function fromUtcInstant(instant: Date): PlainDate {
  return {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
  }
}

export function plainDate(year: number, month: number, day: number): PlainDate {
  return { year, month, day }
}

/** True when the fields describe a real calendar date (rejects 2026-02-30). */
export function isValidPlainDate(date: PlainDate): boolean {
  if (!Number.isInteger(date.year) || !Number.isInteger(date.month) || !Number.isInteger(date.day)) {
    return false
  }
  if (date.month < 1 || date.month > 12 || date.day < 1 || date.day > 31) return false
  const roundTrip = fromUtcInstant(toUtcInstant(date))
  return (
    roundTrip.year === date.year && roundTrip.month === date.month && roundTrip.day === date.day
  )
}

/** Formats as `YYYY-MM-DD` — the shape stored in Postgres `date` columns. */
export function toISODate(date: PlainDate): string {
  const year = String(date.year).padStart(4, '0')
  const month = String(date.month).padStart(2, '0')
  const day = String(date.day).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Parses `YYYY-MM-DD`. Throws on malformed input or impossible dates. */
export function fromISODate(value: string): PlainDate {
  const match = ISO_DATE.exec(value)
  if (!match) throw new RangeError(`Not an ISO date: ${value}`)
  const date = plainDate(Number(match[1]), Number(match[2]), Number(match[3]))
  if (!isValidPlainDate(date)) throw new RangeError(`Not a real calendar date: ${value}`)
  return date
}

export function addDays(date: PlainDate, days: number): PlainDate {
  const instant = toUtcInstant(date)
  instant.setUTCDate(instant.getUTCDate() + days)
  return fromUtcInstant(instant)
}

export function addWeeks(date: PlainDate, weeks: number): PlainDate {
  return addDays(date, weeks * 7)
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function differenceInDays(to: PlainDate, from: PlainDate): number {
  const ms = toUtcInstant(to).getTime() - toUtcInstant(from).getTime()
  return Math.round(ms / 86_400_000)
}

/** Negative when `a` is earlier, 0 when equal, positive when later. */
export function compareDates(a: PlainDate, b: PlainDate): number {
  return differenceInDays(a, b)
}

export function datesEqual(a: PlainDate, b: PlainDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

/** ISO weekday, 1 = Monday … 7 = Sunday. */
export function weekday(date: PlainDate): Weekday {
  const sundayBased = toUtcInstant(date).getUTCDay()
  return (sundayBased === 0 ? 7 : sundayBased) as Weekday
}

/** Converts a `PlainDate` to a UTC-midnight `Date`, for `Intl` formatting only. */
export function toFormattableDate(date: PlainDate): Date {
  return toUtcInstant(date)
}
