import type { MuscleGroup } from '../strength/volume'
import type { AnimationId, Difficulty, ExerciseType, Material, Movement, Purpose } from './types'

/**
 * The open catalogue: rows imported from free-exercise-db (public domain,
 * Unlicense) by scripts/import-catalogue.py, mapped onto the app's own
 * taxonomy. The engine never programs these; they are what the athlete
 * browses and swaps in by hand. The curated library stays the source the
 * generator reasons about.
 */
export interface CatalogueRow {
  id: string
  name: string
  /** Built from a glossary; `nameEsReviewed` says whether a person checked it. */
  nameEs: string
  nameEsReviewed: boolean
  group: MuscleGroup
  secondary: MuscleGroup[]
  /** The dataset's own muscle vocabulary, kept for the detail page. */
  muscles: string[]
  material: Material
  difficulty: Difficulty
  type: ExerciseType
  purpose: Purpose
  force: 'push' | 'pull' | 'static'
  mechanic: 'compound' | 'isolation' | null
  category: string
  images: string[]
  /** The curated exercise this row is the photo set for, when there is one. */
  curated?: string
}

/** Photos live in the dataset's own repository; the path is the row's `images[i]`. */
export const PHOTO_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

export function photoUrl(path: string): string {
  return PHOTO_BASE + path
}

/** One row of the library browser, whichever source it came from. */
export interface LibraryEntry {
  id: string
  source: 'authored' | 'open'
  name: string
  /** The English name when the shown one is an unreviewed glossary translation. */
  altName?: string
  /** Every searchable string, both languages, unfolded. */
  terms: string[]
  group: MuscleGroup
  secondary: MuscleGroup[]
  materials: Material[]
  difficulty: Difficulty
  type: ExerciseType
  purpose: Purpose
  movement?: Movement
  animation?: AnimationId
  photo?: string
}

export interface LibraryFilters {
  group?: MuscleGroup
  purpose?: Purpose
  type?: ExerciseType
  material?: Material
  difficulty?: Difficulty
  source?: 'authored' | 'open'
}

export function matchesFilters(entry: LibraryEntry, f: LibraryFilters): boolean {
  if (f.group && entry.group !== f.group && !entry.secondary.includes(f.group)) return false
  if (f.purpose && entry.purpose !== f.purpose) return false
  if (f.type && entry.type !== f.type) return false
  if (f.material && !entry.materials.includes(f.material)) return false
  if (f.difficulty && entry.difficulty !== f.difficulty) return false
  if (f.source && entry.source !== f.source) return false
  return true
}

/** Authored rows first, then by name; the athlete sees the coached movements before the long tail. */
export function sortEntries(entries: readonly LibraryEntry[]): LibraryEntry[] {
  return [...entries].sort((a, b) => (a.source === b.source ? a.name.localeCompare(b.name) : a.source === 'authored' ? -1 : 1))
}
