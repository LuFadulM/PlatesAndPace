import { describe, expect, it } from 'vitest'
import { fromISODate } from '../../dates'
import { getExercise } from '../../exercises/library'
import { buildAthleteModel } from '../../profile/athlete'
import { questionnaireSchema, type QuestionnaireAnswers } from '../../profile/questionnaire'
import { isLowerBodyFocus, isLowerBodySession } from '../../strength/splits'
import { customBlueprint, sessionTemplate } from '../../strength/templates'
import { generatePlan, regenerateGymSession } from '../generator'

const TODAY = fromISODate('2026-09-15')

/** Lucía's week: legs + glutes, push, glutes + hamstrings, pull, full legs. */
const CUSTOM_WEEK = {
  '1': ['quads', 'glutes', 'hamstrings', 'calves'],
  '2': ['chest', 'shoulders', 'triceps'],
  '3': ['glutes', 'hamstrings'],
  '4': ['back', 'biceps'],
  '5': ['quads', 'hamstrings', 'glutes', 'calves'],
} as const

function answers(overrides: Partial<QuestionnaireAnswers['schedule']> = {}): QuestionnaireAnswers {
  return questionnaireSchema.parse({
    basics: { displayName: 'Lu', locale: 'es', timezone: 'America/Bogota', units: 'metric' },
    body: { sex: 'female', birthDate: '1996-05-14', heightCm: 165, weightKg: 60 },
    health: { heartCondition: false, chestPain: false, dizziness: false, jointProblem: false, bloodPressureMedication: false, pregnancy: false, other: false },
    goals: { primary: 'hypertrophy' },
    experience: { lifting: '1_to_3_years', knowsBigLifts: true, continuousRunMinutes: 0 },
    schedule: { gymDays: [1, 2, 3, 4, 5], runDays: [], splitMode: 'custom', customSplit: CUSTOM_WEEK, sessionMinutes: 75, startDate: '2026-09-14', blockWeeks: 8, ...overrides },
    equipment: { setting: 'full_gym', unavailableMachines: [] },
    injuries: { areas: [], note: '' },
    preferences: { focusAreas: [], intensity: 'hard', avoidExerciseIds: [] },
  })
}

describe('questionnaire — custom split', () => {
  it('requires every gym day to name at least one muscle when the split is custom', () => {
    expect(() => answers({ customSplit: { '1': ['quads'] } })).toThrow()
  })

  it('ignores customSplit entirely in auto mode', () => {
    const model = buildAthleteModel(answers({ splitMode: 'auto' }), TODAY)
    expect(model.customSplit).toBeUndefined()
  })
})

describe('customBlueprint', () => {
  it('gives the first muscle the primary lift and the second the secondary', () => {
    const pairs = customBlueprint(['glutes', 'hamstrings'])
    expect(pairs[0]).toEqual(['primary', 'glutes'])
    expect(pairs[1]).toEqual(['secondary', 'hamstrings'])
    expect(pairs.some(([role, muscle]) => role === 'isolation' && muscle === 'hamstrings')).toBe(true)
  })

  it('never gives a compound slot to a muscle the library only serves with isolation work', () => {
    for (const [role, muscle] of customBlueprint(['back', 'biceps'])) {
      if (muscle === 'biceps') expect(role).toBe('isolation')
    }
    // An arms day has no compound to open with: accessories and isolation only.
    for (const [role, muscle] of customBlueprint(['biceps', 'triceps'])) {
      expect(['accessory', 'isolation', 'core']).toContain(role)
      if (role === 'core') expect(muscle).toBe('abs')
    }
  })

  it('caps at eight slots and refuses an empty list', () => {
    expect(customBlueprint(['quads', 'hamstrings', 'glutes', 'calves', 'abs']).length).toBeLessThanOrEqual(8)
    expect(() => customBlueprint([])).toThrow(RangeError)
  })

  it('feeds sessionTemplate, which then fills every slot with a real exercise', () => {
    const slots = sessionTemplate('custom', 'hypertrophy', 'intermediate', 75, ['chest', 'shoulders', 'triceps'])
    expect(slots[0]?.role).toBe('primary')
    expect(slots[0]?.muscle).toBe('chest')
    expect(slots.length).toBe(7)
  })
})

describe('lower-body detection for custom sessions', () => {
  it('is driven by the chosen muscles, not the kind', () => {
    expect(isLowerBodyFocus(['glutes', 'hamstrings'])).toBe(true)
    expect(isLowerBodyFocus(['chest', 'shoulders', 'triceps'])).toBe(false)
    expect(isLowerBodySession('custom', ['calves'])).toBe(true)
    expect(isLowerBodySession('custom', ['back', 'biceps'])).toBe(false)
    expect(isLowerBodySession('custom')).toBe(false)
  })
})

