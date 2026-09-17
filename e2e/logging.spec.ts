import { expect, test } from '@playwright/test'
import { admin, completeOnboarding, createUser, hasSupabase, signIn, unique } from './helpers'

test.skip(!hasSupabase, 'needs a local Supabase stack')

test('logs a workout and a high RPE lowers the next load', async ({ page }) => {
  const email = unique('beto')
  const user = await createUser(email)
  await signIn(page, email, 'en')
  await completeOnboarding(page, 'en', { name: 'Beto' })

  // Find the first gym day in the week strip and open it.
  const strip = page.getByRole('list', { name: 'This week' })
  await strip.getByRole('link').first().click()
  await page.getByRole('button', { name: /Set my session/ }).click()

  const firstExercise = page.getByRole('list').filter({ has: page.getByRole('button', { expanded: false }) }).getByRole('button').first()
  await firstExercise.click()
  const suggested = Number(await page.getByLabel('Load 1').getAttribute('placeholder'))
  await page.getByLabel('Load 1').fill(String(suggested))
  await page.getByLabel('Reps 1').fill('8')
  await page.getByLabel('RPE 1').fill('10') // much harder than target
  await page.getByLabel('Set done 1').click()

  // Within-session autoregulation: set 2 suggests less than set 1.
  const next = Number(await page.getByLabel('Load 2').getAttribute('placeholder'))
  expect(next).toBeLessThan(suggested)

  await page.getByRole('button', { name: 'Finish session' }).click()
  await expect(page.getByText('Session done')).toBeVisible()

  const { data } = await admin().from('set_logs').select('kg, reps, rpe, done').eq('user_id', user.id)
  expect(data?.length).toBeGreaterThan(0)
  expect(data?.[0]?.done).toBe(true)
})
