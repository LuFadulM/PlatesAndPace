import { describe, expect, it } from 'vitest'
import { addDays, fromISODate, toISODate } from '../../dates'

/**
 * Block boundaries, proved on the same arithmetic `blockHasEnded` uses. The
 * helper itself lives beside the Supabase readers, so the rule it encodes is
 * pinned here: a block covers weeks × 7 days starting on its start date, and
 * the day after the last one is over.
 */
function blockEnded(startIso: string, weeks: number, todayIso: string): boolean {
  const last = addDays(fromISODate(startIso), weeks * 7 - 1)
  return toISODate(fromISODate(todayIso)) > toISODate(last)
}

describe('block boundaries', () => {
  const start = '2026-09-07'

  it('is not over on its first day', () => {
    expect(blockEnded(start, 8, start)).toBe(false)
  })

  it('is not over on its last day', () => {
    expect(blockEnded(start, 8, '2026-11-01')).toBe(false)
  })

  it('is over the morning after', () => {
    expect(blockEnded(start, 8, '2026-11-02')).toBe(true)
  })

  it('counts the shortest and longest blocks the questionnaire allows', () => {
    expect(blockEnded(start, 4, '2026-10-04')).toBe(false)
    expect(blockEnded(start, 4, '2026-10-05')).toBe(true)
    expect(blockEnded(start, 12, '2026-11-29')).toBe(false)
    expect(blockEnded(start, 12, '2026-11-30')).toBe(true)
  })
})
