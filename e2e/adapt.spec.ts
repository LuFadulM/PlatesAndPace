import { expect, test } from '@playwright/test'
import { admin, completeOnboarding, createUser, hasSupabase, signIn, unique } from './helpers'

test.skip(!hasSupabase, 'needs a local Supabase stack')

const BOGOTA = 'America/Bogota'
/** The onboarding helper books Monday, Wednesday and Friday. */
const GYM_WEEKDAYS = [1, 3, 5]

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** A gym day inside the current plan week, today or later; null if the week is spent. */
function gymDayThisWeek(): string | null {
  const today = todayIso()
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay() || 7
  for (let offset = 0; weekday + offset <= 7; offset += 1) {
    const candidate = shift(today, offset)
    if (GYM_WEEKDAYS.includes(new Date(`${candidate}T00:00:00Z`).getUTCDay())) return candidate
  }
  return null
}

/**
 * The coaching rule that a movement which keeps hurting comes out of the plan
 * (CLAUDE.md, rule 2). Two reports on the same lift reach the athlete as an
 * offer of an easy week, naming the lift.
 */
test('a movement that hurts twice brings up the easy week', async ({ page }) => {
  const email = unique('pain')
  const user = await createUser(email)

  const today = todayIso()
  for (const date of [shift(today, -7), shift(today, -4)]) {
    await admin().from('session_logs').insert({ user_id: user.id, date, done: true, pain: { back_squat: 3 } })
  }

  await signIn(page, email, 'en')
  await completeOnboarding(page, 'en', { name: 'Pia' })
  await page.goto('/en/today')

  const card = page.getByRole('region', { name: 'Time for an easy week' })
  await expect(card).toBeVisible()
  await expect(card).toContainText(/hurt more than once/i)
  await expect(card).toContainText(/squat/i)

  await card.getByRole('button', { name: 'Take an easy week' }).click()
  await expect(page.getByText('This week is a deload. Light and easy on purpose.')).toBeVisible()
})

/** Taking the easy week has to actually lighten the work, not just say so. */
test('taking the easy week shortens the session', async ({ page }) => {
  const gymDate = gymDayThisWeek()
  test.skip(gymDate === null, 'no gym day left in the current week')

  const email = unique('easy')
  const user = await createUser(email)
  const today = todayIso()
  for (const date of [shift(today, -7), shift(today, -4)]) {
    await admin().from('session_logs').insert({ user_id: user.id, date, done: true, pain: { back_squat: 3 } })
  }

  await signIn(page, email, 'en')
  await completeOnboarding(page, 'en', { name: 'Eve' })
  await page.goto(`/en/today?date=${gymDate}`)

  const rows = page.getByRole('list', { name: 'Exercises' }).locator(':scope > li')
  const setsBefore = await rows.count()
  expect(setsBefore).toBeGreaterThan(0)
  const estimate = page.getByText(/\d+\s*min/).first()
  const minutes = async () => Number(/(\d+)\s*min/.exec((await estimate.textContent()) ?? '')?.[1] ?? 0)
  const before = await minutes()

  await page.getByRole('region', { name: 'Time for an easy week' }).getByRole('button', { name: 'Take an easy week' }).click()
  await expect(page.getByText('This week is a deload. Light and easy on purpose.')).toBeVisible()

  expect(await minutes()).toBeLessThan(before)
})

/**
 * Reporting pain is per movement and survives a reload, because an athlete who
 * taps it mid-session should not find it gone when they come back.
 */
test('reports joint pain on one exercise and keeps it across a reload', async ({ page }) => {
  const gymDate = gymDayThisWeek()
  test.skip(gymDate === null, 'no gym day left in the current week')

  const email = unique('report')
  await createUser(email)
  await signIn(page, email, 'en')
  await completeOnboarding(page, 'en', { name: 'Rae' })
  await page.goto(`/en/today?date=${gymDate}`)

  const rows = page.getByRole('list', { name: 'Exercises' }).locator(':scope > li')
  await expect(rows.first()).toBeVisible()
  await rows.first().getByRole('button').first().click()

  const group = page.getByRole('group', { name: 'Did this hurt a joint?' }).first()
  await group.getByRole('button', { name: 'It hurt' }).click()
  await expect(page.getByText(/Noted\.|hurt before/i).first()).toBeVisible()

  await page.reload()
  await rows.first().getByRole('button').first().click()
  const reloaded = page.getByRole('group', { name: 'Did this hurt a joint?' }).first()
  await expect(reloaded.getByRole('button', { name: 'It hurt' })).toHaveAttribute('aria-pressed', 'true')
})
