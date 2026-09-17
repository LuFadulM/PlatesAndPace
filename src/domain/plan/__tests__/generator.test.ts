import { describe, expect, it } from 'vitest'
import { fromISODate } from '../../dates'
import { getExercise } from '../../exercises/library'
import { buildAthleteModel } from '../../profile/athlete'
import { questionnaireSchema, type QuestionnaireAnswers } from '../../profile/questionnaire'
import { assignRunKinds, generatePlan, type GeneratedPlan } from '../generator'

const TODAY = fromISODate('2026-09-15')

function build(overrides: Record<string, unknown>): QuestionnaireAnswers {
  const base: QuestionnaireAnswers = questionnaireSchema.parse({
    basics: { displayName: 'A', locale: 'en', timezone: 'UTC', units: 'metric' },
    body: { sex: 'male', birthDate: '1990-01-01', heightCm: 178, weightKg: 80 },
    health: { heartCondition: false, chestPain: false, dizziness: false, jointProblem: false, bloodPressureMedication: false, pregnancy: false, other: false },
    goals: { primary: 'build_muscle' },
    experience: { lifting: '1_to_3_years', knowsBigLifts: true, continuousRunMinutes: 0 },
    schedule: { gymDays: [1, 3, 5], runDays: [], sessionMinutes: 60, startDate: '2026-09-14', blockWeeks: 8 },
    equipment: { setting: 'full_gym', unavailableMachines: [] },
    injuries: { areas: [], note: '' },
    preferences: { focusAreas: [], intensity: 'hard', avoidExerciseIds: [] },
  })
  return questionnaireSchema.parse({ ...base, ...overrides })
}

/** PLAN.md §11.3 — three athletes who must get three different plans. */
const BEGINNER_WOMAN = build({
  basics: { displayName: 'Ana', locale: 'es', timezone: 'America/Bogota', units: 'metric' },
  body: { sex: 'female', birthDate: '2001-05-05', heightCm: 164, weightKg: 62 },
  goals: { primary: 'lose_fat' },
  experience: { lifting: 'none', knowsBigLifts: false, continuousRunMinutes: 0 },
  schedule: { gymDays: [1, 3, 5], runDays: [], sessionMinutes: 45, startDate: '2026-09-14', blockWeeks: 8 },
  equipment: { setting: 'dumbbells_bench', unavailableMachines: [] },
})

const INTERMEDIATE_MAN = build({
  basics: { displayName: 'Beto', locale: 'es', timezone: 'America/Bogota', units: 'metric' },
  body: { sex: 'male', birthDate: '1986-03-03', heightCm: 180, weightKg: 85 },
  goals: { primary: 'get_strong' },
  experience: { lifting: '1_to_3_years', knowsBigLifts: true, continuousRunMinutes: 0 },
  schedule: { gymDays: [1, 2, 4, 5], runDays: [], sessionMinutes: 75, startDate: '2026-09-14', blockWeeks: 8 },
})

const HYBRID_RUNNER = build({
  basics: { displayName: 'Owner', locale: 'es', timezone: 'America/Bogota', units: 'metric' },
  body: { sex: 'unspecified', birthDate: '1996-05-14', heightCm: 172, weightKg: 70 },
  goals: { primary: 'hybrid', targetRace: '10k' },
  experience: { lifting: '1_to_3_years', knowsBigLifts: true, recentRun: { km: 3, minutes: 20 } },
  schedule: { gymDays: [1, 2, 3, 4, 5], runDays: [2, 4, 6], longRunDay: 6, sessionMinutes: 60, startDate: '2026-09-14', blockWeeks: 8 },
  preferences: { focusAreas: ['back', 'legs'], intensity: 'hard', avoidExerciseIds: [] },
})

function plan(answers: QuestionnaireAnswers, seed = 'test'): GeneratedPlan {
  return generatePlan(buildAthleteModel(answers, TODAY), { block: 1, seed })
}

describe('generatePlan — shape', () => {
  it('produces one entry for every calendar day of the block, starting on a Monday', () => {
    const result = plan(INTERMEDIATE_MAN)
    expect(result.days).toHaveLength(8 * 7)
    expect(result.startDate).toBe('2026-09-14')
    expect(result.days[0]!.date).toBe('2026-09-14')
    expect(result.days.at(-1)!.date).toBe('2026-11-08')
  })

  it('starts the block on the Monday of the start week even when the start date is midweek', () => {
    const midweek = build({ schedule: { gymDays: [1, 3, 5], runDays: [], sessionMinutes: 60, startDate: '2026-09-17', blockWeeks: 4 } })
    expect(plan(midweek).startDate).toBe('2026-09-14')
  })

  it('puts gym sessions on the chosen days and rest elsewhere', () => {
    const result = plan(INTERMEDIATE_MAN)
    const firstWeek = result.days.slice(0, 7)
    expect(firstWeek.map((d) => d.type)).toEqual(['gym', 'gym', 'rest', 'gym', 'gym', 'rest', 'rest'])
  })

  it('numbers weeks and phases the way the periodization module does', () => {
    const result = plan(INTERMEDIATE_MAN)
    expect(result.days[0]!.week).toBe(1)
    expect(result.days[0]!.phase).toBe('calibration')
    expect(result.days[21]!.phase).toBe('deload')
    expect(result.days.at(-1)!.phase).toBe('deload')
  })

  it('is deterministic for the same seed and different for another', () => {
    const a = plan(HYBRID_RUNNER, 'seed-1')
    const b = plan(HYBRID_RUNNER, 'seed-1')
    const c = plan(HYBRID_RUNNER, 'seed-2')
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c))
  })
})

