import { expect, test } from '@playwright/test'
import { admin, completeOnboarding, createUser, hasSupabase, signIn, unique } from './helpers'

test.skip(!hasSupabase, 'needs a local Supabase stack')

/**
 * The athlete's hand on the day: swap a lift, add one, change its numbers,
 * drop it. Each change is stored and comes back after a reload, and a
 * permanent swap reaches every later day of the block that held the old lift.
 */
test('edits a session: swap, add, edit the numbers, remove', async ({ page }) => {
  const email = unique('edit')
  const user = await createUser(email)
  await signIn(page, email, 'en')
  await completeOnboarding(page, 'en', { name: 'Edi' })

  // First gym day on or after today (the helper's schedule is Mon/Wed/Fri).
  const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const cursor = new Date(`${todayIso}T00:00:00Z`)
  while (![1, 3, 5].includes(cursor.getUTCDay())) cursor.setUTCDate(cursor.getUTCDate() + 1)
  const gymIso = cursor.toISOString().slice(0, 10)
  await page.goto(`/en/today?date=${gymIso}`)

  const rows = page.getByRole('list', { name: 'Exercises' }).locator(':scope > li')
  const before = await rows.count()
  expect(before).toBeGreaterThan(2)
  const nameOf = async (row: ReturnType<typeof rows.nth>) => (await row.locator('span.font-semibold').first().textContent())?.trim() ?? ''

  // Swap B for the first alternative, permanently.
  const rowB = rows.nth(1)
  const nameB = await nameOf(rowB)
  await rowB.getByRole('button').first().click()
  await page.getByRole('button', { name: 'Swap', exact: true }).click()
  await page.getByRole('button', { name: 'Always' }).click()
  const firstAlternative = page.getByRole('list', { name: 'Swap for…' }).locator(':scope > li').first().getByRole('button')
  const newName = await nameOf(firstAlternative)
  expect(newName).not.toBe(nameB)
  await firstAlternative.click()
  await expect(rows.nth(1).locator('span.font-semibold').first()).toHaveText(newName)
  await expect(rows).toHaveCount(before)

  // Stored as a permanent preference, and applied ahead: no later day keeps
  // the old lift without the new one.
  const { data: prefs } = await admin().from('exercise_preferences').select('scope, from_exercise_id, to_exercise_id').eq('user_id', user.id)
  const pref = prefs?.find((p) => p.scope === 'global')
  expect(pref).toBeTruthy()
  const { data: later } = await admin().from('planned_sessions').select('content').eq('user_id', user.id).gt('date', gymIso)
  for (const row of later ?? []) {
    const ids = ((row.content as { gym?: { exercises: { exerciseId: string }[] } }).gym?.exercises ?? []).map((e) => e.exerciseId)
    if (ids.includes(pref!.from_exercise_id)) expect(ids).toContain(pref!.to_exercise_id)
  }

  // Add an exercise from the catalogue.
  await page.getByRole('button', { name: 'Add an exercise' }).click()
  await page.getByRole('group', { name: 'Filter by muscle' }).getByRole('button', { name: 'Abs', exact: true }).click()
  const pick = page.getByRole('list', { name: 'Add an exercise' }).locator(':scope > li').first().getByRole('button')
  const pickedName = await nameOf(pick)
  await pick.click()
  await expect(rows).toHaveCount(before + 1)
  await expect(rows.last()).toContainText(pickedName)

  // Change its numbers.
  await rows.last().getByRole('button').first().click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Sets', { exact: true }).fill('5')
  await page.getByLabel('Min reps').fill('8')
  await page.getByLabel('Max reps').fill('10')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(rows.last()).toContainText('5 × 8–10')
  await expect(rows.last()).toContainText('0/5')

  // Stored, not just shown.
  await page.reload()
  await expect(rows).toHaveCount(before + 1)
  await expect(rows.last()).toContainText('5 × 8–10')

  // And gone again.
  await rows.last().getByRole('button').first().click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await page.getByRole('button', { name: 'Yes, remove' }).click()
  await expect(rows).toHaveCount(before)
})
