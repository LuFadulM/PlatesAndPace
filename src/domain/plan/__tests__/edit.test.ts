import { describe, expect, it } from 'vitest'
import { fromISODate } from '../../dates'
import { getExercise } from '../../exercises/library'
import { buildAthleteModel } from '../../profile/athlete'
import { questionnaireSchema, type QuestionnaireAnswers } from '../../profile/questionnaire'
import {
  EDIT_LIMITS,
  addExercise,
  alternativesFor,
  catalogueFor,
  moveExercise,
  prescribeLoad,
  removeExercise,
  swapExercise,
  updateExercise,
} from '../edit'
import { generatePlan, regenerateGymSession, type GymSession } from '../generator'

const TODAY = fromISODate('2026-09-15')

function answers(overrides: Partial<QuestionnaireAnswers> = {}): QuestionnaireAnswers {
  return questionnaireSchema.parse({
    basics: { displayName: 'Lu', locale: 'es', timezone: 'America/Bogota', units: 'metric' },
    body: { sex: 'female', birthDate: '1996-05-14', heightCm: 165, weightKg: 60 },
    health: { heartCondition: false, chestPain: false, dizziness: false, jointProblem: false, bloodPressureMedication: false, pregnancy: false, other: false },
    goals: { primary: 'build_muscle' },
    experience: { lifting: '1_to_3_years', knowsBigLifts: true, continuousRunMinutes: 0 },
    schedule: { gymDays: [1, 3, 5], runDays: [], splitMode: 'auto', sessionMinutes: 60, startDate: '2026-09-14', blockWeeks: 8 },
    equipment: { setting: 'full_gym', unavailableMachines: [] },
    injuries: { areas: [], note: '' },
    preferences: { focusAreas: [], intensity: 'hard', avoidExerciseIds: [] },
    ...overrides,
  })
}

const model = buildAthleteModel(answers(), TODAY)
const ctx = { model, week: 2, totalWeeks: 8 }

function session(focus: ('glutes' | 'hamstrings' | 'chest' | 'back')[] = ['glutes', 'hamstrings']): GymSession {
  return regenerateGymSession(model, { focus, week: 2, todaysRun: 'none', tomorrowsRun: 'none', seed: 'edit-test' })
}

describe('alternativesFor', () => {
  it('offers movements for the same primary muscle first, none already in the session', () => {
    const gym = session()
    const primary = gym.exercises[0]!
    const options = alternativesFor(gym, primary.exerciseId, model)
    expect(options.length).toBeGreaterThan(0)
    const inSession = new Set(gym.exercises.map((e) => e.exerciseId))
    for (const o of options) expect(inSession.has(o.id)).toBe(false)
    const muscle = getExercise(primary.exerciseId).primary
    const firstSecondary = options.findIndex((o) => o.primary !== muscle)
    const lastPrimary = options.map((o) => o.primary === muscle).lastIndexOf(true)
    if (firstSecondary >= 0) expect(lastPrimary).toBeLessThan(firstSecondary)
  })

  it('never offers what the athlete cannot do: bodyweight-only at home, machines marked unavailable, banned patterns', () => {
    const home = buildAthleteModel(answers({ equipment: { setting: 'home_none', unavailableMachines: [] } }), TODAY)
    const gym = regenerateGymSession(home, { focus: ['quads', 'glutes'], week: 1, todaysRun: 'none', tomorrowsRun: 'none', seed: 'home' })
    for (const e of gym.exercises) for (const o of alternativesFor(gym, e.exerciseId, home)) expect(o.implement).toBe('bodyweight')

    const knee = buildAthleteModel(answers({ injuries: { areas: ['knees'], note: '' } }), TODAY)
    const legs = regenerateGymSession(knee, { focus: ['quads', 'glutes'], week: 1, todaysRun: 'none', tomorrowsRun: 'none', seed: 'knee' })
    for (const e of legs.exercises) for (const o of alternativesFor(legs, e.exerciseId, knee)) expect(o.patterns.some((p) => knee.bannedPatterns.has(p))).toBe(false)

    const noPress = buildAthleteModel(answers({ equipment: { setting: 'full_gym', unavailableMachines: ['leg_press'] } }), TODAY)
    const day = session()
    for (const e of day.exercises) expect(alternativesFor(day, e.exerciseId, noPress).some((o) => o.id === 'leg_press')).toBe(false)
  })

  it('never offers conditioning work as a swap', () => {
    const gym = session()
    for (const e of gym.exercises) for (const o of alternativesFor(gym, e.exerciseId, model)) expect(o.category).not.toBe('conditioning')
  })
})

