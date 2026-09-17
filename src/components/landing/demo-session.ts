import { fromISODate, type PlainDate } from '@/domain/dates'
import { buildAthleteModel, type AthleteModel } from '@/domain/profile/athlete'
import { questionnaireSchema } from '@/domain/profile/questionnaire'
import type { ExperienceTier, LiftingExperience, Sex } from '@/domain/profile/types'
import { regenerateGymSession, type GymSession } from '@/domain/plan'
import type { MuscleGroup } from '@/domain/strength/volume'

/**
 * The landing page's live demo runs the real engine in the browser on a
 * stand-in athlete, so what a visitor sees is what the app would build —
 * not a mock. Pure, so the same function is unit tested.
 */
export interface DemoInput {
  focus: readonly MuscleGroup[]
  tier: ExperienceTier
  sessionMinutes: 45 | 60 | 75
  sex: Sex
  today: PlainDate
}

const LIFTING: Record<ExperienceTier, LiftingExperience> = {
  beginner: 'none',
  intermediate: '1_to_3_years',
  advanced: '3_plus_years',
}

export function demoAthlete(input: Pick<DemoInput, 'tier' | 'sessionMinutes' | 'sex' | 'today'>): AthleteModel {
  const answers = questionnaireSchema.parse({
    basics: { displayName: 'Demo', locale: 'es', timezone: 'America/Bogota', units: 'metric' },
    body: { sex: input.sex, birthDate: '1996-05-14', heightCm: 168, weightKg: input.sex === 'male' ? 78 : 62 },
    health: { heartCondition: false, chestPain: false, dizziness: false, jointProblem: false, bloodPressureMedication: false, pregnancy: false, other: false },
    goals: { primary: 'hypertrophy' },
    experience: { lifting: LIFTING[input.tier], knowsBigLifts: input.tier !== 'beginner', continuousRunMinutes: 0 },
    schedule: { gymDays: [1, 3, 5], runDays: [], sessionMinutes: input.sessionMinutes, startDate: '2026-09-14', blockWeeks: 8 },
    equipment: { setting: 'full_gym', unavailableMachines: [] },
    injuries: { areas: [], note: '' },
    preferences: { focusAreas: [], intensity: 'hard', avoidExerciseIds: [] },
  })
  return buildAthleteModel(answers, input.today)
}

export function buildDemoSession(input: DemoInput): GymSession {
  const model = demoAthlete(input)
  return regenerateGymSession(model, {
    focus: input.focus,
    week: 2,
    todaysRun: 'none',
    tomorrowsRun: 'none',
    seed: `landing:${input.tier}:${input.sessionMinutes}:${input.focus.join('+')}`,
  })
}

export const DEMO_TODAY = fromISODate('2026-09-17')
