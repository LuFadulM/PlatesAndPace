import { describe, expect, it } from 'vitest'
import { fold, frequentFoods, intakeProgress, sumIntake, type FoodEntry } from '../intake'

const entry = (over: Partial<FoodEntry> & { id: string; name: string }): FoodEntry => ({
  kcal: 100, proteinG: 10, carbsG: 5, fatG: 3, ...over,
})

const macros = { proteinG: 140, fatG: 60, carbsG: 250, fibreG: 30 }

describe('sumIntake', () => {
  it('is zero for a day with nothing logged', () => {
    expect(sumIntake([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })
  })

  it('adds every entry', () => {
    const total = sumIntake([
      entry({ id: '1', name: 'Eggs', kcal: 220, proteinG: 18, carbsG: 2, fatG: 15 }),
      entry({ id: '2', name: 'Rice', kcal: 300, proteinG: 6, carbsG: 65, fatG: 1 }),
    ])
    expect(total).toEqual({ kcal: 520, proteinG: 24, carbsG: 67, fatG: 16 })
  })
})

describe('intakeProgress', () => {
  it('reports the whole target as remaining before anything is eaten', () => {
    const progress = intakeProgress([], 2400, macros)
    expect(progress.remaining.kcal).toBe(2400)
    expect(progress.remaining.proteinG).toBe(140)
    expect(progress.fraction.kcal).toBe(0)
  })

  it('counts down as the day fills up', () => {
    const progress = intakeProgress([entry({ id: '1', name: 'Lunch', kcal: 600, proteinG: 40, carbsG: 70, fatG: 15 })], 2400, macros)
    expect(progress.eaten.kcal).toBe(600)
    expect(progress.remaining.kcal).toBe(1800)
    expect(progress.remaining.proteinG).toBe(100)
    expect(progress.fraction.kcal).toBeCloseTo(0.25, 5)
  })

  it('says by how much the athlete is over rather than showing a comfortable zero', () => {
    const progress = intakeProgress([entry({ id: '1', name: 'Everything', kcal: 2800, proteinG: 150, carbsG: 300, fatG: 90 })], 2400, macros)
    expect(progress.remaining.kcal).toBe(-400)
    expect(progress.remaining.proteinG).toBe(-10)
    expect(progress.fraction.kcal).toBeGreaterThan(1)
  })

  it('does not divide by a zero target', () => {
    const progress = intakeProgress([entry({ id: '1', name: 'X' })], 0, { proteinG: 0, fatG: 0, carbsG: 0, fibreG: 0 })
    expect(Number.isFinite(progress.fraction.kcal)).toBe(true)
    expect(progress.fraction.kcal).toBe(0)
  })
})

describe('frequentFoods', () => {
  it('has nothing to offer a new athlete', () => {
    expect(frequentFoods([])).toEqual([])
  })

  it('breaks a tie by what was eaten most recently', () => {
    // Both logged twice. The one the athlete has eaten most recently is the one
    // they are likeliest to want again, so it leads — a Map would otherwise keep
    // them in the order they were first eaten, which is exactly backwards.
    const history = [
      entry({ id: '1', name: 'Avena' }),
      entry({ id: '2', name: 'Avena' }),
      entry({ id: '3', name: 'Huevos' }),
      entry({ id: '4', name: 'Huevos' }),
    ]
    expect(frequentFoods(history).map((f) => f.name)).toEqual(['Huevos', 'Avena'])
  })

  it('ranks by how often each food was logged', () => {
    const history = [
      entry({ id: '1', name: 'Pollo' }),
      entry({ id: '2', name: 'Arroz' }),
      entry({ id: '3', name: 'Pollo' }),
      entry({ id: '4', name: 'Pollo' }),
    ]
    const frequent = frequentFoods(history)
    expect(frequent[0]!.name).toBe('Pollo')
    expect(frequent[0]!.times).toBe(3)
    expect(frequent[1]!.times).toBe(1)
  })

  it('treats the same food written differently as one food', () => {
    const frequent = frequentFoods([
      entry({ id: '1', name: 'Plátano' }),
      entry({ id: '2', name: 'platano' }),
      entry({ id: '3', name: 'PLÁTANO ' }),
    ])
    expect(frequent).toHaveLength(1)
    expect(frequent[0]!.times).toBe(3)
  })

  it('offers the portion they logged most recently, not an average', () => {
    const frequent = frequentFoods([
      entry({ id: '1', name: 'Avena', kcal: 150 }),
      entry({ id: '2', name: 'Avena', kcal: 300 }),
    ])
    expect(frequent[0]!.kcal).toBe(300)
  })

  it('keeps the list short enough to tap through', () => {
    const history = Array.from({ length: 20 }, (_, i) => entry({ id: String(i), name: `Food ${i}` }))
    expect(frequentFoods(history)).toHaveLength(6)
    expect(frequentFoods(history, 3)).toHaveLength(3)
  })

  it('ignores an entry whose name is only whitespace', () => {
    expect(frequentFoods([entry({ id: '1', name: '   ' })])).toEqual([])
  })
})

describe('fold', () => {
  it('strips accents, case and extra spaces', () => {
    expect(fold('  Plátano   Maduro ')).toBe('platano maduro')
  })
})