describe('generatePlan — three profiles, three plans (PLAN.md §11.3)', () => {
  const ana = plan(BEGINNER_WOMAN)
  const beto = plan(INTERMEDIATE_MAN)
  const owner = plan(HYBRID_RUNNER)

  it('gives each athlete a different split', () => {
    expect(ana.settings.split).toEqual(['full_body_a', 'full_body_b', 'full_body_c'])
    expect(beto.settings.split).toEqual(['upper', 'lower', 'upper', 'lower'])
    expect(owner.settings.split).toEqual(['lower_a', 'upper_a', 'glutes_lower_b', 'upper_b', 'full_body_a'])
  })

  it('never hands the dumbbell-only beginner a barbell or a machine', () => {
    for (const day of ana.days) {
      for (const e of day.gym?.exercises ?? []) {
        const def = getExercise(e.exerciseId)
        expect(def.implement, e.exerciseId).not.toBe('barbell')
        expect(def.implement, e.exerciseId).not.toBe('machine')
        expect(def.implement, e.exerciseId).not.toBe('cable')
      }
    }
  })

  it('gives the beginner supersets and a finisher for fat loss', () => {
    const gym = ana.days.find((d) => d.gym)!.gym!
    expect(gym.finisher).toBeDefined()
    expect(gym.exercises.some((e) => e.supersetGroup)).toBe(true)
  })

  it('gives the strength athlete low reps on primaries with a top set', () => {
    const buildWeek = beto.days.find((d) => d.week === 2 && d.gym)!.gym!
    const primary = buildWeek.exercises.find((e) => e.role === 'primary')!
    expect(primary.repMax).toBeLessThanOrEqual(6)
    expect(primary.technique).toBe('top_set_backoff')
  })

  it('gives the hybrid runner three runs a week in the right places', () => {
    const week = owner.days.slice(0, 7)
    expect(week[1]!.run?.kind).toBe('easy') // Tuesday
    expect(week[3]!.run?.kind).toBe('interval') // Thursday
    expect(week[5]!.run?.kind).toBe('long') // Saturday
    expect(week[1]!.type).toBe('gym_run')
    expect(week[5]!.type).toBe('run')
  })

  it('keeps the hybrid runner legs light the day before the long run', () => {
    const friday = owner.days[4]!.gym!
    for (const e of friday.exercises) {
      if (getExercise(e.exerciseId).region === 'lower') {
        expect(e.rpeTarget, e.exerciseId).toBeLessThanOrEqual(7)
        expect(getExercise(e.exerciseId).patterns, e.exerciseId).not.toContain('spinal_loading')
      }
    }
  })

  it('caps lower-body sets for the hybrid runner on interval day', () => {
    const thursday = owner.days[3]!.gym!
    const lowerSets = thursday.exercises
      .filter((e) => getExercise(e.exerciseId).region === 'lower')
      .reduce((s, e) => s + e.sets, 0)
    expect(lowerSets).toBeLessThanOrEqual(4)
  })

  it('derives the runner paces from the 3 km in 20:00 example', () => {
    expect(Math.round(owner.paces!.fiveK)).toBe(412)
    const easy = owner.days[1]!.run!
    expect(Math.round(easy.paceSecPerKm!)).toBe(536)
  })

  it('never lets the long run grow more than 10% between build weeks', () => {
    const longs = owner.days.filter((d) => d.run?.kind === 'long').map((d) => d.run!.km)
    for (let i = 1; i < longs.length; i += 1) {
      const isRecovery = (i + 1) % 4 === 0
      if (!isRecovery && i % 4 !== 0) expect(longs[i]!).toBeLessThanOrEqual(longs[i - 1]! * 1.1 + 0.5)
    }
  })

  it('produces three genuinely different first sessions', () => {
    const ids = (p: GeneratedPlan) => p.days.find((d) => d.gym)!.gym!.exercises.map((e) => e.exerciseId).join(',')
    expect(new Set([ids(ana), ids(beto), ids(owner)]).size).toBe(3)
  })
})