describe('swapExercise', () => {
  it('keeps the slot prescription and re-derives the load for the new lift', () => {
    const gym = session()
    const from = gym.exercises[0]!
    const to = alternativesFor(gym, from.exerciseId, model)[0]!
    const swapped = swapExercise(gym, from.exerciseId, to.id, ctx)
    const after = swapped.exercises[0]!
    expect(after.exerciseId).toBe(to.id)
    expect(after.label).toBe(from.label)
    expect(after.sets).toBe(from.sets)
    expect([after.repMin, after.repMax, after.rpeTarget, after.restSec]).toEqual([from.repMin, from.repMax, from.rpeTarget, from.restSec])
    expect(after.loadKg).toBe(prescribeLoad(to, Math.round((from.repMin + from.repMax) / 2), from.rpeTarget, ctx))
    expect(swapped.exercises.length).toBe(gym.exercises.length)
  })

  it('opens a swapped-in lift at the athlete\'s own max when they have one', () => {
    const gym = session()
    const from = gym.exercises[0]!
    const to = alternativesFor(gym, from.exerciseId, model).find((o) => o.implement !== 'bodyweight')!
    const light = swapExercise(gym, from.exerciseId, to.id, { ...ctx, maxes: { [to.id]: 40 } }).exercises[0]!.loadKg
    const strong = swapExercise(gym, from.exerciseId, to.id, { ...ctx, maxes: { [to.id]: 120 } }).exercises[0]!.loadKg
    expect(strong).toBeGreaterThan(light)
  })

  it('refuses a duplicate, an unknown slot, or an exercise the athlete cannot do', () => {
    const gym = session()
    const [a, b] = gym.exercises
    expect(() => swapExercise(gym, a!.exerciseId, b!.exerciseId, ctx)).toThrow()
    expect(() => swapExercise(gym, 'not_here', 'leg_press', ctx)).toThrow()
    const home = buildAthleteModel(answers({ equipment: { setting: 'home_none', unavailableMachines: [] } }), TODAY)
    expect(() => swapExercise(gym, a!.exerciseId, 'leg_press', { ...ctx, model: home })).toThrow()
  })
})

describe('addExercise / removeExercise / moveExercise', () => {
  it('adds with the role\'s rep band and rest, relabels, and updates the estimate', () => {
    const gym = session()
    const pick = catalogueFor(gym, model).find((e) => e.category === 'isolation')!
    const added = addExercise(gym, pick.id, ctx)
    expect(added.exercises.length).toBe(gym.exercises.length + 1)
    const last = added.exercises.at(-1)!
    expect(last.exerciseId).toBe(pick.id)
    expect(last.role).toBe('isolation')
    expect(last.repMin).toBeGreaterThanOrEqual(10)
    expect(last.sets).toBeGreaterThanOrEqual(1)
    expect(last.label).not.toBe('')
    expect(added.estimatedMinutes).toBeGreaterThan(gym.estimatedMinutes)
    const labels = added.exercises.map((e) => e.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('a compound added to a session with a primary lift becomes the secondary, not a second primary', () => {
    const gym = session()
    const compound = catalogueFor(gym, model).find((e) => e.category === 'compound')!
    const role = addExercise(gym, compound.id, ctx).exercises.at(-1)!.role
    expect(role).toBe('secondary')
  })

  it('removes and relabels so A, B, C stay contiguous', () => {
    const gym = session()
    const gone = gym.exercises[1]!.exerciseId
    const removed = removeExercise(gym, gone)
    expect(removed.exercises.some((e) => e.exerciseId === gone)).toBe(false)
    expect(removed.exercises[0]!.label).toBe('A')
    expect(removed.exercises[1]!.label.startsWith('B')).toBe(true)
  })

  it('moves up and down, and a superset pair split by a move stops being a pair', () => {
    const base = session()
    const [a, b, c] = base.exercises
    const paired: GymSession = { ...base, exercises: [a!, { ...b!, supersetGroup: 'x' }, { ...c!, supersetGroup: 'x' }, ...base.exercises.slice(3)] }
    const down = moveExercise(paired, a!.exerciseId, 'down')
    expect(down.exercises[1]!.exerciseId).toBe(a!.exerciseId)
    // Moving A between the pair breaks it: b and c are no longer adjacent.
    expect(down.exercises.find((e) => e.exerciseId === b!.exerciseId)!.supersetGroup).toBeUndefined()
    expect(moveExercise(base, a!.exerciseId, 'up')).toEqual(base)
    expect(moveExercise(base, base.exercises.at(-1)!.exerciseId, 'down')).toEqual(base)
  })

  it('caps the session length', () => {
    let gym = session()
    const pool = catalogueFor(gym, model)
    let i = 0
    while (gym.exercises.length < EDIT_LIMITS.exercises) gym = addExercise(gym, pool[i++]!.id, ctx)
    expect(() => addExercise(gym, pool[i]!.id, ctx)).toThrow()
  })
})

describe('updateExercise', () => {
  it('clamps every number and turns a backwards rep range round', () => {
    const gym = session()
    const id = gym.exercises[0]!.exerciseId
    const e = updateExercise(gym, id, { sets: 99, repMin: 12, repMax: 6, loadKg: -5, restSec: 5, rpeTarget: 3 }, 'metric').exercises[0]!
    expect(e.sets).toBe(EDIT_LIMITS.sets.max)
    expect([e.repMin, e.repMax]).toEqual([6, 12])
    expect(e.loadKg).toBe(0)
    expect(e.restSec).toBe(EDIT_LIMITS.restSec.min)
    expect(e.rpeTarget).toBe(EDIT_LIMITS.rpeTarget.min)
  })

  it('keeps a metric load to the quarter kilo and leaves everything else alone', () => {
    const gym = session()
    const before = gym.exercises[1]!
    const after = updateExercise(gym, before.exerciseId, { loadKg: 42.3 }, 'metric').exercises[1]!
    expect(after.loadKg).toBe(42.25)
    expect({ ...after, loadKg: before.loadKg }).toEqual(before)
  })
})

describe('the generated plan still labels and estimates as before', () => {
  it('produces contiguous labels and a positive estimate for every gym day', () => {
    const plan = generatePlan(model, { block: 1, seed: 'labels' })
    for (const day of plan.days) {
      if (!day.gym) continue
      expect(day.gym.exercises[0]?.label).toBe('A')
      expect(day.gym.estimatedMinutes).toBeGreaterThan(8)
    }
  })
})
