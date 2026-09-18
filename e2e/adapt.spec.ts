import { expect, test } from '@playwright/test'
import { admin, completeOnboarding, createUser, hasSupabase, signIn, unique } from './helpers'

test.skip(!hasSupabase, 'needs a local Supabase stack')

/** The app's own clock: the browser runs in Bogotá, so the profile does too. */
const BOGOTA = 'America/Bogota'

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function todayWeekday(): number {
  return new Date(`${todayIso()}T00:00:00Z`).getUTCDay() || 7
}

/**
 * Today, plus one other day because the questionnaire wants at least two gym
 * days. Booking today means it always carries a session, so neither test
 * depends on which day CI runs on.
 */
function gymWeekdays(): number[] {
  const today = todayWeekday()
  return [today, today === 1 ? 3 : 1]
}

/** Two past sessions where the same movement hurt. Reported, not inferred. */
async function seedPain(userId: string, exerciseId: string) {
  const today = todayIso()
  for (const date of [shift(today, -7), shift(today, -4)]) {
    await admin().from('session_logs').insert({ user_id: userId, date, done: true, pain: { [exerciseId]: 3 } })
  }
}

/**
 * The coaching rule that a movement which keeps hurting comes out of the plan
 * (CLAUDE.md, rule 2). Two reports reach the athlete as an offer of an easy
 * week that names the lift, and taking it has to lighten the work rather than
 * only announce itself.
 */
test('a movement that hurts twice brings up the easy week, and taking it lightens the session', async ({ page }) => {
  const email = unique('pain')
  const user = await createUser(email)
  await seedPain(user.id, 'back_squat')

  await signIn(page, email, 'en')
  await completeOnboarding(page, 'en', { name: 'Pia', gymWeekdays: gymWeekdays() })
  await page.goto(`/en/today?date=${todayIso()}`)

  const card = page.getByRole('region', { name: 'Time for an easy week' })
  await expect(card).toBeVisible()
  await expect(card).toContainText(/hurt more than once/i)
  await expect(card).toContainText(/squat/i)

  // The session estimate, "~48 min", is the first minutes on the page.
  const estimate = page.getByText(/~\s*\d+\s*min/).first()
  const minutes = async () => Number(/(\d+)\s*min/.exec((await estimate.textContent()) ?? '')?.[1] ?? 0)
  const before = await minutes()
  expect(before).toBeGreaterThan(0)

  await card.getByRole('button', { name: 'Take an easy week' }).click()
  await expect(page.getByText('This week is a deload. Light and easy on purpose.')).toBeVisible()

  expect(await minutes()).toBeLessThan(before)
})

/**
 * Reporting pain is per movement and survives a reload, because an athlete who
 * taps it mid-session should not find it gone when they come back.
 */
test('reports joint pain on one exercise and keeps it across a reload', async ({ page }) => {
  const email = unique('report')
  await createUser(email)
  await signIn(page, email, 'en')
  // Pain is reported against a session that has happened, so the fixture books
  // the gym on today rather than a day the athlete has not reached yet.
  await completeOnboarding(page, 'en', { name: 'Rae', gymWeekdays: gymWeekdays() })
  await page.goto(`/en/today?date=${todayIso()}`)

  const rows = page.getByRole('list', { name: 'Exercises' }).locator(':scope > li')
  await expect(rows.first()).toBeVisible()
  await rows.first().getByRole('button').first().click()

  const group = page.getByRole('group', { name: 'Did this hurt a joint?' }).first()
  const hurt = group.getByRole('button', { name: 'It hurt' })
  await hurt.click()

  // The confirmation only appears once the write has landed, so waiting for it
  // here is what stops the reload below cancelling the request in flight.
  await expect(page.getByText(/Noted\.|hurt before/i).first()).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(hurt).toHaveAttribute('aria-pressed', 'true')

  await page.reload()
  await rows.first().getByRole('button').first().click()
  const reloaded = page.getByRole('group', { name: 'Did this hurt a joint?' }).first()
  await expect(reloaded.getByRole('button', { name: 'It hurt' })).toHaveAttribute('aria-pressed', 'true')
})
