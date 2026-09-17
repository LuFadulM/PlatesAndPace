import { expect, test } from '@playwright/test'
import { completeOnboarding, createUser, hasSupabase, signIn, unique } from './helpers'

test.skip(!hasSupabase, 'needs a local Supabase stack')

test('joins a group with an invite code and sees only names, sessions and streaks', async ({ browser }) => {
  const owner = await browser.newPage()
  const ownerEmail = unique('owner')
  await createUser(ownerEmail)
  await signIn(owner, ownerEmail, 'en')
  await completeOnboarding(owner, 'en', { name: 'Owner' })
  await owner.goto('/en/group')
  await owner.getByLabel('Create a group').fill('Bogotá crew')
  await owner.getByRole('button', { name: 'Create' }).click()
  const code = (await owner.getByText(/^[A-HJ-NP-Z2-9]{6}$/).first().textContent())?.trim() ?? ''
  expect(code).toHaveLength(6)

  const member = await browser.newPage()
  const memberEmail = unique('member')
  await createUser(memberEmail)
  await signIn(member, memberEmail, 'es')
  await completeOnboarding(member, 'es', { name: 'Carla' })
  await member.goto('/es/group')
  await member.getByLabel(/código de 6 caracteres/i).fill(code)
  await member.getByRole('button', { name: 'Unirme' }).click()
  await expect(member.getByRole('cell', { name: /Owner/ })).toBeVisible()
  await expect(member.getByRole('cell', { name: /Carla/ })).toBeVisible()
  // No weights or body data anywhere on the group page.
  await expect(member.getByText(/kg|cm/)).toHaveCount(0)
})
