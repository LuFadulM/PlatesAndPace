import { describe, expect, it } from 'vitest'
import { summariseWeek, weeklyReview, type LoggedSetSample } from '..'
import type { PlannedDay, PlannedExercise } from '../../plan/generator'

const ex = (exerciseId: string, rpeTarget: number): PlannedExercise => ({
  label: 'A', exerciseId, role: 'primary', sets: 3, repMin: 6, repMax: 10, rpeTarget, loadKg: 50, restSec: 120, technique: 'straight',
})

const gymDay = (date: string, exercises: PlannedExercise[]): PlannedDay => ({
  date, week: 1, phase: 'build', type: 'gym',
  gym: { kind: 'upper', titleKey: 't', intentKey: 'i', warmupKey: 'w', exercises, estimatedMinutes: 50 },
})

const restDay = (date: string): PlannedDay => ({ date, week: 1, phase: 'build', type: 'rest' })

const week = (): PlannedDay[] => [
  gymDay('2026-09-07', [ex('bench_press', 8)]),
  restDay('2026-09-08'),
  gymDay('2026-09-09', [ex('back_squat', 8)]),
  restDay('2026-09-10'),
  gymDay('2026-09-11', [ex('conventional_deadlift', 7)]),
]

describe('summariseWeek', () => {
  it('counts only the days that carried work', () => {
    const summary = summariseWeek(week(), new Set(['2026-09-07', '2026-09-09']), [])
    expect(summary.plannedSessions).toBe(3)
    expect(summary.completedSessions).toBe(2)
  })

  it('pairs each logged RPE with the target the plan asked for that day', () => {
    const sets: LoggedSetSample[] = [
      { date: '2026-09-07', exerciseId: 'bench_press', rpe: 9 },
      { date: '2026-09-11', exerciseId: 'conventional_deadlift', rpe: 8 },
    ]
    const summary = summariseWeek(week(), new Set(), sets)
    expect(summary.rpeSamples).toEqual([{ logged: 9, target: 8 }, { logged: 8, target: 7 }])
  })

  it('ignores an unlogged RPE and a lift the plan never prescribed that day', () => {
    const sets: LoggedSetSample[] = [
      { date: '2026-09-07', exerciseId: 'bench_press', rpe: null },
      { date: '2026-09-07', exerciseId: 'dumbbell_curl', rpe: 10 },
      { date: '2026-09-07', exerciseId: 'back_squat', rpe: 10 },
    ]
    expect(summariseWeek(week(), new Set(), sets).rpeSamples).toEqual([])
  })

  it('reads a week of missed sessions as struggling, not as an easy week', () => {
    const summary = summariseWeek(week(), new Set(['2026-09-07']), [
      { date: '2026-09-07', exerciseId: 'bench_press', rpe: 6 },
    ])
    const outcome = weeklyReview(summary)
    expect(outcome.verdict).toBe('struggling')
    expect(outcome.volumeMultiplier).toBeLessThan(1)
  })

  it('treats a fully logged, comfortable week as thriving', () => {
    const summary = summariseWeek(week(), new Set(['2026-09-07', '2026-09-09', '2026-09-11']), [
      { date: '2026-09-07', exerciseId: 'bench_press', rpe: 7 },
      { date: '2026-09-09', exerciseId: 'back_squat', rpe: 6.5 },
      { date: '2026-09-11', exerciseId: 'conventional_deadlift', rpe: 6 },
    ])
    expect(weeklyReview(summary).verdict).toBe('thriving')
  })

  it('carries the raw session counts so the card can show them', () => {
    const outcome = weeklyReview(summariseWeek(week(), new Set(['2026-09-07', '2026-09-09']), []))
    expect(outcome.plannedSessions).toBe(3)
    expect(outcome.completedSessions).toBe(2)
  })

  it('has nothing to judge when the week was all rest', () => {
    const summary = summariseWeek([restDay('2026-09-07')], new Set(), [])
    expect(summary.plannedSessions).toBe(0)
    expect(summary.rpeSamples).toEqual([])
  })
})
