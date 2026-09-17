import { EXERCISES, getExercise } from '../exercises/library'
import type { ExerciseDefinition } from '../exercises/types'
import type { AthleteModel } from '../profile/athlete'
import type { Units } from '../profile/types'
import { loadForTarget, roundToIncrement, startingLoadKg } from '../strength/loads'
import { phaseParameters } from '../strength/periodization'
import { createRng } from '../strength/rng'
import { exclusionReason, roleFits, type SelectionContext } from '../strength/selection'
import { roleShape, type SlotRole } from '../strength/templates'
import { estimateSessionMinutes, labelExercises, type GymSession, type PlannedExercise } from './generator'

/**
 * Editing a planned session by hand (PLAN.md §3, §6.4).
 *
 * The athlete stays in charge of what they do today: swap a lift for one that
 * hits the same muscle, add or drop an exercise, change the sets, reps, load
 * or rest, reorder. Every edit is pure, keeps the rest of the session intact,
 * and never offers anything the engine itself would refuse — an injury ban or
 * a missing machine holds under a swap exactly as it does under generation.
 */
export interface EditContext {
  model: AthleteModel
  /** Week of the block the day sits in; sets the phase's RPE and load multiplier. */
  week: number
  totalWeeks: number
  /** Latest estimated 1RM per exercise, so a swap opens at the athlete's real load. */
  maxes?: Readonly<Record<string, number>>
}

export interface ExercisePatch {
  sets?: number
  repMin?: number
  repMax?: number
  loadKg?: number
  restSec?: number
  rpeTarget?: number
}

export const EDIT_LIMITS = {
  sets: { min: 1, max: 10 },
  reps: { min: 1, max: 50 },
  loadKg: { min: 0, max: 500 },
  restSec: { min: 15, max: 300 },
  rpeTarget: { min: 5, max: 10 },
  /** More than this and the session stops being a session. */
  exercises: 12,
} as const

function selectionContext(model: AthleteModel): SelectionContext {
  return { model, rng: createRng('edit'), recentlyUsed: new Set(), swaps: new Map() }
}

/** Whether the engine would offer this exercise to this athlete at all. */
export function isOfferable(exercise: ExerciseDefinition, model: AthleteModel): boolean {
  return exercise.category !== 'conditioning' && exclusionReason(exercise, selectionContext(model)) === null
}

function repTarget(e: Pick<PlannedExercise, 'repMin' | 'repMax'>): number {
  return Math.round((e.repMin + e.repMax) / 2)
}

/** The working load the engine would prescribe for this exercise today. */
export function prescribeLoad(exercise: ExerciseDefinition, reps: number, rpe: number, ctx: EditContext): number {
  if (exercise.implement === 'bodyweight' || exercise.category === 'conditioning' || exercise.timed) return 0
  const { model } = ctx
  const phase = phaseParameters(ctx.week, ctx.totalWeeks)
  const max = ctx.maxes?.[exercise.id]
  const base = max
    ? loadForTarget(max, reps, rpe)
    : startingLoadKg({
        bodyweightKg: model.weightKg,
        strengthRatio: exercise.strengthRatio,
        region: exercise.region,
        implement: exercise.implement,
        sex: model.sex,
        experience: model.experience,
        units: model.units,
        conservativeMode: model.conservativeMode,
      })
  const powerScale = exercise.category === 'power' ? 0.5 : 1
  return roundToIncrement(base * powerScale * phase.loadMultiplier, exercise.implement, model.units)
}

/**
 * What the athlete may swap an exercise for: movements that train the same
 * primary muscle first, then ones that reach it as a secondary; nothing the
 * session already holds, nothing the engine would refuse them. Within each
 * group, exercises that fit the slot's role lead, then the same implement.
 */
