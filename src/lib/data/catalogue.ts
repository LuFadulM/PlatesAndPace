import catalogue from '@/data/catalogue.json'
import steps from '@/data/catalogue-steps.json'
import en from '../../../messages/en.json'
import es from '../../../messages/es.json'
import type { CatalogueRow, LibraryEntry } from '@/domain/exercises/catalogue'
import { EXERCISES } from '@/domain/exercises/library'
import { materialsOf } from '@/domain/exercises/types'
import type { Locale } from '@/i18n/routing'

const ROWS = catalogue as CatalogueRow[]
const STEPS = steps as Record<string, string[]>
const BY_ID = new Map(ROWS.map((r) => [r.id, r]))

type Copy = Record<string, Record<string, string>>
const COPY: Record<Locale, Copy> = { en: (en as { exercises: Copy }).exercises, es: (es as { exercises: Copy }).exercises }

export function getCatalogueRow(id: string): CatalogueRow | undefined {
  return BY_ID.get(id)
}

export function getCatalogueSteps(id: string): string[] {
  return STEPS[id] ?? []
}

export function catalogueRowFor(mediaId: string | undefined): CatalogueRow | undefined {
  return mediaId ? BY_ID.get(mediaId) : undefined
}

function aliasesOf(copy: Copy, id: string): string[] {
  return (copy[id]?.aliases ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}

/**
 * The full browsable library for one locale: every curated exercise, then
 * every open row that is not already the photo set of a curated one. Search
 * terms carry both languages so "bench press" finds "Press de banca".
 */
export function buildLibraryEntries(locale: Locale): LibraryEntry[] {
  const entries: LibraryEntry[] = EXERCISES.map((e) => ({
    id: e.id,
    source: 'authored',
    name: COPY[locale][e.id]?.name ?? e.id,
    terms: [en, es].flatMap((c) => [(c as { exercises: Copy }).exercises[e.id]?.name ?? '', ...aliasesOf((c as { exercises: Copy }).exercises, e.id)]),
    group: e.primary,
    secondary: [...e.secondary],
    materials: materialsOf(e),
    difficulty: e.minTier,
    type: e.type,
    purpose: e.purpose,
    movement: e.movement,
    animation: e.animation,
    photo: catalogueRowFor(e.mediaId)?.images[0],
  }))
  for (const r of ROWS) {
    if (r.curated) continue
    const spanish = locale === 'es'
    entries.push({
      id: r.id,
      source: 'open',
      name: spanish ? r.nameEs : r.name,
      altName: spanish && !r.nameEsReviewed ? r.name : undefined,
      terms: [r.name, r.nameEs, ...r.muscles],
      group: r.group,
      secondary: r.secondary,
      materials: [r.material],
      difficulty: r.difficulty,
      type: r.type,
      purpose: r.purpose,
      photo: r.images[0],
    })
  }
  return entries
}
