import { createClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export const hasSupabase = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY)

/** Service-role client: creates users and reads across RLS for assertions. */
export function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
}

export async function createUser(email: string) {
  const { data, error } = await admin().auth.admin.createUser({ email, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('no user')
  return data.user
}

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

/**
 * Signs the browser in the way a real magic link does, minus the inbox: the
 * link's token hash goes straight to the app's callback, which verifies it
 * server-side and writes the session cookies. No redirect through the auth
 * server, so no dependence on its redirect allowlist.
 */
export async function signIn(page: Page, email: string, locale: 'en' | 'es' = 'en') {
  const { data, error } = await admin().auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data.properties) throw error ?? new Error('no link')
  const url = new URL('/auth/callback', BASE_URL)
  url.searchParams.set('token_hash', data.properties.hashed_token)
  url.searchParams.set('type', 'magiclink')
  url.searchParams.set('locale', locale)
  await page.goto(url.toString())
  // Only a signed-in visitor reaches either of these; a bounce to sign-in
  // fails here, loudly, rather than 60 s later on a missing field.
  await page.waitForURL(/\/(en|es)\/(today|onboarding)/, { timeout: 30_000 })
}

/** The weekday chips, by ISO weekday, as the onboarding wizard labels them. */
const WEEKDAY_LABELS = {
  es: { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' },
  en: { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' },
} as const

export async function completeOnboarding(
  page: Page,
  locale: 'en' | 'es',
  /** `gymWeekdays` defaults to Monday, Wednesday and Friday. */
  opts: { name: string; runner?: boolean; gymWeekdays?: readonly number[] },
) {
  // The questionnaire wants at least two gym days. One would leave the wizard
  // stuck on the schedule step with no way forward, which reads as a hung test
  // rather than a bad fixture.
  if (opts.gymWeekdays && opts.gymWeekdays.length < 2) {
    throw new Error(`completeOnboarding needs at least two gym days, got ${opts.gymWeekdays.length}`)
  }
  const t = locale === 'es'
    ? { next: 'Siguiente', finish: 'Crear mi plan', mon: 'Lun', wed: 'Mié', fri: 'Vie', tue: 'Mar', sat: 'Sáb' }
    : { next: 'Next', finish: 'Build my plan', mon: 'Mon', wed: 'Wed', fri: 'Fri', tue: 'Tue', sat: 'Sat' }
  const gymLabels = (opts.gymWeekdays ?? [1, 3, 5]).map((d) => WEEKDAY_LABELS[locale][d as 1])
  await page.goto(`/${locale}/onboarding`)
  // basics
  await page.getByLabel(/call you|te llamamos/i).fill(opts.name)
  await page.getByRole('button', { name: t.next }).click()
  // body
  await page.getByRole('button', { name: locale === 'es' ? 'Femenino' : 'Female' }).click()
  await page.locator('input[type=date]').first().fill('1995-06-15')
  await page.locator('input[type=number]').nth(0).fill('165')
  await page.locator('input[type=number]').nth(1).fill('62')
  await page.getByRole('button', { name: t.next }).click()
  // health (all defaults no)
  await page.getByRole('button', { name: t.next }).click()
  // goals
  // Goal: build muscle; a runner adds running beside it and names a race.
  await page.getByRole('button', { name: locale === 'es' ? /^Ganar músculo/ : /^Build muscle/ }).click()
  if (opts.runner) {
    await page.getByRole('button', { name: locale === 'es' ? 'También corro' : 'I also run' }).click()
    await page.getByRole('button', { name: '10K' }).click()
  }
  await page.getByRole('button', { name: t.next }).click()
  // experience
  await page.getByRole('button', { name: locale === 'es' ? 'De 1 a 3 años' : '1 to 3 years' }).click()
  await page.locator('input[type=number]').nth(0).fill('3')
  await page.locator('input[type=number]').nth(1).fill('20')
  await page.getByRole('button', { name: t.next }).click()
  // schedule
  for (const d of gymLabels) await page.getByRole('group', { name: /gym|gimnasio/i }).getByRole('button', { name: d, exact: true }).click()
  if (opts.runner) {
    for (const d of [t.tue, t.sat]) await page.getByRole('group', { name: /run days|días de correr/i }).getByRole('button', { name: d, exact: true }).click()
    await page.getByRole('group', { name: /long run|tirada larga/i }).getByRole('button', { name: t.sat, exact: true }).click()
  }
  await page.getByRole('button', { name: t.next }).click()
  // equipment, injuries, preferences: defaults
  await page.getByRole('button', { name: t.next }).click()
  await page.getByRole('button', { name: t.next }).click()
  await page.getByRole('button', { name: t.finish }).click()
  // The plan explains itself first; the button leads to today's session.
  await page.waitForURL(new RegExp(`/${locale}/plan`), { timeout: 30_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('link', { name: locale === 'es' ? 'Ir a la sesión de hoy' : "Go to today's session" }).click()
  await page.waitForURL(new RegExp(`/${locale}/today`), { timeout: 30_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

export const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`