export function alternativesFor(gym: GymSession, exerciseId: string, model: AthleteModel): ExerciseDefinition[] {
  const current = getExercise(exerciseId)
  const planned = gym.exercises.find((e) => e.exerciseId === exerciseId)
  const role: SlotRole = planned?.role ?? 'accessory'
  const inSession = new Set(gym.exercises.map((e) => e.exerciseId))
  const ok = (e: ExerciseDefinition) => e.id !== exerciseId && !inSession.has(e.id) && isOfferable(e, model)
  const rank = (e: ExerciseDefinition) => (roleFits({ role }, e) ? 0 : 2) + (e.implement === current.implement ? 0 : 1)
  const primary = EXERCISES.filter((e) => e.primary === current.primary && ok(e)).sort((a, b) => rank(a) - rank(b))
  const secondary = EXERCISES.filter((e) => e.primary !== current.primary && e.secondary.includes(current.primary) && ok(e))
  return [...primary, ...secondary]
}

/** Everything the athlete may add to this session, in library order. */
export function catalogueFor(gym: GymSession, model: AthleteModel): ExerciseDefinition[] {
  const inSession = new Set(gym.exercises.map((e) => e.exerciseId))
  return EXERCISES.filter((e) => !inSession.has(e.id) && isOfferable(e, model))
}

function finish(gym: GymSession, exercises: PlannedExercise[]): GymSession {
  const relabelled = exercises.map((e) => ({ ...e }))
  labelExercises(relabelled)
  return { ...gym, exercises: relabelled, estimatedMinutes: estimateSessionMinutes(relabelled, gym.finisher !== undefined) }
}

/** Superset pairs only survive while their members sit next to each other. */
function dropBrokenSupersets(exercises: PlannedExercise[]): PlannedExercise[] {
  const broken = new Set<string>()
  const seen = new Map<string, number>()
  exercises.forEach((e, i) => {
    if (!e.supersetGroup) return
    const last = seen.get(e.supersetGroup)
    if (last !== undefined && last !== i - 1) broken.add(e.supersetGroup)
    seen.set(e.supersetGroup, i)
  })
  return exercises.map((e) => {
    if (!e.supersetGroup || !broken.has(e.supersetGroup)) return e
    const { supersetGroup: _dropped, ...rest } = e
    return rest
  })
}

/**
 * Replaces one exercise with another, keeping the slot's sets, reps, RPE and
 * rest: the prescription belongs to the slot, the load to the exercise.
 */
export function swapExercise(gym: GymSession, fromId: string, toId: string, ctx: EditContext): GymSession {
  const target = getExercise(toId)
  if (!gym.exercises.some((e) => e.exerciseId === fromId)) throw new RangeError(`not in session: ${fromId}`)
  if (gym.exercises.some((e) => e.exerciseId === toId)) throw new RangeError(`already in session: ${toId}`)
  if (!isOfferable(target, ctx.model)) throw new RangeError(`not offerable: ${toId}`)
  const exercises = gym.exercises.map((e) =>
    e.exerciseId === fromId ? { ...e, exerciseId: toId, loadKg: prescribeLoad(target, repTarget(e), e.rpeTarget, ctx) } : e,
  )
  return { ...gym, exercises, estimatedMinutes: estimateSessionMinutes(exercises, gym.finisher !== undefined) }
}

/** The role an exercise added by hand takes, from its category and what the session already has. */
export function roleForAdded(exercise: ExerciseDefinition, gym: GymSession): Exclude<SlotRole, 'finisher'> {
  switch (exercise.category) {
    case 'compound':
      return gym.exercises.some((e) => e.role === 'primary') ? 'secondary' : 'primary'
    case 'accessory':
      return 'accessory'
    case 'isolation':
      return 'isolation'
    case 'core':
      return 'core'
    case 'power':
      return 'power'
    case 'mobility':
      return 'mobility'
    case 'conditioning':
      throw new RangeError('conditioning work is a finisher, not an exercise slot')
  }
}

