import { describe, expect, it } from 'vitest'
import { NUTRITION_NOTE_KEYS } from '../src/domain/nutrition'
import en from '../messages/en.json'
import es from '../messages/es.json'

type MessageTree = { [key: string]: string | MessageTree }

const catalogs: Record<string, MessageTree> = { en, es }

function flatten(tree: MessageTree, prefix = ''): Map<string, string> {
  const flat = new Map<string, string>()
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') flat.set(path, value)
    else for (const [nested, nestedValue] of flatten(value, path)) flat.set(nested, nestedValue)
  }
  return flat
}

/** ICU placeholders: `{count}`, `{name, plural, ...}` → the bare argument names. */
function placeholders(message: string): Set<string> {
  const found = new Set<string>()
  for (const match of message.matchAll(/\{\s*(\w+)/g)) found.add(match[1]!)
  return found
}

/**
 * Keys whose Spanish value is meant to match the English one — product names
 * and other proper nouns. Anything not listed here that matches is a
 * translation someone forgot to write.
 */
const IDENTICAL_BY_DESIGN = new Set(['app.name', 'locale.en', 'locale.es', 'today.km', 'run.perKm', 'onboarding.steps.basics.metric', 'onboarding.steps.basics.imperial', 'settings.metric', 'settings.imperial', 'landing.demo.estimate', 'landing.demo.sets', 'landing.demo.rpe', 'today.grams', 'today.estimate'])

const flat = Object.fromEntries(
  Object.entries(catalogs).map(([locale, tree]) => [locale, flatten(tree)]),
) as Record<string, Map<string, string>>

/**
 * PLAN.md §4: the build fails if the catalogues drift apart. A missing Spanish
 * key is a bug users see, so it is a test failure, not a fallback.
 */
describe('message catalogues', () => {
  const locales = Object.keys(catalogs)

  it.each(locales)('%s has no empty or placeholder-only strings', (locale) => {
    const offenders = [...flat[locale]!.entries()]
      .filter(([, value]) => value.trim().length === 0 || value.trim() === 'TODO')
      .map(([key]) => key)

    expect(offenders).toEqual([])
  })

  it('en and es define exactly the same keys', () => {
    const enKeys = [...flat.en!.keys()].sort()
    const esKeys = [...flat.es!.keys()].sort()

    expect(esKeys.filter((key) => !flat.en!.has(key))).toEqual([])
    expect(enKeys.filter((key) => !flat.es!.has(key))).toEqual([])
  })

  it('matching keys use the same ICU placeholders in both languages', () => {
    const mismatches: string[] = []

    for (const [key, enValue] of flat.en!) {
      const esValue = flat.es!.get(key)
      if (esValue === undefined) continue

      const enArgs = [...placeholders(enValue)].sort()
      const esArgs = [...placeholders(esValue)].sort()
      if (enArgs.join(',') !== esArgs.join(',')) {
        mismatches.push(`${key}: en{${enArgs}} vs es{${esArgs}}`)
      }
    }

    expect(mismatches).toEqual([])
  })

  it('does not leave English text sitting in the Spanish catalogue', () => {
    const suspicious = [...flat.es!.entries()]
      .filter(([key, value]) => {
        if (IDENTICAL_BY_DESIGN.has(key)) return false
        const enValue = flat.en!.get(key)
        // Short strings are often legitimately identical across the two
        // languages ("Plan", "Total"); a longer identical string is untranslated.
        return enValue !== undefined && enValue === value && value.split(/\s+/).length > 2
      })
      .map(([key]) => key)

    expect(suspicious).toEqual([])
  })

  it('defines every message key the domain engine emits', () => {
    const missing: string[] = []

    for (const key of NUTRITION_NOTE_KEYS) {
      for (const locale of Object.keys(catalogs)) {
        if (!flat[locale]!.has(key)) missing.push(`${locale}:${key}`)
      }
    }

    expect(missing).toEqual([])
  })
})
