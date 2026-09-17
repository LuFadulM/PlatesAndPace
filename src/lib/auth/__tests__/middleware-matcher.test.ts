import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Guards the middleware matcher against a regression that breaks every sign-in.
 *
 * /auth/callback lives outside the [locale] segment because Supabase redirects
 * to one fixed URL. If the intl middleware is allowed to match it, every magic
 * link is rewritten to /en/auth/callback — a route that does not exist — and
 * nobody can sign in. The failure is invisible in unit tests of the handler
 * itself, so the matcher is asserted here against the real source.
 */
const source = readFileSync(
  fileURLToPath(new URL('../../../middleware.ts', import.meta.url)),
  'utf8',
)

function catchAllMatcher(): RegExp {
  const match = /'(\/\(\(\?![^']+)'/.exec(source)
  if (!match) throw new Error('could not find the catch-all matcher in src/middleware.ts')
  // The source is a JS string literal, so its \\. is a single \. in the pattern.
  const pattern = match[1]!.replace(/\\\\/g, '\\')
  return new RegExp(`^${pattern}$`)
}

describe('middleware matcher', () => {
  const matcher = catchAllMatcher()

  it('does not capture the Supabase auth callback', () => {
    expect(matcher.test('/auth/callback')).toBe(false)
    expect(matcher.test('/auth')).toBe(false)
  })

  it('still captures localised app routes', () => {
    expect(matcher.test('/es/today')).toBe(true)
    expect(matcher.test('/en/plan')).toBe(true)
    expect(matcher.test('/')).toBe(true)
  })

  it('leaves API routes and Next internals alone', () => {
    expect(matcher.test('/api/anything')).toBe(false)
    expect(matcher.test('/_next/static/chunk.js')).toBe(false)
    expect(matcher.test('/_vercel/insights')).toBe(false)
  })

  it('leaves files with an extension alone', () => {
    expect(matcher.test('/favicon.ico')).toBe(false)
    expect(matcher.test('/manifest.webmanifest')).toBe(false)
  })
})
