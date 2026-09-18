import { describe, expect, it } from 'vitest'
import { addDays, compareDates, fromISODate, startOfPlanWeek, toISODate } from '../../dates'
import { buildAthleteModel } from '../../profile/athlete'
import { questionnaireSchema } from '../../profile/questionnaire'
import { generatePlan } from '../generator'

/**
 * Starting a second block.
 *
 * The questionnaire's start date belongs to the first block. Generating the
 * next one from it produces a block that has already ended: every day falls
 * before today, nothing is written, and the athlete is stuck. The next block
 * has to be generated from the week they are actually in.
 */
const BLOCK_ONE_START = '2026-09-14'
const TODAY = fromISODate('2026-12-01') // long after an eight-week block ended

const answers = questionnaireSchema.parse({
  basics: { displayName: 'A', locale: 'es', timezone: 'America/Bogota', units: 'metric' },
  body: { sex: 'female', birthDate: '1990-01-01', heightCm: 168, weightKg: 65 },
  health: { heartCondition: false, chestPain: false, dizziness: false, jointProblem: false, bloodPressureMedication: false, pregnancy: false, other: false },
  goals: { primary: 'hypertrophy' },
  experience: { lifting: '1_to_3_years', knowsBigLifts: true, continuousRunMinutes: 0 },
  schedule: { gymDays: [1, 3, 5], runDays: [], sessionMinutes: 60, startDate: BLOCK_ONE_START, blockWeeks: 8 },
  equipment: { setting: 'full_gym', unavailableMachines: [] },
  injuries: { areas: [], note: '' },
  preferences: { focusAreas: [], intensity: 'hard', avoidExerciseIds: [] },
})

describe('the block after the first', () => {
  it('generates nothing usable from the original start date', () => {
    const stale = generatePlan(buildAthleteModel(answers, TODAY), { block: 2, seed: 'x' })
    const fromToday = stale.days.filter((day) => day.date >= toISODate(TODAY))
    // This is the failure the card would have walked into: a plan with no
    // future in it, and a start date that reads as already finished.
    expect(fromToday).toEqual([])
  })

  it('covers the athlete when generated from the week they are in', () => {
    const model = { ...buildAthleteModel(answers, TODAY), startDate: TODAY }
    const plan = generatePlan(model, { block: 2, seed: 'x' })

    expect(plan.startDate).toBe(toISODate(startOfPlanWeek(TODAY)))
    const fromToday = plan.days.filter((day) => day.date >= toISODate(TODAY))
    expect(fromToday.length).toBeGreaterThan(0)
    expect(fromToday.some((day) => day.type !== 'rest')).toBe(true)
  })

  it('runs its full length forward from that week', () => {
    const model = { ...buildAthleteModel(answers, TODAY), startDate: TODAY }
    const plan = generatePlan(model, { block: 2, seed: 'x' })
    const lastDay = addDays(fromISODate(plan.startDate), plan.weeks * 7 - 1)
    expect(compareDates(lastDay, TODAY)).toBeGreaterThan(0)
    expect(plan.days.at(-1)!.date).toBe(toISODate(lastDay))
  })
})
