import type { Macros } from '.'

/**
 * What the athlete ate, against what the day asked for.
 *
 * The engine already computes a calorie and macro target; until now nothing
 * closed the loop. Entries are the athlete's own words and their own numbers:
 * the brief's food databases are unreachable, and inventing macros for a named
 * food would be fabricating a nutritional claim (CLAUDE.md, rule 9). The
 * arithmetic here is deliberately plain, because a number an athlete cannot
 * reproduce in their head is a number they will not trust.
 */
export interface FoodEntry {
  id: string
  name: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface IntakeTotals {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export const NO_INTAKE: IntakeTotals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }

export function sumIntake(entries: readonly FoodEntry[]): IntakeTotals {
  return entries.reduce<IntakeTotals>(
    (total, e) => ({
      kcal: total.kcal + e.kcal,
      proteinG: total.proteinG + e.proteinG,
      carbsG: total.carbsG + e.carbsG,
      fatG: total.fatG + e.fatG,
    }),
    NO_INTAKE,
  )
}

export interface IntakeProgress {
  eaten: IntakeTotals
  /** Target minus eaten; negative once the athlete is over. */
  remaining: IntakeTotals
  /** Eaten as a fraction of target, 0 when the target is 0. Not clamped. */
  fraction: { kcal: number; proteinG: number; carbsG: number; fatG: number }
}

const share = (eaten: number, target: number) => (target > 0 ? eaten / target : 0)

/**
 * Progress against the day's numbers. Remaining is allowed to go negative
 * rather than clamping at zero: an athlete who is four hundred over should be
 * told by how much, not shown a comfortable nought.
 */
export function intakeProgress(entries: readonly FoodEntry[], targetKcal: number, macros: Macros): IntakeProgress {
  const eaten = sumIntake(entries)
  return {
    eaten,
    remaining: {
      kcal: targetKcal - eaten.kcal,
      proteinG: macros.proteinG - eaten.proteinG,
      carbsG: macros.carbsG - eaten.carbsG,
      fatG: macros.fatG - eaten.fatG,
    },
    fraction: {
      kcal: share(eaten.kcal, targetKcal),
      proteinG: share(eaten.proteinG, macros.proteinG),
      carbsG: share(eaten.carbsG, macros.carbsG),
      fatG: share(eaten.fatG, macros.fatG),
    },
  }
}

/**
 * The athlete's own most-used entries, newest-first within equal counts, for
 * one-tap repeats. Names are matched case- and accent-insensitively so "Pollo"
 * and "pollo" are the same food, and the macros come from the most recent time
 * they logged it rather than an average, because that is the portion they will
 * recognise.
 */
export interface FrequentFood extends Omit<FoodEntry, 'id'> {
  /** How many times this food has been logged in the window. */
  times: number
}

export function fold(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** `history` is oldest first, as the reader returns it. */
export function frequentFoods(history: readonly FoodEntry[], limit = 6): FrequentFood[] {
  const byName = new Map<string, FrequentFood>()
  for (const entry of history) {
    const key = fold(entry.name)
    if (key.length === 0) continue
    const seen = byName.get(key)
    // Later entries overwrite the macros: the most recent portion wins.
    byName.set(key, {
      name: entry.name,
      kcal: entry.kcal,
      proteinG: entry.proteinG,
      carbsG: entry.carbsG,
      fatG: entry.fatG,
      times: (seen?.times ?? 0) + 1,
    })
  }
  return [...byName.values()].sort((a, b) => b.times - a.times).slice(0, limit)
}
