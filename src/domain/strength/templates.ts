import { EXERCISES } from '../exercises/library'
import type { ExperienceTier, PrimaryGoal } from '../profile/types'
import { goalPolicy } from './goals'
import type { SessionKind } from './splits'
import type { MuscleGroup } from './volume'

/**
 * What a session is made of before any exercise is chosen (PLAN.md §6.3).
 *
 * A template is an ordered list of slots. Order is priority: when a session
 * has to be short, slots are dropped from the end, never the front, so the
 * primary lift always survives and the isolation work is what gives way.
 */
export type SlotRole = 'power' | 'primary' | 'secondary' | 'accessory' | 'isolation' | 'core' | 'mobility' | 'finisher'

export interface Slot {
  role: SlotRole
  muscle: MuscleGroup
  sets: number
  repMin: number
  repMax: number
  restSec: number
  /** Slots sharing a group are performed back to back (C1 / C2). */
  supersetGroup?: string
}

interface RoleShape {
  repMin: number
  repMax: number
  restSec: number
}

/**
 * Rep bands and rest per role, shaped by the goal (CLAUDE.md, rule 3).
 * Mobility bands are seconds of a hold, not reps.
 */
type Shapes = Record<Exclude<SlotRole, 'finisher'>, RoleShape>

const POWER: RoleShape = { repMin: 3, repMax: 5, restSec: 150 }
const MOBILITY: RoleShape = { repMin: 30, repMax: 45, restSec: 15 }

const HYPERTROPHY: Shapes = {
  power: POWER,
  primary: { repMin: 6, repMax: 10, restSec: 120 },
  secondary: { repMin: 8, repMax: 12, restSec: 90 },
  accessory: { repMin: 10, repMax: 15, restSec: 75 },
  isolation: { repMin: 12, repMax: 15, restSec: 60 },
  core: { repMin: 12, repMax: 20, restSec: 45 },
  mobility: MOBILITY,
}

const GOAL_SHAPES: Record<PrimaryGoal, Shapes> = {
  hypertrophy: HYPERTROPHY,
  strength: {
    power: POWER,
    primary: { repMin: 3, repMax: 5, restSec: 240 },
    secondary: { repMin: 5, repMax: 8, restSec: 180 },
    accessory: { repMin: 8, repMax: 12, restSec: 90 },
    isolation: { repMin: 10, repMax: 15, restSec: 60 },
    core: { repMin: 10, repMax: 15, restSec: 45 },
    mobility: MOBILITY,
  },
  fat_loss: {
    power: POWER,
    primary: { repMin: 8, repMax: 12, restSec: 75 },
    secondary: { repMin: 10, repMax: 15, restSec: 60 },
    accessory: { repMin: 12, repMax: 15, restSec: 45 },
    isolation: { repMin: 12, repMax: 20, restSec: 45 },
    core: { repMin: 15, repMax: 20, restSec: 30 },
    mobility: MOBILITY,
  },
  recomposition: HYPERTROPHY,
  endurance: {
    power: POWER,
    primary: { repMin: 6, repMax: 10, restSec: 90 },
    secondary: { repMin: 8, repMax: 12, restSec: 90 },
    accessory: { repMin: 10, repMax: 15, restSec: 60 },
    isolation: { repMin: 12, repMax: 15, restSec: 60 },
    core: { repMin: 12, repMax: 20, restSec: 45 },
    mobility: MOBILITY,
  },
  athletic_performance: {
    power: POWER,
    primary: { repMin: 3, repMax: 5, restSec: 180 },
    secondary: { repMin: 5, repMax: 8, restSec: 120 },
    accessory: { repMin: 6, repMax: 10, restSec: 90 },
    isolation: { repMin: 8, repMax: 12, restSec: 60 },
    core: { repMin: 8, repMax: 12, restSec: 60 },
    mobility: MOBILITY,
  },
  general_health: {
    power: POWER,
    primary: { repMin: 8, repMax: 12, restSec: 90 },
    secondary: { repMin: 8, repMax: 12, restSec: 75 },
    accessory: { repMin: 10, repMax: 15, restSec: 60 },
    isolation: { repMin: 12, repMax: 15, restSec: 60 },
    core: { repMin: 12, repMax: 20, restSec: 45 },
    mobility: MOBILITY,
  },
  mobility_rehab: {
    power: POWER,
    primary: { repMin: 8, repMax: 12, restSec: 90 },
    secondary: { repMin: 10, repMax: 15, restSec: 75 },
    accessory: { repMin: 12, repMax: 15, restSec: 60 },
    isolation: { repMin: 12, repMax: 20, restSec: 60 },
    core: { repMin: 15, repMax: 20, restSec: 45 },
    mobility: { repMin: 45, repMax: 60, restSec: 15 },
  },
}

