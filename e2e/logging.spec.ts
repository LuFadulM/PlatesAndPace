import { expect, test } from '@playwright/test'
import { admin, completeOnboarding, createUser, hasSupabase, signIn, unique } from './helpers'

test.skip(!hasSupabase, 'needs a local Supabase stack')

/**
 * PLAN.md §11.4 spec 3: what an athlete logs changes the next session's load.
 * A strong set raises the estimated max, and the same lift next week opens at
 * a heavier suggestion.
 */
test('logs a workout and the result raises the next session\'s load', async ({ page }) => {
  const email = unique('beto')
  const user = await createUser(email)
  await signIn(page, email, 'en')
  await completeOnboarding(page, 'en', { name: 'Beto' })

  // Monday is the first gym day for the profile the helper builds. Strip links
  // always carry the date, so the same day next week is plain arithmetic.
  const strip = page.getByRole('list', { name: 'This week' })
  const monday = (await strip.getByRole('link').first().getAttribute('href')) ?? ''
  const mondayIso = /date=(\d{4}-\d{2}-\d{2})/.exec(monday)?.[1]
  expect(mondayIso).toBeTruthy()
  await page.goto(monday)
  await page.getByRole('button', { name: /Set my session/ }).click()

  // Open the primary lift (row A) and read what it suggests.
  const rowA = page.getByRole('button', { name: /^A\s/ }).first()
  const liftName = (await rowA.locator('span.font-semibold').first().textContent())?.trim() ?? ''
  expect(liftName.length).toBeGreaterThan(0)
  await rowA.click()
  const suggested = Number(await page.getByLabel('Load 1').getAttribute('placeholder'))
  expect(suggested).toBeGreaterThan(0)

  // Log every set well above the suggestion, comfortably: a strong signal.
  for (let i = 1; i <= 6; i += 1) {
    const load = page.getByLabel(`Load ${i}`)
    if ((await load.count()) === 0) break
    await load.fill(String(suggested + 10))
    await page.getByLabel(`Reps ${i}`).fill('8')
    await page.getByLabel(`RPE ${i}`).fill('7')
    await page.getByLabel(`Set done ${i}`).click()
  }

  await page.getByRole('button', { name: 'Finish session' }).click()
  await expect(page.getByText('Session done')).toBeVisible()

  const { data } = await admin().from('set_logs').select('kg, done').eq('user_id', user.id)
  expect(data?.length).toBeGreaterThan(0)
  expect(data?.every((s) => s.done)).toBe(true)

  // The same lift, next week: it recurs by design, and opens heavier.
  const next = new Date(`${mondayIso}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 7)
  await page.goto(`/en/today?date=${next.toISOString().slice(0, 10)}`)
  const nextRowA = page.getByRole('button', { name: /^A\s/ }).first()
  await expect(nextRowA.locator('span.font-semibold').first()).toHaveText(liftName)
  await nextRowA.click()
  const nextSuggested = Number(await page.getByLabel('Load 1').getAttribute('placeholder'))
  expect(nextSuggested).toBeGreaterThan(suggested)
})
