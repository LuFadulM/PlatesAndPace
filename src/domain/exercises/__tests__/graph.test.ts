import { describe, expect, it } from 'vitest'
import en from '../../../../messages/en.json'
import es from '../../../../messages/es.json'
import { buildSearchIndex, fold, isDoable, needsMaterial, progressionsOf, regressionsOf, search, substitutesFor } from '../graph'
import { EXERCISES, getExercise } from '../library'

type Catalog = { exercises: Record<string, Record<string, string>> }

function index() {
  return buildSearchIndex(
    EXERCISES.map((e) => ({
      id: e.id,
      texts: [en, es].flatMap((c) => {
        const entry = (c as Catalog).exercises[e.id]!
        return [entry.name!, ...(entry.aliases ?? '').split(',')]
      }),
    })),
  )
}

describe('substitution graph', () => {
  it('swaps a barbell bench for something the home athlete can press', () => {
    const subs = substitutesFor('bench_press', { equipment: 'dumbbells_bench' })
    expect(subs.length).toBeGreaterThan(0)
    for (const s of subs) {
      expect(s.movement).toBe('horizontal_push')
      expect(s.primary).toBe('chest')
      expect(s.equipment).toContain('dumbbells_bench')
    }
    expect(subs.map((s) => s.id)).toContain('dumbbell_bench_press')
  })

  it('never offers a banned pattern or an unavailable machine', () => {
    const subs = substitutesFor('back_squat', {
      equipment: 'full_gym',
      unavailableMachines: ['leg_press', 'hack_squat'],
      bannedPatterns: new Set(['deep_knee_flexion']),
    })
    for (const s of subs) {
      expect(s.machineId).not.toBe('leg_press')
      expect(s.machineId).not.toBe('hack_squat')
      expect(s.patterns).not.toContain('deep_knee_flexion')
    }
  })

  it('caps substitutes at the athlete tier and lists authored edges first', () => {
    const subs = substitutesFor('pull_up', { equipment: 'full_gym', maxDifficulty: 'beginner' })
    for (const s of subs) expect(s.minTier).toBe('beginner')
    const full = substitutesFor('pull_up', { equipment: 'full_gym' })
    const authored = new Set([...(getExercise('pull_up').regressions ?? []), ...(getExercise('pull_up').progressions ?? [])])
    const firstNonAuthored = full.findIndex((s) => !authored.has(s.id))
    const lastAuthored = full.map((s) => authored.has(s.id)).lastIndexOf(true)
    if (firstNonAuthored >= 0 && lastAuthored >= 0) expect(lastAuthored).toBeLessThan(firstNonAuthored)
  })

  it('walks regressions and progressions along the same movement', () => {
    const down = regressionsOf('pull_up')
    const up = progressionsOf('push_up')
    expect(down.length).toBeGreaterThan(0)
    expect(up.length).toBeGreaterThan(0)
    const rank = { beginner: 0, intermediate: 1, advanced: 2 }
    for (const e of down) expect(rank[e.minTier]).toBeLessThanOrEqual(rank[getExercise('pull_up').minTier])
    for (const e of up) expect(['chest', 'triceps']).toContain(e.primary)
  })

  it('knows what needs a barbell', () => {
    expect(needsMaterial(getExercise('back_squat'), 'barbell')).toBe(true)
    expect(needsMaterial(getExercise('goblet_squat'), 'barbell')).toBe(false)
    expect(isDoable(getExercise('back_squat'), { equipment: 'home_none' })).toBe(false)
  })
})

describe('bilingual search', () => {
  it('folds accents and case', () => {
    expect(fold('Sentadilla búlgara')).toBe('sentadilla bulgara')
    expect(fold("Farmer's walk")).toBe('farmer s walk')
  })

  it('finds the same row from an English name, a Spanish name and an alias', () => {
    const idx = index()
    expect(search(idx, 'bench press')).toContain('bench_press')
    expect(search(idx, 'press de banca')).toContain('bench_press')
    expect(search(idx, 'RDL')).toContain('romanian_deadlift')
    expect(search(idx, 'dominadas')[0]).toBe('pull_up')
  })

  it('returns nothing for an empty query and ranks exact words first', () => {
    const idx = index()
    expect(search(idx, '  ')).toEqual([])
    expect(search(idx, 'squat')[0]).toMatch(/squat/)
  })
})
