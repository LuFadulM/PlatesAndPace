import { expect, test } from '@playwright/test'

/** Runs without Supabase: the public surface must work with no backend at all. */
test('serves both languages and the install manifest', async ({ page }) => {
  await page.goto('/en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Training that adapts to you')
  await expect(page.getByRole('link', { name: 'Get started' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible()
  // The language switch keeps the visitor on the page they were reading.
  await page.getByRole('link', { name: 'Español' }).first().click()
  await expect(page).toHaveURL(/\/es$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrenamiento que se adapta a ti')
  await expect(page.getByRole('link', { name: 'Empezar' }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Iniciar sesión' }).first().click()
  await expect(page).toHaveURL(/\/es\/sign-in$/)
  // The password form leads now; the emailed link is a fallback behind a
  // toggle, so it is no longer the button this screen renders first.
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
  const manifest = await page.request.get('/manifest.webmanifest')
  expect(manifest.ok()).toBe(true)
  expect((await manifest.json()).name).toBe('Hyex')
})

test('has no horizontal overflow at 390px', async ({ page }) => {
  // Both landings: Spanish has the longest words, and any overflow widens the
  // mobile layout viewport, which also throws off taps near the bottom.
  for (const path of ['/en', '/es', '/es/sign-in', '/en/privacy']) {
    await page.goto(path)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow, path).toBe(false)
  }
})
