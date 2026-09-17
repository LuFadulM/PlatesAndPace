import { describe, expect, it } from 'vitest'
import {
  addDays,
  differenceInDays,
  fromISODate,
  isValidPlainDate,
  plainDate,
  toISODate,
  weekday,
} from '../plain-date'
import {
  monthGrid,
  relativeDayLabel,
  startOfPlanWeek,
  weekIndex,
  weekStrip,
} from '../calendar'

describe('PlainDate arithmetic', () => {
  it('rolls over month ends', () => {
    expect(toISODate(addDays(fromISODate('2026-09-30'), 1))).toBe('2026-10-01')
  })

  it('rolls over year ends in both directions', () => {
    expect(toISODate(addDays(fromISODate('2026-12-31'), 1))).toBe('2027-01-01')
    expect(toISODate(addDays(fromISODate('2027-01-01'), -1))).toBe('2026-12-31')
  })

  it('handles leap day', () => {
    expect(toISODate(addDays(fromISODate('2028-02-28'), 1))).toBe('2028-02-29')
    expect(toISODate(addDays(fromISODate('2027-02-28'), 1))).toBe('2027-03-01')
  })

  it('counts days across a DST boundary as whole days', () => {
    // A naive millisecond division would yield 6.958 days here and floor to 6.
    expect(differenceInDays(fromISODate('2026-11-08'), fromISODate('2026-11-01'))).toBe(7)
    expect(differenceInDays(fromISODate('2026-04-05'), fromISODate('2026-03-29'))).toBe(7)
  })

  it('rejects dates that do not exist', () => {
    expect(isValidPlainDate(plainDate(2026, 2, 30))).toBe(false)
    expect(isValidPlainDate(plainDate(2027, 2, 29))).toBe(false)
    expect(isValidPlainDate(plainDate(2028, 2, 29))).toBe(true)
    expect(() => fromISODate('2026-02-30')).toThrow(RangeError)
    expect(() => fromISODate('15/09/2026')).toThrow(RangeError)
  })

  it('numbers weekdays ISO-style with Monday first', () => {
    expect(weekday(fromISODate('2026-09-14'))).toBe(1) // Monday
    expect(weekday(fromISODate('2026-09-15'))).toBe(2) // Tuesday
    expect(weekday(fromISODate('2026-09-20'))).toBe(7) // Sunday
  })
})

describe('startOfPlanWeek', () => {
  it('returns the Monday of the containing week', () => {
    expect(toISODate(startOfPlanWeek(fromISODate('2026-09-15')))).toBe('2026-09-14')
  })

  it('returns the preceding Monday for a Sunday, not the following one', () => {
    expect(toISODate(startOfPlanWeek(fromISODate('2026-09-20')))).toBe('2026-09-14')
  })

  it('is a no-op on a Monday', () => {
    expect(toISODate(startOfPlanWeek(fromISODate('2026-09-14')))).toBe('2026-09-14')
  })

  it('reaches back across a month boundary', () => {
    expect(toISODate(startOfPlanWeek(fromISODate('2026-10-01')))).toBe('2026-09-28')
  })
})

describe('weekStrip', () => {
  it('runs Monday to Sunday and contains the given date', () => {
    const strip = weekStrip(fromISODate('2026-09-17'))

    expect(strip.map(toISODate)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ])
    expect(weekday(strip[0]!)).toBe(1)
    expect(weekday(strip[6]!)).toBe(7)
  })
})

describe('weekIndex', () => {
  it('numbers block weeks from 1, anchored on the start week Monday', () => {
    const blockStart = fromISODate('2026-09-16') // a Wednesday

    expect(weekIndex(fromISODate('2026-09-14'), blockStart)).toBe(1)
    expect(weekIndex(fromISODate('2026-09-20'), blockStart)).toBe(1)
    expect(weekIndex(fromISODate('2026-09-21'), blockStart)).toBe(2)
    expect(weekIndex(fromISODate('2026-11-02'), blockStart)).toBe(8)
  })

  it('goes non-positive before the block starts', () => {
    expect(weekIndex(fromISODate('2026-09-13'), fromISODate('2026-09-16'))).toBe(0)
  })
})

describe('relativeDayLabel', () => {
  const today = fromISODate('2026-09-15')

  it('labels the three near days and nothing else', () => {
    expect(relativeDayLabel(fromISODate('2026-09-15'), today)).toBe('today')
    expect(relativeDayLabel(fromISODate('2026-09-16'), today)).toBe('tomorrow')
    expect(relativeDayLabel(fromISODate('2026-09-14'), today)).toBe('yesterday')
    expect(relativeDayLabel(fromISODate('2026-09-17'), today)).toBeNull()
  })

  it('labels across a month boundary', () => {
    expect(relativeDayLabel(fromISODate('2026-10-01'), fromISODate('2026-09-30'))).toBe(
      'tomorrow',
    )
  })
})

describe('monthGrid', () => {
  it('pads to whole Monday-first weeks', () => {
    const grid = monthGrid(2026, 9)

    expect(grid.every((week) => week.length === 7)).toBe(true)
    expect(toISODate(grid[0]![0]!.date)).toBe('2026-08-31')
    expect(grid[0]![0]!.inMonth).toBe(false)
    expect(grid[0]![1]!.inMonth).toBe(true)
  })

  it('marks exactly the days of the month as in-month', () => {
    const inMonth = monthGrid(2026, 9)
      .flat()
      .filter((day) => day.inMonth)

    expect(inMonth).toHaveLength(30)
    expect(toISODate(inMonth[0]!.date)).toBe('2026-09-01')
    expect(toISODate(inMonth[29]!.date)).toBe('2026-09-30')
  })

  it('spans the December to January boundary without repeating a year', () => {
    const grid = monthGrid(2026, 12)
    const inMonth = grid.flat().filter((day) => day.inMonth)

    expect(inMonth).toHaveLength(31)
    expect(toISODate(grid.at(-1)!.at(-1)!.date)).toBe('2027-01-03')
  })

  it('covers February in a leap year', () => {
    expect(monthGrid(2028, 2).flat().filter((day) => day.inMonth)).toHaveLength(29)
  })
})
