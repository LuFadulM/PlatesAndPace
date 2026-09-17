import { z } from 'zod'
import { MUSCLE_GROUPS, type MuscleGroup } from '../strength/volume'
import { RACE_DISTANCES_KM } from './types'

/**
 * The nine onboarding steps (PLAN.md §2), as one schema per step.
 *
 * These are the contract between the form and the engine, and they are stored
 * verbatim in `questionnaire_answers.answers`, so they are validated in exactly
 * one place and reused on both the client and the server.
 */

export const MINIMUM_AGE = 16
export const ADULT_AGE = 18

export const basicsSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  locale: z.enum(['en', 'es']),
  timezone: z.string().min(1),
  units: z.enum(['metric', 'imperial']),
})

export const bodySchema = z.object({
  sex: z.enum(['female', 'male', 'unspecified']),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Always stored metric; the form converts on the way in. */
  heightCm: z.number().min(100).max(260),
  weightKg: z.number().min(25).max(400),
  waistCm: z.number().min(40).max(250).optional(),
})

/** PAR-Q. Any yes triggers the medical-clearance notice and a careful start. */
export const healthSchema = z.object({
  heartCondition: z.boolean(),
  chestPain: z.boolean(),
  dizziness: z.boolean(),
  jointProblem: z.boolean(),
  bloodPressureMedication: z.boolean(),
  pregnancy: z.boolean(),
  other: z.boolean(),
  otherNote: z.string().max(500).optional(),
})

export const goalsSchema = z
  .object({
    primary: z.enum([
      'build_muscle',
      'get_strong',
      'lose_fat',
      'fit_and_firm',
      'run_faster',
      'hybrid',
    ]),
    targetRace: z.enum(['5k', '10k', 'half']).optional(),
    raceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine(
    (goals) => goals.primary !== 'run_faster' || goals.targetRace !== undefined,
    { message: 'a running goal needs a target distance', path: ['targetRace'] },
  )

export const experienceSchema = z
  .object({
    lifting: z.enum(['none', 'under_1_year', '1_to_3_years', '3_plus_years']),
    knowsBigLifts: z.boolean(),
    recentRun: z.object({ km: z.number().positive(), minutes: z.number().positive() }).optional(),
    /** For someone who cannot yet run continuously. */
    continuousRunMinutes: z.number().min(0).max(120).optional(),
  })
  .refine(
    (experience) =>
      experience.recentRun !== undefined || experience.continuousRunMinutes !== undefined,
    { message: 'give a recent run or how long you can run continuously', path: ['recentRun'] },
  )

/** ISO weekdays, 1 = Monday. */
const weekday = z.number().int().min(1).max(7)

const muscleGroup = z.enum(MUSCLE_GROUPS as unknown as [MuscleGroup, ...MuscleGroup[]])

export const scheduleSchema = z
  .object({
    gymDays: z.array(weekday).min(2).max(6),
    runDays: z.array(weekday).max(7),
    longRunDay: weekday.optional(),
    /**
     * `auto` lets the engine pick the split for the day count. `custom` means
     * the athlete named the muscle groups for each gym day themselves, keyed
     * by ISO weekday as a string because the answers are stored as JSON.
     */
    splitMode: z.enum(['auto', 'custom']).default('auto'),
    customSplit: z.record(z.string(), z.array(muscleGroup).min(1).max(6)).default({}),
    sessionMinutes: z.union([
      z.literal(30),
      z.literal(45),
      z.literal(60),
      z.literal(75),
      z.literal(90),
    ]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    blockWeeks: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(12)]).default(8),
  })
  .refine((schedule) => new Set(schedule.gymDays).size === schedule.gymDays.length, {
    message: 'a gym day cannot be listed twice',
    path: ['gymDays'],
  })
  .refine(
    (schedule) => schedule.longRunDay === undefined || schedule.runDays.includes(schedule.longRunDay),
    { message: 'the long run has to fall on a run day', path: ['longRunDay'] },
  )
  .refine(
    (schedule) =>
      schedule.splitMode !== 'custom' ||
      schedule.gymDays.every((day) => (schedule.customSplit[String(day)]?.length ?? 0) > 0),
    { message: 'every gym day needs at least one muscle group', path: ['customSplit'] },
  )

export const equipmentSchema = z.object({
  setting: z.enum(['full_gym', 'dumbbells_bench', 'home_none']),
  unavailableMachines: z.array(z.string()).default([]),
})

export const injuriesSchema = z.object({
  areas: z.array(z.enum(['knees', 'lower_back', 'shoulders', 'hips', 'wrists', 'neck'])).default([]),
  note: z.string().max(500).default(''),
})

export const preferencesSchema = z.object({
  focusAreas: z
    .array(z.enum(['glutes', 'legs', 'arms', 'shoulders', 'back', 'chest', 'abs']))
    .default([]),
  intensity: z.enum(['moderate', 'hard', 'very_hard']),
  avoidExerciseIds: z.array(z.string()).default([]),
})

export const questionnaireSchema = z.object({
  basics: basicsSchema,
  body: bodySchema,
  health: healthSchema,
  goals: goalsSchema,
  experience: experienceSchema,
  schedule: scheduleSchema,
  equipment: equipmentSchema,
  injuries: injuriesSchema,
  preferences: preferencesSchema,
})

export type QuestionnaireAnswers = z.infer<typeof questionnaireSchema>

/** The steps in order, for the progress bar and for resuming part-way through. */
export const QUESTIONNAIRE_STEPS = [
  'basics',
  'body',
  'health',
  'goals',
  'experience',
  'schedule',
  'equipment',
  'injuries',
  'preferences',
] as const

export type QuestionnaireStep = (typeof QUESTIONNAIRE_STEPS)[number]

export const STEP_SCHEMAS = {
  basics: basicsSchema,
  body: bodySchema,
  health: healthSchema,
  goals: goalsSchema,
  experience: experienceSchema,
  schedule: scheduleSchema,
  equipment: equipmentSchema,
  injuries: injuriesSchema,
  preferences: preferencesSchema,
} as const

export function anyHealthFlag(health: z.infer<typeof healthSchema>): boolean {
  return (
    health.heartCondition ||
    health.chestPain ||
    health.dizziness ||
    health.jointProblem ||
    health.bloodPressureMedication ||
    health.pregnancy ||
    health.other
  )
}

/** Unit conversions for the form; everything downstream is metric. */
export const LB_TO_KG = 0.45359237
export const IN_TO_CM = 2.54

export function toKg(pounds: number): number {
  return pounds * LB_TO_KG
}

export function toCm(inches: number): number {
  return inches * IN_TO_CM
}

export function raceDistanceKm(race: keyof typeof RACE_DISTANCES_KM): number {
  return RACE_DISTANCES_KM[race]
}
