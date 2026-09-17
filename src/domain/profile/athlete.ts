import { fromISODate, type PlainDate } from '../dates'
import { DEFAULT_PLATES, type PlateInventory } from '../strength/loads'
import type { HeartRateProfile } from '../running/zones'
import type { MuscleGroup } from '../strength/volume'
import {
  ADULT_AGE,
  MINIMUM_AGE,
  anyHealthFlag,
  involvesRunning,
  type QuestionnaireAnswers,
} from './questionnaire'
import {
  ageOn,
  experienceTier,
  type EquipmentSetting,
  type ExperienceTier,
  type FocusArea,
  type InjuryArea,
  type IntensityPreference,
  type LiftingExperience,
  type PrimaryGoal,
  type SecondaryGoal,
  type Sex,
  type Units,
} from './types'

/**
 * Movement patterns rather than exercise names.
 *
 * An injury rules out a way of loading a joint, not a list of exercise ids —
 * so the filter keeps working when the exercise library changes, and a new
 * exercise is covered the moment it declares its patterns.
 */
export type MovementPattern =
  | 'deep_knee_flexion'
  | 'loaded_lunge'
  | 'knee_extension_loaded'
  | 'spinal_loading'
  | 'loaded_hip_hinge'
  | 'overhead_press'
  | 'behind_neck'
  | 'upright_row'
  | 'deep_hip_flexion'
  | 'loaded_wrist_extension'
  | 'neck_loading'

const INJURY_PATTERNS: Record<InjuryArea, readonly MovementPattern[]> = {
  knees: ['deep_knee_flexion', 'loaded_lunge', 'knee_extension_loaded'],
  lower_back: ['spinal_loading', 'loaded_hip_hinge'],
  shoulders: ['overhead_press', 'behind_neck', 'upright_row'],
  hips: ['deep_hip_flexion', 'loaded_lunge'],
  wrists: ['loaded_wrist_extension'],
  neck: ['neck_loading', 'behind_neck'],
}

export interface AthleteModel {
  displayName: string
  locale: 'en' | 'es'
  timezone: string
  units: Units

  sex: Sex
  birthDate: PlainDate
  ageYears: number
  heightCm: number
  weightKg: number

  goal: PrimaryGoal
  goalSecondary?: SecondaryGoal
  /** Running is part of the goal, so run days shape the lifting around them. */
  runsMatter: boolean
  targetRace?: '5k' | '10k' | 'half'
  raceDate?: PlainDate

  experience: LiftingExperience
  tier: ExperienceTier
  knowsBigLifts: boolean
  recentRun?: { km: number; seconds: number }
  continuousRunMinutes?: number
  heartRate: HeartRateProfile

  gymDays: number[]
  runDays: number[]
  longRunDay?: number
  /**
   * Muscle groups per gym day (ISO weekday), when the athlete chose them
   * rather than taking the engine's split. Absent means auto.
   */
  customSplit?: ReadonlyMap<number, readonly MuscleGroup[]>
  sessionMinutes: number
  startDate: PlainDate
  blockWeeks: number

  equipment: EquipmentSetting
  unavailableMachines: string[]
  /** What the barbell can actually be loaded to. */
  plates: PlateInventory

  injuries: InjuryArea[]
  /** Patterns no exercise in this athlete's plan may use. */
  bannedPatterns: Set<MovementPattern>
  injuryNote: string

  focusAreas: FocusArea[]
  intensity: IntensityPreference
  avoidExerciseIds: string[]

  /** Any PAR-Q yes: 15% lighter starts, 20% less volume, clearance notice. */
  conservativeMode: boolean
  needsMedicalClearance: boolean
  isMinor: boolean
  /** Under-18s and careful starts never train to a true maximum. */
  maxRpe: number
  allowCalorieDeficit: boolean
  /** Why a deficit is off, when it is, so the UI can say so. */
  deficitBlockedBy?: 'minor' | 'medical' | 'disordered_eating'
}

export class UnderageError extends RangeError {
  constructor(age: number) {
    super(`Plates & Pace is for athletes aged ${MINIMUM_AGE} and over; this one is ${age}`)
    this.name = 'UnderageError'
  }
}