const SETS_BY_ROLE: Record<Exclude<SlotRole, 'finisher'>, number> = {
  power: 3,
  primary: 4,
  secondary: 3,
  accessory: 3,
  isolation: 3,
  core: 3,
  mobility: 2,
}

/** Rep band, rest and default set count for a role under a goal — what an exercise added by hand inherits. */
export function roleShape(goal: PrimaryGoal, role: Exclude<SlotRole, 'finisher'>): RoleShape & { sets: number } {
  return { ...GOAL_SHAPES[goal][role], sets: SETS_BY_ROLE[role] }
}

type Blueprint = ReadonlyArray<[Exclude<SlotRole, 'finisher'>, MuscleGroup]>

/** Muscle order per session kind, highest priority first. */
const BLUEPRINTS: Record<Exclude<SessionKind, 'custom'>, Blueprint> = {
  full_body_a: [['primary', 'quads'], ['secondary', 'chest'], ['secondary', 'back'], ['accessory', 'hamstrings'], ['isolation', 'shoulders'], ['core', 'abs'], ['isolation', 'calves']],
  full_body_b: [['primary', 'hamstrings'], ['secondary', 'back'], ['secondary', 'chest'], ['accessory', 'glutes'], ['isolation', 'biceps'], ['isolation', 'triceps'], ['core', 'abs']],
  full_body_c: [['primary', 'glutes'], ['secondary', 'shoulders'], ['secondary', 'back'], ['accessory', 'quads'], ['isolation', 'calves'], ['core', 'abs'], ['isolation', 'chest']],
  push: [['primary', 'chest'], ['secondary', 'shoulders'], ['accessory', 'chest'], ['isolation', 'triceps'], ['isolation', 'shoulders'], ['isolation', 'chest'], ['core', 'abs']],
  pull: [['primary', 'back'], ['secondary', 'back'], ['accessory', 'back'], ['isolation', 'shoulders'], ['isolation', 'biceps'], ['isolation', 'biceps'], ['core', 'abs']],
  legs: [['primary', 'quads'], ['secondary', 'hamstrings'], ['accessory', 'glutes'], ['isolation', 'quads'], ['isolation', 'hamstrings'], ['isolation', 'calves'], ['core', 'abs']],
  upper: [['primary', 'chest'], ['primary', 'back'], ['secondary', 'shoulders'], ['secondary', 'back'], ['isolation', 'biceps'], ['isolation', 'triceps'], ['isolation', 'shoulders']],
  lower: [['primary', 'quads'], ['secondary', 'hamstrings'], ['accessory', 'glutes'], ['isolation', 'quads'], ['isolation', 'calves'], ['core', 'abs'], ['isolation', 'hamstrings']],
  lower_a: [['primary', 'quads'], ['secondary', 'hamstrings'], ['accessory', 'glutes'], ['isolation', 'calves'], ['core', 'abs'], ['isolation', 'quads'], ['isolation', 'hamstrings']],
  upper_a: [['primary', 'chest'], ['secondary', 'back'], ['secondary', 'shoulders'], ['isolation', 'triceps'], ['isolation', 'biceps'], ['isolation', 'chest'], ['core', 'abs']],
  glutes_lower_b: [['primary', 'glutes'], ['secondary', 'hamstrings'], ['accessory', 'glutes'], ['accessory', 'quads'], ['isolation', 'glutes'], ['core', 'abs'], ['isolation', 'calves']],
  upper_b: [['primary', 'back'], ['secondary', 'chest'], ['secondary', 'shoulders'], ['isolation', 'biceps'], ['isolation', 'triceps'], ['isolation', 'shoulders'], ['core', 'abs']],
}

/** Muscles the library can serve with a compound movement — candidates for the main lift. */
const PRIMARY_CAPABLE: ReadonlySet<MuscleGroup> = new Set(
  EXERCISES.filter((e) => e.category === 'compound').map((e) => e.primary),
)

/** Muscles with at least an accessory movement, so they can carry a mid-session slot. */
const ACCESSORY_CAPABLE: ReadonlySet<MuscleGroup> = new Set(
  EXERCISES.filter((e) => e.category === 'accessory').map((e) => e.primary),
)

/**
 * A blueprint from the muscle groups the athlete named for the day.
 *
 * The first muscle gets the primary lift, the second the secondary, and the
 * rest accessories; then every muscle gets isolation work in the order given,
 * so "glutes, hamstrings" reads as a glute day with hamstring support and
 * "hamstrings, glutes" the other way round. Muscles the library only serves
 * with isolation movements (biceps, triceps, calves) never get a compound
 * slot they could not fill, and abs go in as core work.
 */
