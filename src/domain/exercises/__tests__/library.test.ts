import { describe, expect, it } from 'vitest'
import en from '../../../../messages/en.json'
import es from '../../../../messages/es.json'
import { EXERCISES, EXERCISE_IDS, getExercise, MACHINE_IDS } from '../library'
import { MUSCLE_GROUPS } from '../../strength/volume'

type Catalog = { exercises: Record<string, Record<string, string>> }

describe('exercise library', () => {
  it('has unique ids', () => {
    expect(new Set(EXERCISE_IDS).size).toBe(EXERCISE_IDS.length)
  })

  it('names, cues and mistakes exist for every exercise in both languages', () => {
    const missing: string[] = []
    for (const [locale, catalog] of [['en', en], ['es', es]] as const) {
      for (const id of EXERCISE_IDS) {
        const entry = (catalog as Catalog).exercises[id]
        for (const field of ['name', 'cue1', 'cue2', 'mistake1', 'mistake2']) {
          if (!entry?.[field]) missing.push(`${locale}:${id}.${field}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('has no strings for exercises that do not exist', () => {
    const ids = new Set(EXERCISE_IDS)
    const orphans = Object.keys((en as Catalog).exercises).filter((id) => !ids.has(id))
    expect(orphans).toEqual([])
  })

  it('only references known muscle groups', () => {
    for (const exercise of EXERCISES) {
      expect(MUSCLE_GROUPS).toContain(exercise.primary)
      for (const muscle of exercise.secondary) expect(MUSCLE_GROUPS).toContain(muscle)
    }
  })

  it('gives every loaded exercise a positive strength ratio', () => {
    for (const exercise of EXERCISES) {
      if (exercise.implement === 'bodyweight' || exercise.category === 'conditioning') continue
      expect(exercise.strengthRatio, exercise.id).toBeGreaterThan(0)
    }
  })

  it('offers something for every muscle group in every equipment setting', () => {
    // A home athlete with no equipment still needs a plan that covers the body.
    for (const setting of ['full_gym', 'dumbbells_bench', 'home_none'] as const) {
      for (const muscle of MUSCLE_GROUPS) {
        const options = EXERCISES.filter(
          (e) => e.equipment.includes(setting) && (e.primary === muscle || e.secondary.includes(muscle)),
        )
        expect(options.length, `${setting}/${muscle}`).toBeGreaterThan(0)
      }
    }
  })

  it('reserves the big-lift flag for barbell squat, deadlift and bench', () => {
    const bigLifts = EXERCISES.filter((e) => e.bigLift).map((e) => e.id).sort()
    expect(bigLifts).toEqual(['back_squat', 'bench_press', 'conventional_deadlift', 'front_squat'])
  })

  it('exposes machine ids for the unavailable-machines step', () => {
    expect(MACHINE_IDS).toContain('leg_press')
    expect(MACHINE_IDS).toContain('lat_pulldown')
  })

  it('throws for an unknown id rather than returning undefined', () => {
    expect(() => getExercise('nope')).toThrow(RangeError)
  })
})
