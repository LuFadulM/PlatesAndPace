import { expect, test } from '@playwright/test'
import { BASE_URL, hasSupabase, unique } from './helpers'

test.skip(!hasSupabase, 'needs a local Supabase')

/**
 * The way in that sends nothing.
 *
 * This is the whole point of having a password: an account is made and used
 * without an inbox, on any device, by anybody — no link to wait for and no
 * mailer quota to queue behind. If a message ever has to be opened for either
 * of these steps, this fails.
 */
test('a password makes an account and signs back in, with no email in the loop', async ({ page }) => {
  const email = unique('pw')
  const password = 'hyex-test-passphrase'

  await page.goto(`${BASE_URL}/en/sign-in`)
  await page.getByRole('button', { name: 'No account yet? Create one' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create my account' }).click()

  // A session straight away is the assertion: with confirmations on there would
  // be none, and this would sit on sign-in with "open the link we emailed you".
  await page.waitForURL(/\/en\/onboarding/, { timeout: 30_000 })

  await page.context().clearCookies()

  await page.goto(`${BASE_URL}/en/sign-in`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(/\/en\/(today|onboarding)/, { timeout: 30_000 })
})

test('a wrong password says so without revealing whether the account exists', async ({ page }) => {
  await page.goto(`${BASE_URL}/en/sign-in`)
  await page.getByLabel('Email').fill(unique('nobody'))
  await page.getByLabel('Password').fill('not-the-right-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('do not match an account')
})