describe('generatePlan — custom split', () => {
  const plan = generatePlan(buildAthleteModel(answers(), TODAY), { block: 1, seed: 'custom' })
  const week = plan.days.slice(0, 7)

  it('marks every gym day as a custom session carrying the muscles chosen for that weekday', () => {
    expect(plan.settings.split).toEqual(['custom', 'custom', 'custom', 'custom', 'custom'])
    expect(plan.settings.customSplit).toEqual(CUSTOM_WEEK)
    expect(week[0]?.gym?.focus).toEqual(CUSTOM_WEEK['1'])
    expect(week[3]?.gym?.focus).toEqual(CUSTOM_WEEK['4'])
    expect(week[5]?.type).toBe('rest')
  })

  it('opens each day with a compound for its first muscle and trains only the muscles chosen', () => {
    for (const day of week.slice(0, 5)) {
      const gym = day.gym!
      const focus = new Set(gym.focus!)
      const primary = getExercise(gym.exercises[0]!.exerciseId)
      expect(gym.exercises[0]!.role).toBe('primary')
      expect(primary.category).toBe('compound')
      expect(primary.primary).toBe(gym.focus![0])
      for (const e of gym.exercises) {
        const def = getExercise(e.exerciseId)
        // Abs get core work on any day. Everything else must train a chosen
        // muscle — as its main mover, or as a secondary mover when the library
        // has no main mover left for that slot (selection's documented fallback).
        const trainsChosen = focus.has(def.primary) || def.secondary.some((m) => focus.has(m))
        expect(trainsChosen || def.primary === 'abs', `${e.exerciseId} on ${day.date}`).toBe(true)
      }
    }
  })

  it('titles a custom day by its muscles and picks the warm-up by body region', () => {
    expect(week[0]?.gym?.titleKey).toBe('sessions.custom.title')
    expect(week[0]?.gym?.warmupKey).toBe('warmup.lower')
    expect(week[1]?.gym?.warmupKey).toBe('warmup.upper')
  })

  it('keeps the primary lift of a given muscle combination stable week to week', () => {
    const mondays = plan.days.filter((d) => d.gym?.focus?.join() === CUSTOM_WEEK['1'].join())
    const primaries = new Set(mondays.map((d) => d.gym!.exercises[0]!.exerciseId))
    expect(mondays.length).toBe(8)
    expect(primaries.size).toBe(1)
  })
})

describe('regenerateGymSession — choosing muscles on the day', () => {
  const model = buildAthleteModel(answers({ splitMode: 'auto', customSplit: {} }), TODAY)

  it('builds a session from the muscles given, deterministically for the same seed', () => {
    const a = regenerateGymSession(model, { focus: ['glutes', 'hamstrings'], week: 2, todaysRun: 'none', tomorrowsRun: 'none', seed: 'u:2026-09-15:glutes+hamstrings' })
    const b = regenerateGymSession(model, { focus: ['glutes', 'hamstrings'], week: 2, todaysRun: 'none', tomorrowsRun: 'none', seed: 'u:2026-09-15:glutes+hamstrings' })
    expect(a).toEqual(b)
    expect(a.kind).toBe('custom')
    expect(a.focus).toEqual(['glutes', 'hamstrings'])
    expect(getExercise(a.exercises[0]!.exerciseId).primary).toBe('glutes')
    expect(a.exercises.length).toBeGreaterThanOrEqual(5)
  })

  it('still respects the run scheduled for tomorrow', () => {
    const free = regenerateGymSession({ ...model, runsMatter: true }, { focus: ['quads', 'hamstrings', 'glutes'], week: 2, todaysRun: 'none', tomorrowsRun: 'none', seed: 's' })
    const beforeLong = regenerateGymSession({ ...model, runsMatter: true }, { focus: ['quads', 'hamstrings', 'glutes'], week: 2, todaysRun: 'none', tomorrowsRun: 'long', seed: 's' })
    const lowerSets = (s: typeof free) => s.exercises.filter((e) => getExercise(e.exerciseId).region === 'lower').reduce((n, e) => n + e.sets, 0)
    expect(lowerSets(beforeLong)).toBeLessThanOrEqual(6)
    expect(lowerSets(beforeLong)).toBeLessThanOrEqual(lowerSets(free))
    for (const e of beforeLong.exercises) {
      if (getExercise(e.exerciseId).region === 'lower') expect(e.rpeTarget).toBeLessThanOrEqual(7)
    }
  })

  it('uses the athlete\'s logged maxes for the loads', () => {
    const fresh = regenerateGymSession(model, { focus: ['chest'], week: 2, todaysRun: 'none', tomorrowsRun: 'none', seed: 's' })
    const first = fresh.exercises[0]!
    const stronger = regenerateGymSession(model, { focus: ['chest'], week: 2, todaysRun: 'none', tomorrowsRun: 'none', seed: 's', previousMaxes: { [first.exerciseId]: 200 } })
    expect(stronger.exercises[0]!.exerciseId).toBe(first.exerciseId)
    expect(stronger.exercises[0]!.loadKg).toBeGreaterThan(first.loadKg)
  })
})
