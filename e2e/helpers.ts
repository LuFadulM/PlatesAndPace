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

/**
 * Signs the browser in by exchanging a generated magic link, which is the same
 * path a real user takes minus the inbox.
 */
export async function signIn(page: Page, email: string, locale: 'en' | 'es' = 'en') {
  const { data, error } = await admin().auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data.properties) throw error ?? new Error('no link')
  const url = new URL(data.properties.action_link)
  url.searchParams.set('redirect_to', `${page.context()._options.baseURL ?? 'http://localhost:3000'}/auth/callback?locale=${locale}`)
  await page.goto(url.toString())
  await page.waitForURL(/\/(en|es)\//)
}

export async function completeOnboarding(page: Page, locale: 'en' | 'es', opts: { name: string; runner?: boolean }) {
  const t = locale === 'es'
    ? { next: 'Siguiente', finish: 'Crear mi plan', mon: 'Lun', wed: 'Mié', fri: 'Vie', tue: 'Mar', sat: 'Sáb' }
    : { next: 'Next', finish: 'Build my plan', mon: 'Mon', wed: 'Wed', fri: 'Fri', tue: 'Tue', sat: 'Sat' }
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
  await page.getByRole('button', { name: opts.runner ? (locale === 'es' ? 'Ambas: pesas y correr' : 'Both: lift and run') : (locale === 'es' ? 'Ganar músculo' : 'Build muscle') }).click()
  if (opts.runner) await page.getByRole('button', { name: '10K' }).click()
  await page.getByRole('button', { name: t.next }).click()
  // experience
  await page.getByRole('button', { name: locale === 'es' ? 'De 1 a 3 años' : '1 to 3 years' }).click()
  await page.locator('input[type=number]').nth(0).fill('3')
  await page.locator('input[type=number]').nth(1).fill('20')
  await page.getByRole('button', { name: t.next }).click()
  // schedule
  for (const d of [t.mon, t.wed, t.fri]) await page.getByRole('group', { name: /gym|gimnasio/i }).getByRole('button', { name: d, exact: true }).click()
  if (opts.runner) {
    for (const d of [t.tue, t.sat]) await page.getByRole('group', { name: /run days|días de correr/i }).getByRole('button', { name: d, exact: true }).click()
    await page.getByRole('group', { name: /long run|tirada larga/i }).getByRole('button', { name: t.sat, exact: true }).click()
  }
  await page.getByRole('button', { name: t.next }).click()
  // equipment, injuries, preferences: defaults
  await page.getByRole('button', { name: t.next }).click()
  await page.getByRole('button', { name: t.next }).click()
  await page.getByRole('button', { name: t.finish }).click()
  await page.waitForURL(new RegExp(`/${locale}/today`), { timeout: 30_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

export const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`
