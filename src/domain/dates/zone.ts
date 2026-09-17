import { plainDate, type PlainDate } from './plain-date'

/**
 * The calendar date it currently is in `timeZone`.
 *
 * This is the only bridge from an instant to a training day, and it must never
 * be replaced by `new Date().getDate()` or by a UTC comparison: at 21:00 in
 * Bogotá the UTC date is already tomorrow, and the athlete's session is not.
 *
 * `Intl.DateTimeFormat` does the zone maths, so DST transitions and historical
 * offset changes come from the host's IANA database rather than from us.
 */
export function todayInZone(timeZone: string, now: Date = new Date()): PlainDate {
  return dateInZone(timeZone, now)
}

/** The calendar date that `instant` falls on in `timeZone`. */
export function dateInZone(timeZone: string, instant: Date): PlainDate {
  const parts = zonedParts(timeZone, instant)
  return plainDate(parts.year, parts.month, parts.day)
}

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** Wall-clock fields of `instant` as read in `timeZone`. */
export function zonedParts(timeZone: string, instant: Date): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const fields: Record<string, number> = {}
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') fields[part.type] = Number(part.value)
  }

  return {
    year: fields.year ?? 0,
    month: fields.month ?? 0,
    day: fields.day ?? 0,
    hour: fields.hour ?? 0,
    minute: fields.minute ?? 0,
    second: fields.second ?? 0,
  }
}

/** True when the host's ICU data recognises the zone. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

/**
 * The athlete's zone as the browser reports it, falling back to UTC where the
 * runtime cannot say. Only ever a default for the questionnaire — the stored
 * `profiles.timezone` is what the engine reads.
 */
export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
