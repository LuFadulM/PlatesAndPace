import type { MovementPattern } from '../profile/athlete'
import type { EquipmentSetting, ExperienceTier } from '../profile/types'
import type { BodyRegion, Implement } from '../strength/loads'
import type { MuscleGroup } from '../strength/volume'

/**
 * One entry in the exercise library.
 *
 * Names, cues and common mistakes are not here: they live in
 * messages/{en,es}.json under `exercises.<id>`, so the library carries only
 * what the engine reasons about and the catalogues carry what the athlete
 * reads. A missing translation fails the build; a missing ratio fails a test.
 */
export type ExerciseCategory =
  | 'compound'
  | 'accessory'
  | 'isolation'
  | 'core'
  | 'conditioning'

export interface ExerciseDefinition {
  id: string
  primary: MuscleGroup
  secondary: readonly MuscleGroup[]
  region: BodyRegion
  implement: Implement
  /** Settings in which the exercise is available at all. */
  equipment: readonly EquipmentSetting[]
  /** Ways this exercise loads a joint; intersected with the athlete's bans. */
  patterns: readonly MovementPattern[]
  /** Reference working load as a fraction of bodyweight (male, intermediate). */
  strengthRatio: number
  minTier: ExperienceTier
  /** Barbell squat, deadlift and bench: only offered when the athlete says they know the technique. */
  bigLift?: boolean
  category: ExerciseCategory
  /** Ties the exercise to a specific machine an athlete can mark unavailable. */
  machineId?: string
  /** Which figure animation to show. */
  animation: AnimationId
  /** Whether both sides are worked one at a time, doubling the set's duration. */
  unilateral?: boolean
}

export type AnimationId =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'curl'
  | 'extension'
  | 'lateral_raise'
  | 'hip_thrust'
  | 'plank'
  | 'crunch'
  | 'calf_raise'
  | 'carry'
  | 'jump'
  | 'cardio'
