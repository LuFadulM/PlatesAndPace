import type { ExerciseDefinition } from './types'

const ALL = ['full_gym', 'dumbbells_bench', 'home_none'] as const
const GYM = ['full_gym'] as const
const GYM_DB = ['full_gym', 'dumbbells_bench'] as const

/**
 * The exercise library.
 *
 * Authored for Plates & Pace rather than ported from the prototype, which was
 * not available. Ratios are reference working loads for a male intermediate
 * lifter as a fraction of bodyweight; sex and experience factors are applied
 * by the load engine. Dumbbell ratios are per hand.
 */
export const EXERCISES: readonly ExerciseDefinition[] = [
  // ------------------------------------------------------------ quads --
  { id: 'back_squat', primary: 'quads', secondary: ['glutes'], region: 'lower', implement: 'barbell', equipment: GYM, patterns: ['deep_knee_flexion', 'spinal_loading'], strengthRatio: 1.0, minTier: 'intermediate', bigLift: true, category: 'compound', animation: 'squat' },
  { id: 'front_squat', primary: 'quads', secondary: ['abs'], region: 'lower', implement: 'barbell', equipment: GYM, patterns: ['deep_knee_flexion', 'spinal_loading', 'loaded_wrist_extension'], strengthRatio: 0.8, minTier: 'advanced', bigLift: true, category: 'compound', animation: 'front_squat' },
  { id: 'goblet_squat', primary: 'quads', secondary: ['glutes'], region: 'lower', implement: 'dumbbell', equipment: GYM_DB, patterns: ['deep_knee_flexion'], strengthRatio: 0.35, minTier: 'beginner', category: 'compound', animation: 'goblet_squat' },
  { id: 'leg_press', primary: 'quads', secondary: ['glutes'], region: 'lower', implement: 'machine', equipment: GYM, patterns: ['deep_knee_flexion'], strengthRatio: 1.8, minTier: 'beginner', category: 'compound', machineId: 'leg_press', animation: 'leg_press' },
  { id: 'hack_squat', primary: 'quads', secondary: ['glutes'], region: 'lower', implement: 'machine', equipment: GYM, patterns: ['deep_knee_flexion'], strengthRatio: 1.0, minTier: 'intermediate', category: 'compound', machineId: 'hack_squat', animation: 'hack_squat' },
  { id: 'bulgarian_split_squat', primary: 'quads', secondary: ['glutes'], region: 'lower', implement: 'dumbbell', equipment: GYM_DB, patterns: ['loaded_lunge', 'deep_knee_flexion'], strengthRatio: 0.25, minTier: 'intermediate', category: 'compound', animation: 'split_squat', unilateral: true },
  { id: 'walking_lunge', primary: 'quads', secondary: ['glutes'], region: 'lower', implement: 'dumbbell', equipment: GYM_DB, patterns: ['loaded_lunge'], strengthRatio: 0.2, minTier: 'beginner', category: 'accessory', animation: 'lunge', unilateral: true },
  { id: 'step_up', primary: 'quads', secondary: ['glutes'], region: 'lower', implement: 'dumbbell', equipment: GYM_DB, patterns: ['loaded_lunge'], strengthRatio: 0.2, minTier: 'beginner', category: 'accessory', animation: 'step_up', unilateral: true },
  { id: 'bodyweight_squat', primary: 'quads', secondary: ['glutes'], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: ['deep_knee_flexion'], strengthRatio: 0, minTier: 'beginner', category: 'compound', animation: 'squat' },
  { id: 'reverse_lunge', primary: 'quads', secondary: ['glutes'], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: ['loaded_lunge', 'deep_knee_flexion'], strengthRatio: 0, minTier: 'beginner', category: 'accessory', animation: 'lunge', unilateral: true },
  { id: 'leg_extension', primary: 'quads', secondary: [], region: 'lower', implement: 'machine', equipment: GYM, patterns: ['knee_extension_loaded'], strengthRatio: 0.5, minTier: 'beginner', category: 'isolation', machineId: 'leg_extension', animation: 'leg_extension' },

  // ------------------------------------------------ hamstrings / hinge --
  { id: 'conventional_deadlift', primary: 'hamstrings', secondary: ['glutes', 'back'], region: 'lower', implement: 'barbell', equipment: GYM, patterns: ['loaded_hip_hinge', 'spinal_loading'], strengthRatio: 1.2, minTier: 'intermediate', bigLift: true, category: 'compound', animation: 'deadlift' },
  { id: 'romanian_deadlift', primary: 'hamstrings', secondary: ['glutes'], region: 'lower', implement: 'barbell', equipment: GYM, patterns: ['loaded_hip_hinge'], strengthRatio: 0.8, minTier: 'intermediate', category: 'compound', animation: 'hinge' },
  { id: 'dumbbell_rdl', primary: 'hamstrings', secondary: ['glutes'], region: 'lower', implement: 'dumbbell', equipment: GYM_DB, patterns: ['loaded_hip_hinge'], strengthRatio: 0.3, minTier: 'beginner', category: 'compound', animation: 'hinge' },
  { id: 'leg_curl', primary: 'hamstrings', secondary: [], region: 'lower', implement: 'machine', equipment: GYM, patterns: [], strengthRatio: 0.4, minTier: 'beginner', category: 'isolation', machineId: 'leg_curl', animation: 'leg_curl' },
  { id: 'nordic_curl', primary: 'hamstrings', secondary: [], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'advanced', category: 'accessory', animation: 'nordic' },

  // ----------------------------------------------------------- glutes --
  { id: 'hip_thrust', primary: 'glutes', secondary: ['hamstrings'], region: 'lower', implement: 'barbell', equipment: GYM, patterns: [], strengthRatio: 1.0, minTier: 'beginner', category: 'compound', animation: 'hip_thrust' },
  { id: 'dumbbell_hip_thrust', primary: 'glutes', secondary: ['hamstrings'], region: 'lower', implement: 'dumbbell', equipment: GYM_DB, patterns: [], strengthRatio: 0.4, minTier: 'beginner', category: 'compound', animation: 'hip_thrust' },
  { id: 'glute_bridge', primary: 'glutes', secondary: ['hamstrings'], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'accessory', animation: 'bridge' },
  { id: 'cable_kickback', primary: 'glutes', secondary: [], region: 'lower', implement: 'cable', equipment: GYM, patterns: [], strengthRatio: 0.15, minTier: 'beginner', category: 'isolation', animation: 'kickback', unilateral: true },
  { id: 'hip_abduction', primary: 'glutes', secondary: [], region: 'lower', implement: 'machine', equipment: GYM, patterns: [], strengthRatio: 0.5, minTier: 'beginner', category: 'isolation', machineId: 'hip_abduction', animation: 'abduction' },
  { id: 'single_leg_glute_bridge', primary: 'glutes', secondary: ['hamstrings'], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'accessory', animation: 'bridge', unilateral: true },

  // ----------------------------------------------------------- calves --
  { id: 'standing_calf_raise', primary: 'calves', secondary: [], region: 'lower', implement: 'machine', equipment: GYM, patterns: [], strengthRatio: 1.0, minTier: 'beginner', category: 'isolation', machineId: 'calf_raise', animation: 'calf_raise' },
  { id: 'dumbbell_calf_raise', primary: 'calves', secondary: [], region: 'lower', implement: 'dumbbell', equipment: GYM_DB, patterns: [], strengthRatio: 0.3, minTier: 'beginner', category: 'isolation', animation: 'calf_raise' },
  { id: 'bodyweight_calf_raise', primary: 'calves', secondary: [], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'isolation', animation: 'calf_raise' },

  // ------------------------------------------------------------ chest --
  { id: 'bench_press', primary: 'chest', secondary: ['triceps', 'shoulders'], region: 'upper', implement: 'barbell', equipment: GYM, patterns: [], strengthRatio: 0.75, minTier: 'intermediate', bigLift: true, category: 'compound', animation: 'horizontal_push' },
  { id: 'dumbbell_bench_press', primary: 'chest', secondary: ['triceps'], region: 'upper', implement: 'dumbbell', equipment: GYM_DB, patterns: [], strengthRatio: 0.3, minTier: 'beginner', category: 'compound', animation: 'horizontal_push' },
  { id: 'incline_dumbbell_press', primary: 'chest', secondary: ['shoulders'], region: 'upper', implement: 'dumbbell', equipment: GYM_DB, patterns: [], strengthRatio: 0.25, minTier: 'beginner', category: 'compound', animation: 'incline_press' },
  { id: 'chest_press_machine', primary: 'chest', secondary: ['triceps'], region: 'upper', implement: 'machine', equipment: GYM, patterns: [], strengthRatio: 0.7, minTier: 'beginner', category: 'compound', machineId: 'chest_press', animation: 'seated_press' },
  { id: 'push_up', primary: 'chest', secondary: ['triceps'], region: 'upper', implement: 'bodyweight', equipment: ALL, patterns: ['loaded_wrist_extension'], strengthRatio: 0, minTier: 'beginner', category: 'compound', animation: 'push_up' },
  { id: 'cable_fly', primary: 'chest', secondary: [], region: 'upper', implement: 'cable', equipment: GYM, patterns: [], strengthRatio: 0.15, minTier: 'beginner', category: 'isolation', animation: 'fly' },
  { id: 'dumbbell_fly', primary: 'chest', secondary: [], region: 'upper', implement: 'dumbbell', equipment: GYM_DB, patterns: [], strengthRatio: 0.12, minTier: 'beginner', category: 'isolation', animation: 'fly_lying' },

  // -------------------------------------------------------- shoulders --
  { id: 'overhead_press', primary: 'shoulders', secondary: ['triceps'], region: 'upper', implement: 'barbell', equipment: GYM, patterns: ['overhead_press'], strengthRatio: 0.5, minTier: 'intermediate', category: 'compound', animation: 'vertical_push' },
  { id: 'dumbbell_shoulder_press', primary: 'shoulders', secondary: ['triceps'], region: 'upper', implement: 'dumbbell', equipment: GYM_DB, patterns: ['overhead_press'], strengthRatio: 0.2, minTier: 'beginner', category: 'compound', animation: 'vertical_push' },
  { id: 'machine_shoulder_press', primary: 'shoulders', secondary: ['triceps'], region: 'upper', implement: 'machine', equipment: GYM, patterns: ['overhead_press'], strengthRatio: 0.5, minTier: 'beginner', category: 'compound', machineId: 'shoulder_press', animation: 'vertical_push' },
  { id: 'pike_push_up', primary: 'shoulders', secondary: ['triceps'], region: 'upper', implement: 'bodyweight', equipment: ALL, patterns: ['overhead_press', 'loaded_wrist_extension'], strengthRatio: 0, minTier: 'beginner', category: 'compound', animation: 'pike_push_up' },
  { id: 'lateral_raise', primary: 'shoulders', secondary: [], region: 'upper', implement: 'dumbbell', equipment: GYM_DB, patterns: [], strengthRatio: 0.08, minTier: 'beginner', category: 'isolation', animation: 'lateral_raise' },
  { id: 'face_pull', primary: 'shoulders', secondary: ['back'], region: 'upper', implement: 'cable', equipment: GYM, patterns: [], strengthRatio: 0.2, minTier: 'beginner', category: 'isolation', animation: 'face_pull' },
  { id: 'rear_delt_fly', primary: 'shoulders', secondary: ['back'], region: 'upper', implement: 'dumbbell', equipment: GYM_DB, patterns: [], strengthRatio: 0.08, minTier: 'beginner', category: 'isolation', animation: 'rear_delt_fly' },

  // ------------------------------------------------------------- back --
  { id: 'barbell_row', primary: 'back', secondary: ['biceps'], region: 'upper', implement: 'barbell', equipment: GYM, patterns: ['loaded_hip_hinge', 'spinal_loading'], strengthRatio: 0.6, minTier: 'intermediate', category: 'compound', animation: 'horizontal_pull' },
  { id: 'dumbbell_row', primary: 'back', secondary: ['biceps'], region: 'upper', implement: 'dumbbell', equipment: GYM_DB, patterns: [], strengthRatio: 0.3, minTier: 'beginner', category: 'compound', animation: 'one_arm_row', unilateral: true },
  { id: 'chest_supported_row', primary: 'back', secondary: ['biceps'], region: 'upper', implement: 'machine', equipment: GYM, patterns: [], strengthRatio: 0.6, minTier: 'beginner', category: 'compound', machineId: 'chest_supported_row', animation: 'seated_row' },
  { id: 'seated_cable_row', primary: 'back', secondary: ['biceps'], region: 'upper', implement: 'cable', equipment: GYM, patterns: [], strengthRatio: 0.6, minTier: 'beginner', category: 'compound', animation: 'seated_row' },
  { id: 'lat_pulldown', primary: 'back', secondary: ['biceps'], region: 'upper', implement: 'machine', equipment: GYM, patterns: [], strengthRatio: 0.6, minTier: 'beginner', category: 'compound', machineId: 'lat_pulldown', animation: 'lat_pulldown' },
  { id: 'pull_up', primary: 'back', secondary: ['biceps'], region: 'upper', implement: 'bodyweight', equipment: GYM, patterns: [], strengthRatio: 0, minTier: 'advanced', category: 'compound', animation: 'vertical_pull' },
  { id: 'inverted_row', primary: 'back', secondary: ['biceps'], region: 'upper', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'compound', animation: 'inverted_row' },
  { id: 'superman', primary: 'back', secondary: ['glutes'], region: 'core', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'accessory', animation: 'superman' },

  // ------------------------------------------------------------- arms --
  { id: 'dumbbell_curl', primary: 'biceps', secondary: [], region: 'upper', implement: 'dumbbell', equipment: GYM_DB, patterns: [], strengthRatio: 0.12, minTier: 'beginner', category: 'isolation', animation: 'curl' },
  { id: 'hammer_curl', primary: 'biceps', secondary: [], region: 'upper', implement: 'dumbbell', equipment: GYM_DB, patterns: [], strengthRatio: 0.12, minTier: 'beginner', category: 'isolation', animation: 'curl' },
  { id: 'cable_curl', primary: 'biceps', secondary: [], region: 'upper', implement: 'cable', equipment: GYM, patterns: [], strengthRatio: 0.25, minTier: 'beginner', category: 'isolation', animation: 'curl' },
  { id: 'barbell_curl', primary: 'biceps', secondary: [], region: 'upper', implement: 'barbell', equipment: GYM, patterns: [], strengthRatio: 0.3, minTier: 'intermediate', category: 'isolation', animation: 'curl' },
  { id: 'triceps_pushdown', primary: 'triceps', secondary: [], region: 'upper', implement: 'cable', equipment: GYM, patterns: [], strengthRatio: 0.3, minTier: 'beginner', category: 'isolation', animation: 'pushdown' },
  { id: 'overhead_triceps_extension', primary: 'triceps', secondary: [], region: 'upper', implement: 'dumbbell', equipment: GYM_DB, patterns: ['overhead_press'], strengthRatio: 0.15, minTier: 'beginner', category: 'isolation', animation: 'overhead_extension' },
  { id: 'bench_dip', primary: 'triceps', secondary: ['chest'], region: 'upper', implement: 'bodyweight', equipment: ALL, patterns: ['loaded_wrist_extension'], strengthRatio: 0, minTier: 'beginner', category: 'accessory', animation: 'dip' },
  { id: 'skull_crusher', primary: 'triceps', secondary: [], region: 'upper', implement: 'dumbbell', equipment: GYM_DB, patterns: [], strengthRatio: 0.12, minTier: 'intermediate', category: 'isolation', animation: 'skull_crusher' },

  // ------------------------------------------------------------- core --
  { id: 'plank', primary: 'abs', secondary: [], region: 'core', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'core', animation: 'plank' },
  { id: 'side_plank', primary: 'abs', secondary: [], region: 'core', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'core', animation: 'side_plank', unilateral: true },
  { id: 'dead_bug', primary: 'abs', secondary: [], region: 'core', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'core', animation: 'dead_bug' },
  { id: 'hanging_knee_raise', primary: 'abs', secondary: [], region: 'core', implement: 'bodyweight', equipment: GYM, patterns: ['deep_hip_flexion'], strengthRatio: 0, minTier: 'intermediate', category: 'core', animation: 'knee_raise' },
  { id: 'cable_crunch', primary: 'abs', secondary: [], region: 'core', implement: 'cable', equipment: GYM, patterns: [], strengthRatio: 0.3, minTier: 'beginner', category: 'core', animation: 'kneeling_crunch' },
  { id: 'pallof_press', primary: 'abs', secondary: [], region: 'core', implement: 'cable', equipment: GYM, patterns: [], strengthRatio: 0.15, minTier: 'beginner', category: 'core', animation: 'pallof', unilateral: true },
  { id: 'bicycle_crunch', primary: 'abs', secondary: [], region: 'core', implement: 'bodyweight', equipment: ALL, patterns: ['neck_loading'], strengthRatio: 0, minTier: 'beginner', category: 'core', animation: 'bicycle' },

  // ----------------------------------------------------- conditioning --
  { id: 'burpee', primary: 'quads', secondary: ['chest', 'abs'], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: ['loaded_wrist_extension', 'deep_knee_flexion'], strengthRatio: 0, minTier: 'beginner', category: 'conditioning', animation: 'burpee' },
  { id: 'jump_squat', primary: 'quads', secondary: ['glutes', 'calves'], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: ['deep_knee_flexion'], strengthRatio: 0, minTier: 'beginner', category: 'conditioning', animation: 'jump' },
  { id: 'mountain_climber', primary: 'abs', secondary: ['quads'], region: 'core', implement: 'bodyweight', equipment: ALL, patterns: ['loaded_wrist_extension', 'deep_hip_flexion'], strengthRatio: 0, minTier: 'beginner', category: 'conditioning', animation: 'mountain_climber' },
  { id: 'jumping_jack', primary: 'calves', secondary: ['shoulders'], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'conditioning', animation: 'jumping_jack' },
  { id: 'farmers_carry', primary: 'abs', secondary: ['back', 'shoulders'], region: 'core', implement: 'dumbbell', equipment: GYM_DB, patterns: [], strengthRatio: 0.4, minTier: 'beginner', category: 'conditioning', animation: 'carry' },
  { id: 'dumbbell_swing', primary: 'glutes', secondary: ['hamstrings', 'back'], region: 'lower', implement: 'dumbbell', equipment: GYM_DB, patterns: ['loaded_hip_hinge'], strengthRatio: 0.25, minTier: 'beginner', category: 'conditioning', animation: 'swing' },
  { id: 'bike_intervals', primary: 'quads', secondary: ['calves'], region: 'lower', implement: 'machine', equipment: GYM, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'conditioning', machineId: 'bike', animation: 'bike' },
  { id: 'rower_intervals', primary: 'back', secondary: ['quads', 'glutes'], region: 'core', implement: 'machine', equipment: GYM, patterns: ['loaded_hip_hinge'], strengthRatio: 0, minTier: 'beginner', category: 'conditioning', machineId: 'rower', animation: 'rower' },
  // ------------------------------------------------------------- power --
  { id: 'box_jump', primary: 'quads', secondary: ['glutes', 'calves'], region: 'lower', implement: 'bodyweight', equipment: GYM_DB, patterns: ['deep_knee_flexion'], strengthRatio: 0, minTier: 'beginner', category: 'power', animation: 'jump' },
  { id: 'broad_jump', primary: 'glutes', secondary: ['quads', 'hamstrings'], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: ['deep_knee_flexion'], strengthRatio: 0, minTier: 'beginner', category: 'power', animation: 'jump' },
  { id: 'push_press', primary: 'shoulders', secondary: ['triceps', 'quads'], region: 'upper', implement: 'barbell', equipment: GYM, patterns: ['overhead_press', 'spinal_loading'], strengthRatio: 0.6, minTier: 'intermediate', category: 'power', animation: 'vertical_push' },
  { id: 'dumbbell_push_press', primary: 'shoulders', secondary: ['triceps', 'quads'], region: 'upper', implement: 'dumbbell', equipment: GYM_DB, patterns: ['overhead_press'], strengthRatio: 0.2, minTier: 'beginner', category: 'power', animation: 'vertical_push' },
  { id: 'kettlebell_swing', primary: 'glutes', secondary: ['hamstrings', 'back'], region: 'lower', implement: 'dumbbell', equipment: GYM_DB, patterns: ['loaded_hip_hinge'], strengthRatio: 0.3, minTier: 'beginner', category: 'power', animation: 'swing' },
  { id: 'medicine_ball_slam', primary: 'abs', secondary: ['back', 'shoulders'], region: 'core', implement: 'dumbbell', equipment: GYM_DB, patterns: [], strengthRatio: 0.1, minTier: 'beginner', category: 'power', animation: 'overhead_extension' },
  // ---------------------------------------------------------- mobility --
  { id: 'hip_flexor_stretch', primary: 'quads', secondary: ['glutes'], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'mobility', animation: 'lunge', unilateral: true, timed: true },
  { id: 'worlds_greatest_stretch', primary: 'hamstrings', secondary: ['glutes', 'back'], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'mobility', animation: 'lunge', unilateral: true, timed: true },
  { id: 'ninety_ninety_hip', primary: 'glutes', secondary: [], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'mobility', animation: 'kneeling_crunch', unilateral: true, timed: true },
  { id: 'thoracic_rotation', primary: 'back', secondary: ['shoulders'], region: 'upper', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'mobility', animation: 'side_plank', unilateral: true, timed: true },
  { id: 'cat_cow', primary: 'back', secondary: ['abs'], region: 'core', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'mobility', animation: 'superman', timed: true },
  { id: 'shoulder_dislocate', primary: 'shoulders', secondary: ['chest'], region: 'upper', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'mobility', animation: 'overhead_extension', timed: true },
  { id: 'wall_slide', primary: 'shoulders', secondary: ['back'], region: 'upper', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'mobility', animation: 'vertical_push', timed: true },
  { id: 'calf_stretch', primary: 'calves', secondary: [], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'mobility', animation: 'calf_raise', unilateral: true, timed: true },
  { id: 'deep_squat_hold', primary: 'quads', secondary: ['glutes', 'abs'], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: ['deep_knee_flexion'], strengthRatio: 0, minTier: 'beginner', category: 'mobility', animation: 'squat', timed: true },
  { id: 'glute_bridge_hold', primary: 'glutes', secondary: ['hamstrings'], region: 'lower', implement: 'bodyweight', equipment: ALL, patterns: [], strengthRatio: 0, minTier: 'beginner', category: 'mobility', animation: 'bridge', timed: true },
]

const BY_ID: ReadonlyMap<string, ExerciseDefinition> = new Map(EXERCISES.map((e) => [e.id, e]))

export function getExercise(id: string): ExerciseDefinition {
  const exercise = BY_ID.get(id)
  if (!exercise) throw new RangeError(`unknown exercise: ${id}`)
  return exercise
}

export function findExercise(id: string): ExerciseDefinition | undefined {
  return BY_ID.get(id)
}

export const EXERCISE_IDS: readonly string[] = EXERCISES.map((e) => e.id)

/** Every distinct machine id, for the "machines unavailable" questionnaire step. */
export const MACHINE_IDS: readonly string[] = [
  ...new Set(EXERCISES.flatMap((e) => (e.machineId ? [e.machineId] : []))),
]
