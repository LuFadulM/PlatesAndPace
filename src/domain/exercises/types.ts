import type { MovementPattern } from '../profile/athlete'
import type { EquipmentSetting, ExperienceTier } from '../profile/types'
import type { BodyRegion, Implement } from '../strength/loads'
import type { MuscleGroup } from '../strength/volume'

/**
 * One entry in the exercise library.
 *
 * Names, aliases, steps, cues and common mistakes are not here: they live in
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

/** How the body moves: the axis the substitution graph is built on. */
export type Movement =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'carry'
  | 'rotation'
  | 'anti_rotation'
  | 'anti_extension'
  | 'anti_lateral_flexion'
  | 'gait'
  | 'isolation'

export const MOVEMENTS: readonly Movement[] = [
  'squat',
  'hinge',
  'lunge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'carry',
  'rotation',
  'anti_rotation',
  'anti_extension',
  'anti_lateral_flexion',
  'gait',
  'isolation',
]

export type ForceVector = 'push' | 'pull' | 'static'

export type Plane = 'sagittal' | 'frontal' | 'transverse' | 'multi'

/** What the athlete is after with the movement: the "Objetivo" filter axis. */
export type Purpose = 'strengthen' | 'stabilise' | 'mobilise' | 'cardio' | 'nervous_system'

export const PURPOSES: readonly Purpose[] = ['strengthen', 'stabilise', 'mobilise', 'cardio', 'nervous_system']

/** The "Tipo" filter axis. */
export type ExerciseType = 'training' | 'warmup' | 'rehab' | 'stretch'

export const EXERCISE_TYPES: readonly ExerciseType[] = ['training', 'warmup', 'rehab', 'stretch']

/** The "Material" filter axis: what the movement is done with. */
export type Material =
  | 'bodyweight'
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'cable'
  | 'band'
  | 'bench'
  | 'box'
  | 'medicine_ball'
  | 'stability_ball'
  | 'suspension'
  | 'bar'
  | 'other'

export const MATERIALS: readonly Material[] = [
  'bodyweight',
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'band',
  'bench',
  'box',
  'medicine_ball',
  'stability_ball',
  'suspension',
  'bar',
  'other',
]

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

/** How much growth a movement buys per unit of fatigue; drives selection when the athlete is run down. */
export type StimulusToFatigue = 'low' | 'moderate' | 'high'

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

  // --- Library v2 -------------------------------------------------------
  movement: Movement
  force: ForceVector
  plane: Plane
  purpose: Purpose
  type: ExerciseType
  /** Extra material beyond the implement: a bench, a box, a band. */
  materials?: readonly Material[]
  sfr: StimulusToFatigue
  /** Four digits: eccentric, pause, concentric, pause, in seconds ("3010"); "X" for explosive work, "hold" for isometrics. */
  tempo: string
  breathing: 'brace' | 'exhale_effort' | 'continuous' | 'slow'
  /** Easier movements of the same pattern, easiest first. */
  regressions?: readonly string[]
  /** Harder movements of the same pattern, next step first. */
  progressions?: readonly string[]
  /** Photo set in the open catalogue, when a matching row exists. */
  mediaId?: string
}

/** Difficulty is the experience floor, read as a label. */
export function difficultyOf(exercise: Pick<ExerciseDefinition, 'minTier'>): Difficulty {
  return exercise.minTier
}

/** The material axis: the implement, plus whatever else the movement needs. */
export function materialsOf(exercise: Pick<ExerciseDefinition, 'implement' | 'materials' | 'machineId'>): Material[] {
  const base: Material = exercise.implement === 'bodyweight' ? 'bodyweight' : exercise.implement
  return [...new Set<Material>([base, ...(exercise.materials ?? [])])]
}

export function isCompound(exercise: Pick<ExerciseDefinition, 'category'>): boolean {
  return exercise.category === 'compound' || exercise.category === 'power'
}

export function isLoadable(exercise: Pick<ExerciseDefinition, 'implement' | 'timed' | 'category'>): boolean {
  return exercise.implement !== 'bodyweight' && !exercise.timed && exercise.category !== 'conditioning'
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
