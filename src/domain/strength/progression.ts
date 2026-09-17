import type { ExerciseCategory } from '../exercises/types'
import type { PrimaryGoal } from '../profile/types'
import type { SlotRole } from './templates'

/**
 * How an exercise moves from one session to the next (CLAUDE.md, rule 4).
 * Picked per exercise, never one rule for the whole plan: a compound is
 * steered by its estimated max and the RPE it was logged at, an accessory by
 * whether the athlete cleared the top of its rep range last time.
 */
export type ProgressionScheme = 'rir_autoregulation' | 'double_progression' | 'percentage' | 'volume'

export function progressionScheme(role: SlotRole, category: ExerciseCategory, goal: PrimaryGoal): ProgressionScheme {
  if (role === 'power' || role === 'mobility' || role === 'finisher' || category === 'conditioning' || category === 'mobility') return 'volume'
  if (role === 'primary' || role === 'secondary') return goal === 'strength' ? 'percentage' : 'rir_autoregulation'
  return 'double_progression'
}

export interface LoggedSetLike {
  kg: number | null
  reps: number | null
  done: boolean
}

export type ProgressionReason = 'first' | 'increase' | 'hold' | 'decrease'

export interface DoubleProgressionResult {
  kg: number
  reason: ProgressionReason
}

/**
 * Double progression: clear the top of the rep range on every set and the load
 * goes up by one increment; miss the bottom on half the sets and it comes down;
 * anything else, the same load again and chase the reps.
 */
export function doubleProgression(input: {
  repMin: number
  repMax: number
  lastSets: readonly LoggedSetLike[]
  incrementKg: number
  plannedKg: number
}): DoubleProgressionResult {
  const done = input.lastSets.filter((s) => s.done && s.reps !== null && s.kg !== null && s.kg > 0)
  if (done.length === 0) return { kg: input.plannedKg, reason: 'first' }
  // The load the athlete actually worked at: the most used, ties to the heavier.
  const counts = new Map<number, number>()
  for (const s of done) counts.set(s.kg!, (counts.get(s.kg!) ?? 0) + 1)
  const lastKg = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0]
  const atLoad = done.filter((s) => s.kg === lastKg)
  const cleared = atLoad.every((s) => s.reps! >= input.repMax)
  const missed = atLoad.filter((s) => s.reps! < input.repMin).length * 2 >= atLoad.length
  if (cleared) return { kg: lastKg + input.incrementKg, reason: 'increase' }
  if (missed) return { kg: Math.max(0, lastKg - input.incrementKg), reason: 'decrease' }
  return { kg: lastKg, reason: 'hold' }
}