/** Appends an exercise with the sets, reps, rest and load the engine would have given that slot. */
export function addExercise(gym: GymSession, exerciseId: string, ctx: EditContext): GymSession {
  const exercise = getExercise(exerciseId)
  if (gym.exercises.some((e) => e.exerciseId === exerciseId)) throw new RangeError(`already in session: ${exerciseId}`)
  if (gym.exercises.length >= EDIT_LIMITS.exercises) throw new RangeError('session is full')
  if (!isOfferable(exercise, ctx.model)) throw new RangeError(`not offerable: ${exerciseId}`)
  const role = roleForAdded(exercise, gym)
  const shape = roleShape(ctx.model.goal, role)
  const phase = phaseParameters(ctx.week, ctx.totalWeeks)
  const rpeTarget = Math.min(phase.rpeTarget, ctx.model.maxRpe)
  const sets = Math.max(1, Math.round(shape.sets * phase.volumeMultiplier))
  const added: PlannedExercise = {
    label: '',
    exerciseId,
    role,
    sets,
    repMin: shape.repMin,
    repMax: shape.repMax,
    rpeTarget,
    loadKg: prescribeLoad(exercise, repTarget(shape), rpeTarget, ctx),
    restSec: shape.restSec,
    technique: 'straight',
    ...(exercise.timed ? { holdSeconds: repTarget(shape) } : {}),
  }
  return finish(gym, [...gym.exercises, added])
}

export function removeExercise(gym: GymSession, exerciseId: string): GymSession {
  if (!gym.exercises.some((e) => e.exerciseId === exerciseId)) throw new RangeError(`not in session: ${exerciseId}`)
  return finish(gym, dropBrokenSupersets(gym.exercises.filter((e) => e.exerciseId !== exerciseId)))
}

export function moveExercise(gym: GymSession, exerciseId: string, direction: 'up' | 'down'): GymSession {
  const index = gym.exercises.findIndex((e) => e.exerciseId === exerciseId)
  if (index < 0) throw new RangeError(`not in session: ${exerciseId}`)
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= gym.exercises.length) return gym
  const exercises = [...gym.exercises]
  const [moved] = exercises.splice(index, 1)
  exercises.splice(target, 0, moved!)
  return finish(gym, dropBrokenSupersets(exercises))
}

const clamp = (value: number, range: { min: number; max: number }) => Math.min(range.max, Math.max(range.min, value))

/** Applies the athlete's numbers, clamped to sane bounds; a rep range given backwards is turned round. */
export function updateExercise(gym: GymSession, exerciseId: string, patch: ExercisePatch, units: Units): GymSession {
  if (!gym.exercises.some((e) => e.exerciseId === exerciseId)) throw new RangeError(`not in session: ${exerciseId}`)
  const exercises = gym.exercises.map((e) => {
    if (e.exerciseId !== exerciseId) return e
    let repMin = Math.round(clamp(patch.repMin ?? e.repMin, EDIT_LIMITS.reps))
    let repMax = Math.round(clamp(patch.repMax ?? e.repMax, EDIT_LIMITS.reps))
    if (repMin > repMax) [repMin, repMax] = [repMax, repMin]
    const loadKg = patch.loadKg === undefined ? e.loadKg : clamp(patch.loadKg, EDIT_LIMITS.loadKg)
    return {
      ...e,
      sets: Math.round(clamp(patch.sets ?? e.sets, EDIT_LIMITS.sets)),
      repMin,
      repMax,
      // Kept to what a plate stack can show, in the athlete's own unit.
      loadKg: units === 'imperial' ? Math.round(loadKg * 100) / 100 : Math.round(loadKg * 4) / 4,
      restSec: Math.round(clamp(patch.restSec ?? e.restSec, EDIT_LIMITS.restSec)),
      rpeTarget: Math.round(clamp(patch.rpeTarget ?? e.rpeTarget, EDIT_LIMITS.rpeTarget) * 2) / 2,
    }
  })
  return { ...gym, exercises, estimatedMinutes: estimateSessionMinutes(exercises, gym.finisher !== undefined) }
}
