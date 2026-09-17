import { describe, expect, it } from 'vitest'
import { dateInZone, todayInZone, zonedParts } from '../zone'
import { toISODate, weekday } from '../plain-date'
import { weekStrip } from '../calendar'

/**
 * PLAN.md §5. The whole suite runs under TZ=UTC and TZ=Pacific/Kiritimati in
 * CI, so any of these passing only by accident of the host zone will fail there.
 */
describe('todayInZone', () => {
  it('reads 21:00 in Bogotá as Tuesday 15 September 2026, not Wednesday', () => {
    // 2026-09-15 21:00 -05:00 is already 2026-09-16 02:00 UTC.
    const instant = new Date('2026-09-16T02:00:00Z')

    const bogota = todayInZone('America/Bogota', instant)

    expect(toISODate(bogota)).toBe('2026-09-15')
    expect(weekday(bogota)).toBe(2) // Tuesday
  })

  it('reads the same instant as 16 September in UTC and in Tokyo', () => {
    const instant = new Date('2026-09-16T02:00:00Z')

    expect(toISODate(todayInZone('UTC', instant))).toBe('2026-09-16')
    expect(toISODate(todayInZone('Asia/Tokyo', instant))).toBe('2026-09-16')
  })

  it('holds the month boundary: 30 September 23:30 in Bogotá is still September', () => {
    const instant = new Date('2026-10-01T04:30:00Z') // 2026-09-30 23:30 -05:00

    expect(toISODate(todayInZone('America/Bogota', instant))).toBe('2026-09-30')
    expect(toISODate(todayInZone('UTC', instant))).toBe('2026-10-01')
  })

  it('holds the year boundary: 31 December 22:00 in Bogotá is still 2026', () => {
    const instant = new Date('2027-01-01T03:00:00Z') // 2026-12-31 22:00 -05:00

    const bogota = todayInZone('America/Bogota', instant)

    expect(bogota.year).toBe(2026)
    expect(toISODate(bogota)).toBe('2026-12-31')
  })

  it('crosses forward over the date line for Kiritimati', () => {
    const instant = new Date('2026-09-15T12:00:00Z') // UTC+14 → already the 16th

    expect(toISODate(todayInZone('Pacific/Kiritimati', instant))).toBe('2026-09-16')
  })
})

describe('zonedParts', () => {
  it('reports the wall clock, not the UTC clock', () => {
    const parts = zonedParts('America/Bogota', new Date('2026-09-16T02:00:00Z'))

    expect(parts).toMatchObject({ year: 2026, month: 9, day: 15, hour: 21, minute: 0 })
  })

  it('uses a 24-hour clock so midnight is hour 0, not 24', () => {
    const parts = zonedParts('America/Bogota', new Date('2026-09-16T05:00:00Z'))

    expect(parts.hour).toBe(0)
    expect(parts.day).toBe(16)
  })
})

describe('DST transitions', () => {
  it('produces 7 distinct days across spring forward in Madrid', () => {
    // 2026-03-29 is the European spring-forward Sunday.
    const strip = weekStrip(dateInZone('Europe/Madrid', new Date('2026-03-29T10:00:00Z')))

    expect(strip).toHaveLength(7)
    expect(strip.map(toISODate)).toEqual([
      '2026-03-23',
      '2026-03-24',
      '2026-03-25',
      '2026-03-26',
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
    ])
  })

  it('produces 7 distinct days across fall back in New York', () => {
    // 2026-11-01 is the US fall-back Sunday.
    const strip = weekStrip(dateInZone('America/New_York', new Date('2026-11-01T12:00:00Z')))

    expect(strip).toHaveLength(7)
    expect(new Set(strip.map(toISODate)).size).toBe(7)
    expect(toISODate(strip[6]!)).toBe('2026-11-01')
  })

  it('keeps the local date stable either side of the repeated hour in New York', () => {
    // 01:30 EDT and 01:30 EST on 2026-11-01 are two different instants, one day.
    const beforeShift = dateInZone('America/New_York', new Date('2026-11-01T05:30:00Z'))
    const afterShift = dateInZone('America/New_York', new Date('2026-11-01T06:30:00Z'))

    expect(toISODate(beforeShift)).toBe('2026-11-01')
    expect(toISODate(afterShift)).toBe('2026-11-01')
  })
})
