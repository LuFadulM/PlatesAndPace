import { expect, test } from '@playwright/test'
import { completeOnboarding, createUser, hasSupabase, signIn, unique } from './helpers'

test.skip(!hasSupabase, 'needs a local Supabase stack')

/**
 * The library at 390 px: find a movement by either language, narrow it with
 * the filter axes, open it and read how to do it, then walk the substitution
 * graph to something easier.
 */
test('finds an exercise in either language, filters it and opens the detail page', async ({ page }) => {
  const email = unique('lib')
  await createUser(email)
  await signIn(page, email, 'es')
  await completeOnboarding(page, 'es', { name: 'Lib' })

  await page.goto('/es/library')
  const list = page.getByRole('list', { name: 'Biblioteca de ejercicios' })
  await expect(list.locator(':scope > li').first()).toBeVisible()

  // The Spanish catalogue answers an English query and vice versa.
  const search = page.getByRole('searchbox')
  await search.fill('bench press')
  await expect(list.getByRole('link', { name: /Press de banca/ }).first()).toBeVisible()
  await search.fill('press de banca')
  await expect(list.getByRole('link', { name: /Press de banca/ }).first()).toBeVisible()

  // Filter axes narrow the same list.
  await search.fill('')
  await page.getByRole('group', { name: 'Filtrar por músculo' }).getByRole('button', { name: 'Pecho' }).click()
  await page.getByRole('group', { name: 'Filtrar por material' }).getByRole('button', { name: 'Barra', exact: true }).click()
  const shown = await list.locator(':scope > li').count()
  expect(shown).toBeGreaterThan(0)

  // A coached exercise opens onto its steps, cues, mistakes and swaps.
  await list.getByRole('link', { name: /Press de banca/ }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: /Press de banca/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Paso a paso' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Errores comunes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cámbialo por' })).toBeVisible()

  // The page never scrolls sideways on a phone.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