export function customBlueprint(focus: readonly MuscleGroup[]): Blueprint {
  const muscles = [...new Set(focus)]
  if (muscles.length === 0) throw new RangeError('a custom session needs at least one muscle group')

  const big = muscles.filter((m) => m !== 'abs' && PRIMARY_CAPABLE.has(m))
  const mid = muscles.filter((m) => m !== 'abs' && !PRIMARY_CAPABLE.has(m) && ACCESSORY_CAPABLE.has(m))
  const small = muscles.filter((m) => m !== 'abs' && !PRIMARY_CAPABLE.has(m) && !ACCESSORY_CAPABLE.has(m))
  const wantsAbs = muscles.includes('abs')
  const pairs: Array<[Exclude<SlotRole, 'finisher'>, MuscleGroup]> = []

  if (big.length > 0) {
    pairs.push(['primary', big[0]!])
    pairs.push(['secondary', big[1] ?? big[0]!])
    for (const m of big.slice(2)) pairs.push(['accessory', m])
    if (big.length < 3) pairs.push(['accessory', big[0]!])
  }
  for (const m of mid) pairs.push(['accessory', m])
  for (const m of small) pairs.push(['isolation', m])
  for (const m of mid) pairs.push(['isolation', m])
  for (const m of big) pairs.push(['isolation', m])
  if (wantsAbs || pairs.length < 7) pairs.push(['core', 'abs'])
  for (const m of small) pairs.push(['isolation', m])
  for (const m of big) pairs.push(['isolation', m])

  // A day built from one or two small muscles (calves, or abs alone) would
  // otherwise be a couple of slots long. Pad it round-robin so a short list
  // still fills a session; selection skips any exercise already used.
  let cursor = 0
  while (pairs.length < 5) {
    const m = muscles[cursor % muscles.length]!
    pairs.push([m === 'abs' ? 'core' : 'isolation', m])
    cursor += 1
  }

  return pairs.slice(0, 8)
}

/** How many slots fit in a session of a given length, warm-up included. */
export function slotBudget(sessionMinutes: number): number {
  if (sessionMinutes <= 30) return 3
  if (sessionMinutes <= 45) return 4
  if (sessionMinutes <= 60) return 6
  if (sessionMinutes <= 75) return 7
  return 8
}

/** Whether the goal ends sessions with a conditioning piece. */
export function wantsFinisher(goal: PrimaryGoal): boolean {
  return goalPolicy(goal).finisher
}

/** Whether accessory and isolation work is paired into supersets. */
export function wantsSupersets(goal: PrimaryGoal): boolean {
  return goalPolicy(goal).supersets
}

export function sessionTemplate(
  kind: SessionKind,
  goal: PrimaryGoal,
  tier: ExperienceTier,
  sessionMinutes: number,
  focus?: readonly MuscleGroup[],
): Slot[] {
  const shapes = GOAL_SHAPES[goal]
  const policy = goalPolicy(goal)
  const budget = slotBudget(sessionMinutes) - (policy.finisher ? 1 : 0)
  const base = kind === 'custom' ? customBlueprint(focus ?? []) : BLUEPRINTS[kind]
  const lead = base[0]?.[1] ?? 'quads'

  // Goal-specific slots wrap the blueprint: explosive work before the primary
  // lift for the athlete, mobility first for someone coming back, mobility
  // last for general health. They ride outside the slot budget: a mobility
  // hold is a minute, and power work is what the athletic session is for.
  const blueprint: Blueprint = [
    ...(policy.mobilitySlot === 'start' ? ([['mobility', lead]] as Blueprint) : []),
    ...(policy.powerSlot ? ([['power', lead]] as Blueprint) : []),
    ...base.slice(0, Math.max(2, budget)),
    ...(policy.mobilitySlot === 'end' ? ([['mobility', lead]] as Blueprint) : []),
  ]

  const slots: Slot[] = blueprint.map(([role, muscle]) => {
    const shape = shapes[role]
    // Beginners do fewer sets per slot: the same total is spread over more
    // sessions and their recovery cannot yet absorb the extra.
    const sets = tier === 'beginner' && role !== 'primary' ? Math.max(2, SETS_BY_ROLE[role] - 1) : SETS_BY_ROLE[role]
    return { role, muscle, sets, ...shape }
  })

  if (wantsSupersets(goal)) {
    let group = 0
    for (let i = 0; i < slots.length - 1; i += 1) {
      const a = slots[i]!
      const b = slots[i + 1]!
      // Everything but the primary lift pairs: density is the point of the goal.
      const pairable = (s: Slot) => s.role !== 'primary' && s.role !== 'finisher'
      if (pairable(a) && pairable(b) && !a.supersetGroup && !b.supersetGroup) {
        group += 1
        a.supersetGroup = `S${group}`
        b.supersetGroup = `S${group}`
        i += 1
      }
    }
  }

  if (wantsFinisher(goal)) {
    slots.push({ role: 'finisher', muscle: 'quads', sets: 1, repMin: 1, repMax: 1, restSec: 0 })
  }

  return slots
}