/**
 * Normalises questionnaire answers into the single shape the engine reads.
 *
 * `today` is passed in rather than read from the clock so that age — and every
 * guard that depends on it — is computed in the athlete's own time zone by the
 * caller, and so the result is testable.
 */
export function buildAthleteModel(
  answers: QuestionnaireAnswers,
  today: PlainDate,
): AthleteModel {
  const birthDate = fromISODate(answers.body.birthDate)
  const ageYears = ageOn(birthDate, today)

  if (ageYears < MINIMUM_AGE) throw new UnderageError(ageYears)

  const needsMedicalClearance = anyHealthFlag(answers.health)
  const isMinor = ageYears < ADULT_AGE

  const bannedPatterns = new Set<MovementPattern>()
  for (const area of answers.injuries.areas) {
    for (const pattern of INJURY_PATTERNS[area]) bannedPatterns.add(pattern)
  }

  const customSplit =
    answers.schedule.splitMode === 'custom'
      ? new Map(
          answers.schedule.gymDays.map((day) => [day, answers.schedule.customSplit[String(day)] ?? []] as const),
        )
      : undefined

  const recentRun = answers.experience.recentRun
    ? { km: answers.experience.recentRun.km, seconds: answers.experience.recentRun.minutes * 60 }
    : undefined

  // A history of disordered eating turns a fat-loss goal into recomposition:
  // the same training, food at maintenance, and no number to chase down.
  const disorderedEating = answers.health.disorderedEating
  const goal: PrimaryGoal = disorderedEating && answers.goals.primary === 'fat_loss' ? 'recomposition' : answers.goals.primary
  const deficitBlockedBy = isMinor ? 'minor' : needsMedicalClearance ? 'medical' : disorderedEating ? 'disordered_eating' : undefined

  return {
    displayName: answers.basics.displayName,
    locale: answers.basics.locale,
    timezone: answers.basics.timezone,
    units: answers.basics.units,

    sex: answers.body.sex,
    birthDate,
    ageYears,
    heightCm: answers.body.heightCm,
    weightKg: answers.body.weightKg,

    goal,
    goalSecondary: answers.goals.secondary,
    runsMatter: involvesRunning(answers.goals),
    targetRace: answers.goals.targetRace,
    raceDate: answers.goals.raceDate ? fromISODate(answers.goals.raceDate) : undefined,

    experience: answers.experience.lifting,
    tier: experienceTier(answers.experience.lifting),
    knowsBigLifts: answers.experience.knowsBigLifts,
    recentRun,
    continuousRunMinutes: answers.experience.continuousRunMinutes,
    heartRate: { restingHr: answers.experience.restingHr, maxHr: answers.experience.maxHr, lthr: answers.experience.lthr },

    gymDays: [...answers.schedule.gymDays].sort((a, b) => a - b),
    runDays: [...answers.schedule.runDays].sort((a, b) => a - b),
    longRunDay: answers.schedule.longRunDay,
    customSplit,
    sessionMinutes: answers.schedule.sessionMinutes,
    startDate: fromISODate(answers.schedule.startDate),
    blockWeeks: answers.schedule.blockWeeks,

    equipment: answers.equipment.setting,
    unavailableMachines: answers.equipment.unavailableMachines,
    plates: answers.equipment.plates ?? DEFAULT_PLATES[answers.basics.units],

    injuries: answers.injuries.areas,
    bannedPatterns,
    injuryNote: answers.injuries.note,

    focusAreas: answers.preferences.focusAreas,
    intensity: answers.preferences.intensity,
    avoidExerciseIds: answers.preferences.avoidExerciseIds,

    conservativeMode: needsMedicalClearance,
    needsMedicalClearance,
    isMinor,
    // A minor or a flagged athlete never goes to a true maximum, whatever
    // intensity they asked for.
    maxRpe: isMinor || needsMedicalClearance ? 8 : 10,
    allowCalorieDeficit: deficitBlockedBy === undefined,
    deficitBlockedBy,
  }
}

export function patternsForInjury(area: InjuryArea): readonly MovementPattern[] {
  return INJURY_PATTERNS[area]
}
