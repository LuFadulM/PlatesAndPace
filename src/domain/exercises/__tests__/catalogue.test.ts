import { describe, expect, it } from 'vitest'
import catalogue from '../../../data/catalogue.json'
import steps from '../../../data/catalogue-steps.json'
import { matchesFilters, photoUrl, sortEntries, type CatalogueRow, type LibraryEntry } from '../catalogue'
import { EXERCISES, findExercise } from '../library'
import { EXERCISE_TYPES, MATERIALS, PURPOSES } from '../types'
import { MUSCLE_GROUPS } from '../../strength/volume'

const ROWS = catalogue as CatalogueRow[]
const STEPS = steps as Record<string, string[]>

describe('open catalogue', () => {
  it('imported a substantial catalogue with unique ids', () => {
    expect(ROWS.length).toBeGreaterThan(500)
    expect(new Set(ROWS.map((r) => r.id)).size).toBe(ROWS.length)
  })

  it('maps every row onto the app taxonomy', () => {
    for (const r of ROWS) {
      expect(MUSCLE_GROUPS, r.id).toContain(r.group)
      for (const m of r.secondary) expect(MUSCLE_GROUPS, r.id).toContain(m)
      expect(MATERIALS, r.id).toContain(r.material)
      expect(PURPOSES, r.id).toContain(r.purpose)
      expect(EXERCISE_TYPES, r.id).toContain(r.type)
      expect(['beginner', 'intermediate', 'advanced'], r.id).toContain(r.difficulty)
      expect(r.secondary, r.id).not.toContain(r.group)
    }
  })

  it('gives every row a name in both languages and flags the machine translations', () => {
    for (const r of ROWS) {
      expect(r.name.trim().length, r.id).toBeGreaterThan(0)
      expect(r.nameEs.trim().length, r.id).toBeGreaterThan(0)
      // Nothing claims a human-checked Spanish name yet; the UI says so.
      expect(r.nameEsReviewed, r.id).toBe(false)
    }
  })

  it('points every curated mediaId at a real catalogue row, and back', () => {
    for (const e of EXERCISES) {
      if (!e.mediaId) continue
      const row = ROWS.find((r) => r.id === e.mediaId)
      expect(row, `${e.id} -> ${e.mediaId}`).toBeDefined()
      expect(row?.curated, e.mediaId).toBe(e.id)
    }
    for (const r of ROWS) {
      if (!r.curated) continue
      expect(findExercise(r.curated), r.id).toBeDefined()
    }
  })

  it('serves photos and steps from the open dataset', () => {
    const withPhotos = ROWS.filter((r) => r.images.length > 0)
    expect(withPhotos.length / ROWS.length).toBeGreaterThan(0.95)
    expect(Object.keys(STEPS).length).toBeGreaterThan(800)
    expect(photoUrl('Barbell_Squat/0.jpg')).toMatch(/^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\//)
  })
})

describe('library filters', () => {
  const entry = (over: Partial<LibraryEntry> = {}): LibraryEntry => ({
    id: 'x', source: 'authored', name: 'X', terms: [], group: 'chest', secondary: ['triceps'],
    materials: ['barbell', 'bench'], difficulty: 'beginner', type: 'training', purpose: 'strengthen', ...over,
  })

  it('matches a muscle in the primary or the secondary slot', () => {
    expect(matchesFilters(entry(), { group: 'chest' })).toBe(true)
    expect(matchesFilters(entry(), { group: 'triceps' })).toBe(true)
    expect(matchesFilters(entry(), { group: 'quads' })).toBe(false)
  })

  it('combines the four axes and the level', () => {
    expect(matchesFilters(entry(), { material: 'bench', purpose: 'strengthen', type: 'training', difficulty: 'beginner' })).toBe(true)
    expect(matchesFilters(entry(), { material: 'cable' })).toBe(false)
    expect(matchesFilters(entry(), { difficulty: 'advanced' })).toBe(false)
    expect(matchesFilters(entry(), {})).toBe(true)
  })

  it('shows the coached exercises before the open catalogue', () => {
    const sorted = sortEntries([
      entry({ id: 'b', source: 'open', name: 'Bench' }),
      entry({ id: 'a', source: 'authored', name: 'Zercher' }),
    ])
    expect(sorted.map((e) => e.id)).toEqual(['a', 'b'])
  })
})
