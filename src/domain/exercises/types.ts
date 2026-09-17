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
  /** Explosive work: jumps, swings, push presses. Fast, never to failure. */
  | 'power'
  /** Stretches, holds and pattern drills measured in seconds, not reps. */
  | 'mobility'

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
  /** Prescribed as a timed hold rather than reps. */
  timed?: boolean
}

export type AnimationId =
  | 'squat'
  | 'front_squat'
  | 'goblet_squat'
  | 'hack_squat'
  | 'leg_press'
  | 'leg_extension'
  | 'split_squat'
  | 'step_up'
  | 'lunge'
  | 'hinge'
  | 'deadlift'
  | 'leg_curl'
  | 'nordic'
  | 'hip_thrust'
  | 'bridge'
  | 'kickback'
  | 'abduction'
  | 'calf_raise'
  | 'horizontal_push'
  | 'incline_press'
  | 'seated_press'
  | 'push_up'
  | 'fly'
  | 'fly_lying'
  | 'vertical_push'
  | 'pike_push_up'
  | 'lateral_raise'
  | 'face_pull'
  | 'rear_delt_fly'
  | 'horizontal_pull'
  | 'one_arm_row'
  | 'seated_row'
  | 'lat_pulldown'
  | 'vertical_pull'
  | 'inverted_row'
  | 'superman'
  | 'curl'
  | 'pushdown'
  | 'overhead_extension'
  | 'dip'
  | 'skull_crusher'
  | 'plank'
  | 'side_plank'
  | 'dead_bug'
  | 'knee_raise'
  | 'kneeling_crunch'
  | 'pallof'
  | 'bicycle'
  | 'crunch'
  | 'carry'
  | 'jump'
  | 'burpee'
  | 'mountain_climber'
  | 'jumping_jack'
  | 'swing'
  | 'bike'
  | 'rower'
  | 'cardio'
  | 'extension'
