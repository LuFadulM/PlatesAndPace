import { expect, test } from '@playwright/test'

/** Runs without Supabase: the public surface must work with no backend at all. */
test('serves both languages and the install manifest', async ({ page }) => {
  await page.goto('/en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Training that adapts to you')
  await page.goto('/es')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrenamiento que se adapta a ti')
  await page.goto('/es/sign-in')
  await expect(page.getByRole('button', { name: 'Enviarme el enlace' })).toBeVisible()
  const manifest = await page.request.get('/manifest.webmanifest')
  expect(manifest.ok()).toBe(true)
  expect((await manifest.json()).name).toBe('Plates & Pace')
})

test('has no horizontal overflow at 390px', async ({ page }) => {
  for (const path of ['/en', '/es/sign-in', '/en/privacy']) {
    await page.goto(path)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow, path).toBe(false)
  }
})
