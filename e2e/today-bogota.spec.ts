import { expect, test } from '@playwright/test'
import { completeOnboarding, createUser, hasSupabase, signIn, unique } from './helpers'

test.skip(!hasSupabase, 'needs a local Supabase stack')

test.use({ timezoneId: 'America/Bogota' })

test('the calendar shows the correct "today" for Bogotá late in the evening', async ({ page }) => {
  // 21:00 in Bogotá on Tuesday 15 September 2026 is already Wednesday in UTC.
  await page.clock.setFixedTime(new Date('2026-09-16T02:00:00Z'))
  const email = unique('tz')
  await createUser(email)
  await signIn(page, email, 'es')
  await completeOnboarding(page, 'es', { name: 'Zona' })
  await page.goto('/es/today')
  await expect(page.getByText('Hoy')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('martes, 15 de septiembre')
  await page.goto('/es/plan')
  await expect(page.getByRole('button', { name: '2026-09-15' })).toHaveAttribute('aria-current', 'date')
})
