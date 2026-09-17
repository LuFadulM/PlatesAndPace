import { z } from 'zod'
import { MUSCLE_GROUPS, type MuscleGroup } from '../strength/volume'
import { LEGACY_GOALS, PRIMARY_GOALS, RACE_DISTANCES_KM, SECONDARY_GOALS, normaliseGoal, type PrimaryGoal, type SecondaryGoal } from './types'

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

/**
 * PAR-Q plus two screens of our own. Any yes starts the athlete carefully; a
 * red flag (everything but a joint problem) also gates the plan behind an
 * explicit acknowledgement that a doctor should be consulted first.
 */
export const healthSchema = z.object({
  heartCondition: z.boolean(),
  chestPain: z.boolean(),
  dizziness: z.boolean(),
  jointProblem: z.boolean(),
  bloodPressureMedication: z.boolean(),
  pregnancy: z.boolean(),
  recentSurgery: z.boolean().default(false),
  /** A history of disordered eating: the app never prescribes a deficit. */
  disorderedEating: z.boolean().default(false),
  other: z.boolean(),
  otherNote: z.string().max(500).optional(),
  /** Set by the athlete on the medical screen; required when a red flag is up. */
  medicalAcknowledged: z.boolean().default(false),
})

export type HealthAnswers = z.infer<typeof healthSchema>

export const RED_FLAG_KEYS = ['heartCondition', 'chestPain', 'dizziness', 'bloodPressureMedication', 'pregnancy', 'recentSurgery', 'other'] as const

/** True when the athlete must acknowledge medical advice before a plan is built. */
export function hasRedFlag(health: HealthAnswers): boolean {
  return RED_FLAG_KEYS.some((key) => health[key])
}

const anyGoal = z.enum([...PRIMARY_GOALS, ...LEGACY_GOALS] as [string, ...string[]])

export function involvesRunning(goals: { primary: PrimaryGoal; secondary?: SecondaryGoal }): boolean {
  return goals.primary === 'endurance' || goals.secondary === 'endurance'
}

/**
 * Accepts both vocabularies on the way in and always yields the current one,
 * so answers written by the first version of the questionnaire keep working
 * without a data migration.
 */
export const goalsSchema = z
  .object({
    primary: anyGoal,
    secondary: z.enum(SECONDARY_GOALS as unknown as [SecondaryGoal, ...SecondaryGoal[]]).optional(),
    targetRace: z.enum(['5k', '10k', 'half']).optional(),
    raceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .transform((goals) => {
    const mapped = normaliseGoal(goals.primary)
    const secondary = goals.secondary ?? mapped.secondary
    return {
      primary: mapped.primary,
      secondary: secondary !== undefined && secondary !== mapped.primary ? secondary : undefined,
      targetRace: goals.targetRace,
      raceDate: goals.raceDate,
    }
  })
  .refine((goals) => !involvesRunning(goals) || goals.targetRace !== undefined, {
    message: 'a running goal needs a target distance',
    path: ['targetRace'],
  })

export const experienceSchema = z
  .object({
    lifting: z.enum(['none', 'under_1_year', '1_to_3_years', '3_plus_years']),
    knowsBigLifts: z.boolean(),
    recentRun: z.object({ km: z.number().positive(), minutes: z.number().positive() }).optional(),
    /** For someone who cannot yet run continuously. */
    continuousRunMinutes: z.number().min(0).max(120).optional(),
    /** Optional heart-rate anchors; each unlocks a better zone method. */
    restingHr: z.number().int().min(30).max(120).optional(),
    maxHr: z.number().int().min(120).max(230).optional(),
    lthr: z.number().int().min(100).max(220).optional(),
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
  /** The bar and plate pairs on the rack, in kilograms; absent means a standard set. */
  plates: z
    .object({
      barKg: z.number().min(5).max(30),
      platePairsKg: z.array(z.number().positive().max(50)).min(1).max(12),
    })
    .optional(),
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
