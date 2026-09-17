import { expect, test } from '@playwright/test'
import { completeOnboarding, createUser, hasSupabase, signIn, unique } from './helpers'

test.skip(!hasSupabase, 'needs a local Supabase stack')

test.use({ timezoneId: 'America/Bogota' })

/**
 * PLAN.md §11.4 spec 6. "Today" is computed on the server in the athlete's
 * zone, so a fixed browser clock cannot drive it; instead the spec derives the
 * Bogotá date of the real current instant and checks the app agrees. Between
 * 19:00 and midnight in Bogotá that date differs from the UTC date, which is
 * exactly the case that matters — and the unit suite pins 15 September 2026
 * at 21:00 with an injected clock.
 */
test('the calendar shows the correct "today" for Bogotá', async ({ page }) => {
  const now = new Date()
  const bogotaIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const utcIso = now.toISOString().slice(0, 10)
  const longDate = new Intl.DateTimeFormat('es', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${bogotaIso}T00:00:00Z`))

  const email = unique('tz')
  await createUser(email)
  await signIn(page, email, 'es')
  await completeOnboarding(page, 'es', { name: 'Zona' })

  await page.goto('/es/today')
  await expect(page.locator('p', { hasText: /^Hoy$/ })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(longDate)
  if (bogotaIso !== utcIso) {
    // Late evening in Bogotá: the UTC date is already tomorrow, and must not show.
    const utcLong = new Intl.DateTimeFormat('es', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${utcIso}T00:00:00Z`))
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText(utcLong)
  }

  await page.goto('/es/plan')
  await expect(page.getByRole('button', { name: bogotaIso })).toHaveAttribute('aria-current', 'date')
})
