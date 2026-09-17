import { describe, expect, it } from 'vitest'
import en from '../../../../messages/en.json'
import es from '../../../../messages/es.json'
import { EXERCISES, EXERCISE_IDS, findExercise, getExercise, MACHINE_IDS } from '../library'
import { difficultyOf, materialsOf, MATERIALS, MOVEMENTS } from '../types'
import { MUSCLE_GROUPS } from '../../strength/volume'

type Catalog = { exercises: Record<string, Record<string, string>> }

describe('exercise library', () => {
  it('has unique ids', () => {
    expect(new Set(EXERCISE_IDS).size).toBe(EXERCISE_IDS.length)
  })

  it('names, three cues, two mistakes and three steps exist for every exercise in both languages', () => {
    const missing: string[] = []
    for (const [locale, catalog] of [['en', en], ['es', es]] as const) {
      for (const id of EXERCISE_IDS) {
        const entry = (catalog as Catalog).exercises[id]
        for (const field of ['name', 'cue1', 'cue2', 'cue3', 'mistake1', 'mistake2', 'step1', 'step2', 'step3']) {
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

  it('reserves the big-lift flag for barbell squats, deadlifts and bench', () => {
    const bigLifts = EXERCISES.filter((e) => e.bigLift).map((e) => e.id).sort()
    expect(bigLifts).toEqual(['back_squat', 'bench_press', 'conventional_deadlift', 'front_squat', 'sumo_deadlift'])
  })

  it('exposes machine ids for the unavailable-machines step', () => {
    expect(MACHINE_IDS).toContain('leg_press')
    expect(MACHINE_IDS).toContain('lat_pulldown')
  })

  it('throws for an unknown id rather than returning undefined', () => {
    expect(() => getExercise('nope')).toThrow(RangeError)
  })

  it('tags every exercise on the four filter axes', () => {
    for (const exercise of EXERCISES) {
      expect(MOVEMENTS, exercise.id).toContain(exercise.movement)
      expect(['push', 'pull', 'static'], exercise.id).toContain(exercise.force)
      expect(['strengthen', 'stabilise', 'mobilise', 'cardio', 'nervous_system'], exercise.id).toContain(exercise.purpose)
      expect(['training', 'warmup', 'rehab', 'stretch'], exercise.id).toContain(exercise.type)
      for (const material of materialsOf(exercise)) expect(MATERIALS, exercise.id).toContain(material)
      expect(exercise.tempo, exercise.id).toMatch(/^([0-9X][0-9][0-9X][0-9]|X|hold)$/)
      expect(['beginner', 'intermediate', 'advanced']).toContain(difficultyOf(exercise))
    }
  })

  it('points every regression and progression at a real, related exercise', () => {
    // Related: same movement, or the two share a muscle. A leg curl can
    // progress to a glute-ham raise even though one is isolation and the other
    // a hinge; a curl never progresses to a calf raise.
    for (const exercise of EXERCISES) {
      for (const id of [...(exercise.regressions ?? []), ...(exercise.progressions ?? [])]) {
        const target = findExercise(id)
        expect(target, `${exercise.id} -> ${id}`).toBeDefined()
        if (!target) continue
        const muscles = new Set([exercise.primary, ...exercise.secondary])
        const shared = muscles.has(target.primary) || target.secondary.some((m) => muscles.has(m))
        expect(target.movement === exercise.movement || shared, `${exercise.id} -> ${id}`).toBe(true)
        expect(id).not.toBe(exercise.id)
      }
    }
  })

  it('never regresses to something harder or progresses to something easier', () => {
    const rank = { beginner: 0, intermediate: 1, advanced: 2 }
    for (const exercise of EXERCISES) {
      for (const id of exercise.regressions ?? []) {
        expect(rank[getExercise(id).minTier], `${exercise.id} -> ${id}`).toBeLessThanOrEqual(rank[exercise.minTier])
      }
      for (const id of exercise.progressions ?? []) {
        expect(rank[getExercise(id).minTier], `${exercise.id} -> ${id}`).toBeGreaterThanOrEqual(rank[exercise.minTier])
      }
    }
  })

  it('prescribes mobility work as timed holds and power work as explosive', () => {
    for (const exercise of EXERCISES) {
      if (exercise.category === 'mobility') expect(exercise.timed, exercise.id).toBe(true)
      if (exercise.category === 'power') expect(exercise.tempo, exercise.id).toMatch(/X/)
    }
  })
})
