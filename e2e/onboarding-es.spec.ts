import { expect, test } from '@playwright/test'
import { completeOnboarding, createUser, hasSupabase, signIn, unique } from './helpers'

test.skip(!hasSupabase, 'needs a local Supabase stack')

test('signs up and completes onboarding in Spanish', async ({ page }) => {
  const email = unique('ana')
  await createUser(email)
  await signIn(page, email, 'es')
  await completeOnboarding(page, 'es', { name: 'Ana' })
  await expect(page.getByText(/hoy|mañana|ayer/i).first()).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()
})
