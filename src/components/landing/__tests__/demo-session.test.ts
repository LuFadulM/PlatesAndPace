import { describe, expect, it } from 'vitest'
import { getExercise } from '../../../domain/exercises/library'
import { FOCUS_PRESETS, FOCUS_PRESET_IDS } from '../../../domain/strength/splits'
import { MUSCLE_GROUPS } from '../../../domain/strength/volume'
import { DEMO_TODAY, buildDemoSession } from '../demo-session'

describe('landing demo session', () => {
  it('builds a real session for every preset and every single muscle, at every level and length', () => {
    const focuses = [...FOCUS_PRESET_IDS.map((p) => FOCUS_PRESETS[p]), ...MUSCLE_GROUPS.map((m) => [m] as const)]
    for (const focus of focuses) {
      for (const tier of ['beginner', 'intermediate', 'advanced'] as const) {
        for (const sessionMinutes of [45, 60, 75] as const) {
          const session = buildDemoSession({ focus, tier, sessionMinutes, sex: 'female', today: DEMO_TODAY })
          expect(session.exercises.length, `${focus.join('+')} ${tier} ${sessionMinutes}`).toBeGreaterThanOrEqual(2)
          for (const e of session.exercises) expect(() => getExercise(e.exerciseId)).not.toThrow()
        }
      }
    }
  })

  it('is deterministic for the same choices, and reacts to level and length', () => {
    const a = buildDemoSession({ focus: ['glutes', 'hamstrings'], tier: 'intermediate', sessionMinutes: 60, sex: 'female', today: DEMO_TODAY })
    const b = buildDemoSession({ focus: ['glutes', 'hamstrings'], tier: 'intermediate', sessionMinutes: 60, sex: 'female', today: DEMO_TODAY })
    expect(a).toEqual(b)

    const beginner = buildDemoSession({ focus: ['glutes', 'hamstrings'], tier: 'beginner', sessionMinutes: 60, sex: 'female', today: DEMO_TODAY })
    const advanced = buildDemoSession({ focus: ['glutes', 'hamstrings'], tier: 'advanced', sessionMinutes: 60, sex: 'female', today: DEMO_TODAY })
    const totalSets = (s: typeof a) => s.exercises.reduce((n, e) => n + e.sets, 0)
    expect(totalSets(beginner)).toBeLessThan(totalSets(advanced))

    const short = buildDemoSession({ focus: ['chest', 'shoulders', 'triceps'], tier: 'intermediate', sessionMinutes: 45, sex: 'male', today: DEMO_TODAY })
    const long = buildDemoSession({ focus: ['chest', 'shoulders', 'triceps'], tier: 'intermediate', sessionMinutes: 75, sex: 'male', today: DEMO_TODAY })
    expect(short.exercises.length).toBeLessThan(long.exercises.length)
  })
})
