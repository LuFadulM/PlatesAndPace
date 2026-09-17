import { describe, expect, it } from 'vitest'
import { fromISODate } from '../../dates'
import { getExercise } from '../../exercises/library'
import { buildAthleteModel, type AthleteModel } from '../../profile/athlete'
import { questionnaireSchema, type QuestionnaireAnswers } from '../../profile/questionnaire'
import { goalPolicy } from '../../strength/goals'
import { MUSCLE_GROUPS, SECONDARY_SET_CREDIT, VOLUME_LANDMARKS } from '../../strength/volume'
import { generatePlan, type GeneratedPlan } from '../generator'

/**
 * Named athletes, readable as documentation. Each one must get a valid plan:
 * nothing contraindicated, nothing they cannot load, nothing over their time,
 * nothing past what a muscle can recover from, and the signature of their goal.
 */
const TODAY = fromISODate('2026-09-15')

const base = {
  basics: { displayName: 'A', locale: 'es', timezone: 'America/Bogota', units: 'metric' },
  body: { sex: 'female', birthDate: '1990-01-01', heightCm: 168, weightKg: 65 },
  health: { heartCondition: false, chestPain: false, dizziness: false, jointProblem: false, bloodPressureMedication: false, pregnancy: false, other: false },
  goals: { primary: 'hypertrophy' },
  experience: { lifting: '1_to_3_years', knowsBigLifts: true, continuousRunMinutes: 0 },
  schedule: { gymDays: [1, 3, 5], runDays: [], sessionMinutes: 60, startDate: '2026-09-14', blockWeeks: 8 },
  equipment: { setting: 'full_gym', unavailableMachines: [] },
  injuries: { areas: [], note: '' },
  preferences: { focusAreas: [], intensity: 'hard', avoidExerciseIds: [] },
}

const athlete = (over: Record<string, unknown>): QuestionnaireAnswers => questionnaireSchema.parse({ ...base, ...over })

const ATHLETES: Array<[string, QuestionnaireAnswers]> = [
  [
    '38-year-old, 3 days a week, home dumbbells only, bad left shoulder, wants muscle',
    athlete({ body: { sex: 'male', birthDate: '1988-04-10', heightCm: 178, weightKg: 82 }, equipment: { setting: 'dumbbells_bench', unavailableMachines: [] }, injuries: { areas: ['shoulders'], note: '' } }),
  ],
  [
    'complete beginner, 52, two days a week, 45 minutes, general health, on blood-pressure medication',
    athlete({ body: { sex: 'female', birthDate: '1974-02-02', heightCm: 160, weightKg: 70 }, health: { ...base.health, bloodPressureMedication: true, medicalAcknowledged: true }, goals: { primary: 'general_health' }, experience: { lifting: 'none', knowsBigLifts: false, continuousRunMinutes: 0 }, schedule: { gymDays: [2, 5], runDays: [], sessionMinutes: 45, startDate: '2026-09-14', blockWeeks: 8 } }),
  ],
  [
    'advanced powerlifter, four days, 90 minutes, wants max strength',
    athlete({ body: { sex: 'male', birthDate: '1995-07-07', heightCm: 182, weightKg: 95 }, goals: { primary: 'strength' }, experience: { lifting: '3_plus_years', knowsBigLifts: true, continuousRunMinutes: 0 }, schedule: { gymDays: [1, 2, 4, 5], runDays: [], sessionMinutes: 90, startDate: '2026-09-14', blockWeeks: 8 } }),
  ],
  [
    'runner training for a half, lifts twice, bad knees',
    athlete({ goals: { primary: 'endurance', targetRace: 'half' }, experience: { lifting: 'under_1_year', knowsBigLifts: false, recentRun: { km: 10, minutes: 58 }, restingHr: 54 }, schedule: { gymDays: [1, 4], runDays: [2, 3, 6], longRunDay: 6, sessionMinutes: 45, startDate: '2026-09-14', blockWeeks: 8 }, injuries: { areas: ['knees'], note: '' } }),
  ],
  [
    '17-year-old football player, three days, athletic performance, bodyweight only',
    athlete({ body: { sex: 'male', birthDate: '2009-03-03', heightCm: 175, weightKg: 68 }, goals: { primary: 'athletic_performance' }, experience: { lifting: 'under_1_year', knowsBigLifts: false, continuousRunMinutes: 20 }, equipment: { setting: 'home_none', unavailableMachines: [] } }),
  ],
  [
    'coming back after a back injury, three short sessions, mobility first',
    athlete({ goals: { primary: 'mobility_rehab' }, injuries: { areas: ['lower_back'], note: '' }, schedule: { gymDays: [1, 3, 5], runDays: [], sessionMinutes: 30, startDate: '2026-09-14', blockWeeks: 8 } }),
  ],
  [
    'fat loss with a history of disordered eating, five days, 60 minutes, focus on glutes',
    athlete({ health: { ...base.health, disorderedEating: true }, goals: { primary: 'fat_loss' }, schedule: { gymDays: [1, 2, 3, 4, 5], runDays: [], sessionMinutes: 60, startDate: '2026-09-14', blockWeeks: 8 }, preferences: { focusAreas: ['glutes'], intensity: 'hard', avoidExerciseIds: [] } }),
  ],
  [
    "the owner: hybrid, gym Monday to Friday with her own split, runs Tuesday, Thursday and Saturday",
    athlete({ body: { sex: 'female', birthDate: '1996-05-14', heightCm: 165, weightKg: 60 }, goals: { primary: 'hypertrophy', secondary: 'endurance', targetRace: '10k' }, experience: { lifting: '1_to_3_years', knowsBigLifts: true, recentRun: { km: 3, minutes: 20 } }, schedule: { gymDays: [1, 2, 3, 4, 5], runDays: [2, 4, 6], longRunDay: 6, splitMode: 'custom', customSplit: { '1': ['quads', 'glutes'], '2': ['chest', 'shoulders', 'triceps'], '3': ['glutes', 'hamstrings'], '4': ['back', 'biceps'], '5': ['quads', 'hamstrings', 'glutes', 'calves'] }, sessionMinutes: 75, startDate: '2026-09-14', blockWeeks: 8 } }),
  ],
]

