import { EXERCISES } from '../exercises/library'
import type { ExerciseDefinition } from '../exercises/types'
import type { AthleteModel, MovementPattern } from '../profile/athlete'
import type { ExperienceTier } from '../profile/types'
import type { Rng } from './rng'
import type { Slot } from './templates'
import { musclesForFocusArea, type MuscleGroup } from './volume'

/**
 * Choosing an exercise for a slot (PLAN.md §6.4).
 *
 * Six steps, in order: filter by equipment, drop banned patterns, drop the
 * athlete's exclusions, drop anything above their experience floor, score what
 * is left, break ties with the seeded generator. Every step before scoring is
 * a hard rule: no amount of focus-area bonus reaches past an injury.
 */
export interface SelectionContext {
  model: AthleteModel
  rng: Rng
  /** Exercise ids used in the previous seven days: penalised for variety. */
  recentlyUsed: ReadonlySet<string>
  /** Permanent swaps from exercise_preferences: from id → to id. */
  swaps: ReadonlyMap<string, string>
  /** Extra patterns banned today, e.g. heavy hinges before a long run. */
  extraBannedPatterns?: ReadonlySet<MovementPattern>
  /**
   * The exercise this slot used last week. Primary and secondary lifts keep it
   * when they can: the next session's load comes from the last one, and a
   * lift that rotates every week has no last one to come from.
   */
  preferred?: string
}

const TIER_RANK: Record<ExperienceTier, number> = { beginner: 0, intermediate: 1, advanced: 2 }

/** Whether an exercise's category can fill a slot of this role. */
export function roleFits(slot: Pick<Slot, 'role'>, exercise: ExerciseDefinition): boolean {
  switch (slot.role) {
    case 'primary':
      return exercise.category === 'compound'
    case 'secondary':
      return exercise.category === 'compound' || exercise.category === 'accessory'
    case 'accessory':
      return exercise.category === 'accessory' || exercise.category === 'compound' || exercise.category === 'isolation'
    case 'isolation':
      return exercise.category === 'isolation' || exercise.category === 'accessory'
    case 'core':
      return exercise.category === 'core'
    case 'finisher':
      return exercise.category === 'conditioning'
  }
}

/** The hard rules. Returns the reason the exercise is out, or null if it is in. */
export function exclusionReason(
  exercise: ExerciseDefinition,
  ctx: SelectionContext,
): string | null {
  const { model } = ctx

  if (!exercise.equipment.includes(model.equipment)) return 'equipment'
  if (exercise.machineId && model.unavailableMachines.includes(exercise.machineId)) return 'machine_unavailable'
  for (const pattern of exercise.patterns) {
    if (model.bannedPatterns.has(pattern)) return `injury:${pattern}`
    if (ctx.extraBannedPatterns?.has(pattern)) return `today:${pattern}`
  }
  if (model.avoidExerciseIds.includes(exercise.id)) return 'avoided'
  if (TIER_RANK[exercise.minTier] > TIER_RANK[model.tier]) return 'experience'
  if (exercise.bigLift && !model.knowsBigLifts) return 'technique'
  return null
}

function score(exercise: ExerciseDefinition, slot: Slot, ctx: SelectionContext): number {
  const { model } = ctx
  let points = 0

  const focused = new Set<MuscleGroup>()
  for (const area of model.focusAreas) for (const m of musclesForFocusArea(area)) focused.add(m)
  if (focused.has(exercise.primary)) points += 3

  if (exercise.primary === slot.muscle) points += 2

  // Beginners get machines and simpler variations first (PLAN.md §6.4).
  if (model.tier === 'beginner') {
    if (exercise.implement === 'machine') points += 2
    if (exercise.implement === 'barbell') points -= 1
  }

  // Exact category match beats a compound standing in for an accessory.
  if (
    (slot.role === 'primary' && exercise.category === 'compound') ||
    (slot.role === 'isolation' && exercise.category === 'isolation') ||
    (slot.role === 'core' && exercise.category === 'core')
  ) {
    points += 1
  }

  // Bodyweight compounds are what a home athlete leads with; in a gym they are
  // accessories. Without this, push-ups and bench press tie and the seed picks.
  if (
    exercise.implement === 'bodyweight' &&
    model.equipment !== 'home_none' &&
    (slot.role === 'primary' || slot.role === 'secondary')
  ) {
    points -= 4
  }

  if (ctx.recentlyUsed.has(exercise.id)) points -= 2

  // Continuity outweighs every tiebreak for the lifts that carry progression;
  // accessories and isolation work are free to rotate.
  if (ctx.preferred === exercise.id && (slot.role === 'primary' || slot.role === 'secondary')) {
    points += 10
  }

  return points
}

/**
 * Picks an exercise for the slot, or null when nothing in the library fits —
 * which the generator treats as "drop the slot", never as "pick anything".
 */
export function selectExercise(
  slot: Slot,
  ctx: SelectionContext,
  alreadyChosen: ReadonlySet<string>,
): ExerciseDefinition | null {
  const eligible = (exercise: ExerciseDefinition) =>
    !alreadyChosen.has(exercise.id) && roleFits(slot, exercise) && exclusionReason(exercise, ctx) === null

  let candidates = EXERCISES.filter((e) => e.primary === slot.muscle && eligible(e))
  if (candidates.length === 0) {
    candidates = EXERCISES.filter((e) => e.secondary.includes(slot.muscle) && eligible(e))
  }
  if (candidates.length === 0) return null

  // Score, then shuffle before a stable sort so equal scores tie-break by the
  // seeded generator rather than by library order.
  const shuffled = ctx.rng.shuffle(candidates)
  shuffled.sort((a, b) => score(b, slot, ctx) - score(a, slot, ctx))

  const chosen = shuffled[0]!
  const swapped = ctx.swaps.get(chosen.id)
  if (swapped) {
    const target = EXERCISES.find((e) => e.id === swapped)
    if (target && eligible(target)) return target
  }
  return chosen
}

/** Everything in the library the athlete may be offered, for the Library screen and swaps. */
export function eligibleExercises(ctx: SelectionContext): ExerciseDefinition[] {
  return EXERCISES.filter((e) => exclusionReason(e, ctx) === null)
}
