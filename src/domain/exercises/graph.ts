import { EXERCISES, findExercise, getExercise } from './library'
import { difficultyOf, type Difficulty, type ExerciseDefinition, type Material } from './types'
import type { MovementPattern } from '../profile/athlete'
import type { EquipmentSetting } from '../profile/types'

/**
 * The substitution graph (Phase 2 of the brief). An app that cannot swap an
 * exercise when the rack is busy or the shoulder hurts is a PDF, not a coach.
 * Two kinds of edges: authored regressions and progressions (same pattern,
 * easier or harder), and substitutes computed from the taxonomy (same
 * movement and primary muscle, done with what the athlete has).
 */
export interface SubstituteQuery {
  equipment: EquipmentSetting
  /** Machines the athlete marked as unavailable. */
  unavailableMachines?: readonly string[]
  /** Joint-loading patterns the athlete must avoid. */
  bannedPatterns?: ReadonlySet<MovementPattern>
  /** Never offer the athlete's own exclusions. */
  avoidIds?: readonly string[]
  /** Cap on difficulty, usually the athlete's tier. */
  maxDifficulty?: Difficulty
}

const RANK: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 }

export function isDoable(exercise: ExerciseDefinition, q: SubstituteQuery): boolean {
  if (!exercise.equipment.includes(q.equipment)) return false
  if (exercise.machineId && q.unavailableMachines?.includes(exercise.machineId)) return false
  if (q.bannedPatterns && exercise.patterns.some((p) => q.bannedPatterns!.has(p))) return false
  if (q.avoidIds?.includes(exercise.id)) return false
  if (q.maxDifficulty && RANK[difficultyOf(exercise)] > RANK[q.maxDifficulty]) return false
  return true
}

/**
 * Same movement and primary muscle, doable with what the athlete has. The
 * authored edges come first, then the closest by category and implement.
 */
export function substitutesFor(id: string, q: SubstituteQuery): ExerciseDefinition[] {
  const source = getExercise(id)
  const authored = [...(source.regressions ?? []), ...(source.progressions ?? [])]
  const rank = (e: ExerciseDefinition) =>
    (authored.includes(e.id) ? 0 : 4) + (e.category === source.category ? 0 : 2) + (e.implement === source.implement ? 0 : 1)
  return EXERCISES.filter((e) => e.id !== id && e.movement === source.movement && e.primary === source.primary && isDoable(e, q)).sort((a, b) => rank(a) - rank(b))
}

/** Easier movements of the same pattern, easiest first; only ones that exist. */
export function regressionsOf(id: string): ExerciseDefinition[] {
  return (getExercise(id).regressions ?? []).map(findExercise).filter((e): e is ExerciseDefinition => e !== undefined)
}

/** Harder movements of the same pattern, next step first. */
export function progressionsOf(id: string): ExerciseDefinition[] {
  return (getExercise(id).progressions ?? []).map(findExercise).filter((e): e is ExerciseDefinition => e !== undefined)
}

/** What a movement needs beyond the athlete's setting, for the "no tengo barra" question. */
export function needsMaterial(exercise: ExerciseDefinition, material: Material): boolean {
  return exercise.implement === material || (exercise.materials ?? []).includes(material)
}

/**
 * Case- and accent-insensitive search over names and aliases in both
 * languages: "press banca", "bench press" and "press de pecho" all find the
 * same row. The catalogues are passed in so this stays pure.
 */
export interface SearchEntry {
  id: string
  /** Every searchable string for the entry, already folded. */
  terms: string[]
}

export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildSearchIndex(entries: ReadonlyArray<{ id: string; texts: readonly string[] }>): SearchEntry[] {
  return entries.map((e) => ({ id: e.id, terms: e.texts.map(fold).filter((t) => t.length > 0) }))
}

/** Ids whose every query word appears in some term, best matches first. */
export function search(index: readonly SearchEntry[], query: string, limit = 50): string[] {
  const words = fold(query).split(' ').filter((w) => w.length > 0)
  if (words.length === 0) return []
  const scored: [string, number][] = []
  for (const entry of index) {
    let score = 0
    for (const word of words) {
      const exact = entry.terms.some((t) => t === word || t.split(' ').includes(word))
      const partial = exact || entry.terms.some((t) => t.includes(word))
      if (!partial) {
        score = -1
        break
      }
      score += exact ? 2 : 1
    }
    if (score > 0) scored.push([entry.id, score])
  }
  return scored.sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id)
}