function weekCredit(plan: GeneratedPlan, week: number): Record<string, number> {
  const credit: Record<string, number> = {}
  for (const day of plan.days) {
    if (day.week !== week || !day.gym) continue
    for (const e of day.gym.exercises) {
      if (e.role === 'power' || e.role === 'mobility') continue
      const def = getExercise(e.exerciseId)
      credit[def.primary] = (credit[def.primary] ?? 0) + e.sets
      for (const s of def.secondary) credit[s] = (credit[s] ?? 0) + SECONDARY_SET_CREDIT * e.sets
    }
  }
  return credit
}

describe.each(ATHLETES)('%s', (_label, answers) => {
  const model: AthleteModel = buildAthleteModel(answers, TODAY)
  const plan = generatePlan(model, { block: 1, seed: 'fixture' })
  const sessions = plan.days.filter((d) => d.gym).map((d) => d.gym!)

  it('gets a session on every gym day and rest elsewhere', () => {
    for (const day of plan.days) {
      const dow = new Date(`${day.date}T12:00:00Z`).getUTCDay() || 7
      expect(day.gym !== undefined, day.date).toBe(model.gymDays.includes(dow))
      if (day.gym) expect(day.gym.exercises.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('never contains a movement their injuries ban, their equipment lacks, or their level cannot do', () => {
    for (const gym of sessions) {
      for (const e of [...gym.exercises, ...(gym.finisher ? [gym.finisher] : [])]) {
        const def = getExercise(e.exerciseId)
        for (const p of def.patterns) expect(model.bannedPatterns.has(p), `${e.exerciseId} loads ${p}`).toBe(false)
        expect(def.equipment.includes(model.equipment), `${e.exerciseId} needs equipment`).toBe(true)
        if (def.bigLift) expect(model.knowsBigLifts).toBe(true)
        expect(model.avoidExerciseIds.includes(e.exerciseId)).toBe(false)
      }
    }
  })

  it('fits every session into the time they have', () => {
    for (const gym of sessions) expect(gym.estimatedMinutes).toBeLessThanOrEqual(model.sessionMinutes)
  })

  it('never plans past what a muscle can recover from, and never past the athlete\'s RPE ceiling', () => {
    for (let week = 1; week <= plan.weeks; week += 1) {
      const credit = weekCredit(plan, week)
      for (const m of MUSCLE_GROUPS) expect(credit[m] ?? 0, `${m} week ${week}`).toBeLessThanOrEqual(VOLUME_LANDMARKS[m].mrv)
    }
    for (const gym of sessions) for (const e of gym.exercises) expect(e.rpeTarget).toBeLessThanOrEqual(model.maxRpe)
  })

  it('carries the signature of the goal', () => {
    const policy = goalPolicy(model.goal)
    const first = sessions[0]!
    if (policy.powerSlot) expect(first.exercises[0]!.role).toBe('power')
    if (policy.mobilitySlot === 'start') expect(first.exercises[0]!.role).toBe('mobility')
    if (policy.mobilitySlot === 'end') expect(first.exercises.at(-1)!.role).toBe('mobility')
    if (policy.finisher) expect(first.finisher).toBeDefined()
    if (policy.tempoWeeks > 0) expect(first.exercises.some((e) => e.technique === 'tempo')).toBe(true)
    if (model.goal === 'strength') expect(first.exercises.find((e) => e.role === 'primary')!.repMax).toBeLessThanOrEqual(5)
    if (model.runDays.length > 0) expect(plan.days.filter((d) => d.run).length).toBeGreaterThan(0)
  })
})