describe('generatePlan — continuity', () => {
  it('keeps the primary and secondary lifts of each session kind the same every week', () => {
    // Progressive overload needs a lift to repeat: the next session's load is
    // derived from the last one, and a rotating lift has no last one.
    for (const answers of [BEGINNER_WOMAN, INTERMEDIATE_MAN, HYBRID_RUNNER]) {
      const result = plan(answers)
      const byKind = new Map<string, Set<string>>()
      for (const day of result.days) {
        if (!day.gym) continue
        const key = day.gym.kind
        const leads = day.gym.exercises.filter((e) => e.role === 'primary' || e.role === 'secondary').map((e) => e.exerciseId).join(',')
        byKind.set(key, (byKind.get(key) ?? new Set()).add(leads))
      }
      for (const [kind, variants] of byKind) expect(variants.size, `${kind} for ${answers.basics.displayName}`).toBe(1)
    }
  })
})

describe('generatePlan — guards', () => {
  it('respects an injury across every session of the block', () => {
    const kneeInjury = build({ injuries: { areas: ['knees'], note: '' } })
    for (const day of plan(kneeInjury).days) {
      for (const e of day.gym?.exercises ?? []) {
        expect(getExercise(e.exerciseId).patterns, e.exerciseId).not.toContain('deep_knee_flexion')
        expect(getExercise(e.exerciseId).patterns, e.exerciseId).not.toContain('loaded_lunge')
      }
    }
  })

  it('never offers a barbell squat, deadlift or bench to someone who does not know the technique', () => {
    const noTechnique = build({ experience: { lifting: '3_plus_years', knowsBigLifts: false, continuousRunMinutes: 0 } })
    for (const day of plan(noTechnique).days) {
      for (const e of day.gym?.exercises ?? []) expect(getExercise(e.exerciseId).bigLift, e.exerciseId).toBeFalsy()
    }
  })

  it('caps RPE at 8 for a minor in every set of the block', () => {
    const minor = build({ body: { sex: 'male', birthDate: '2009-06-01', heightCm: 175, weightKg: 68 } })
    for (const day of plan(minor).days) {
      for (const e of day.gym?.exercises ?? []) expect(e.rpeTarget).toBeLessThanOrEqual(8)
    }
  })

  it('starts a conservative athlete lighter than the same athlete without health flags', () => {
    const flagged = build({ health: { heartCondition: false, chestPain: true, dizziness: false, jointProblem: false, bloodPressureMedication: false, pregnancy: false, other: false } })
    const normal = plan(INTERMEDIATE_MAN)
    const careful = plan(flagged)
    const first = (p: GeneratedPlan) => p.days.find((d) => d.gym)!.gym!.exercises[0]!
    expect(first(careful).loadKg).toBeLessThan(first(normal).loadKg)
  })

  it('honours an unavailable machine', () => {
    const noLegPress = build({ equipment: { setting: 'full_gym', unavailableMachines: ['leg_press'] } })
    for (const day of plan(noLegPress).days) {
      for (const e of day.gym?.exercises ?? []) expect(e.exerciseId).not.toBe('leg_press')
    }
  })

  it('uses the latest estimated max for the next block when one exists', () => {
    const model = buildAthleteModel(INTERMEDIATE_MAN, TODAY)
    const fresh = generatePlan(model, { block: 1, seed: 's' })
    const firstId = fresh.days.find((d) => d.gym)!.gym!.exercises[0]!.exerciseId
    const stronger = generatePlan(model, { block: 2, seed: 's', previousMaxes: { [firstId]: 200 } })
    const before = fresh.days.find((d) => d.gym)!.gym!.exercises[0]!
    const after = stronger.days.find((d) => d.gym)!.gym!.exercises.find((e) => e.exerciseId === firstId)!
    expect(after.loadKg).toBeGreaterThan(before.loadKg)
  })

  it('gives a home athlete with no equipment a full plan of bodyweight work', () => {
    const home = build({ equipment: { setting: 'home_none', unavailableMachines: [] }, experience: { lifting: 'none', knowsBigLifts: false, continuousRunMinutes: 0 } })
    const result = plan(home)
    const gym = result.days.find((d) => d.gym)!.gym!
    expect(gym.exercises.length).toBeGreaterThanOrEqual(3)
    for (const e of gym.exercises) expect(getExercise(e.exerciseId).implement).toBe('bodyweight')
  })

  it('schedules run/walk sessions for someone who cannot yet run continuously', () => {
    const walker = build({ goals: { primary: 'run_faster', targetRace: '5k' }, experience: { lifting: 'none', knowsBigLifts: false, continuousRunMinutes: 2 }, schedule: { gymDays: [1, 4], runDays: [2, 6], longRunDay: 6, sessionMinutes: 45, startDate: '2026-09-14', blockWeeks: 8 } })
    const run = plan(walker).days.find((d) => d.run)!.run!
    expect(run.kind).toBe('run_walk')
    expect(run.runWalk?.runMinutes).toBe(2)
  })

  it('assigns the hard run day furthest from the long run', () => {
    const model = buildAthleteModel(HYBRID_RUNNER, TODAY)
    const kinds = assignRunKinds(model)
    expect(kinds.get(2)).toBe('easy')
    expect(kinds.get(4)).toBe('interval')
    expect(kinds.get(6)).toBe('long')
  })
})
