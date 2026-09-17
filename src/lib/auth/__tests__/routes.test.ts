import { describe, expect, it } from 'vitest'
import {
  isAuthPath,
  isProtectedPath,
  parsePath,
  routeDecision,
  safeRedirectPath,
} from '../routes'

describe('parsePath', () => {
  it('splits the locale from the rest of the path', () => {
    expect(parsePath('/es/today')).toEqual({ locale: 'es', rest: '/today', segment: 'today' })
    expect(parsePath('/en/plan/week/3')).toEqual({
      locale: 'en',
      rest: '/plan/week/3',
      segment: 'plan',
    })
  })

  it('falls back to the default locale (Spanish) when the prefix is missing', () => {
    expect(parsePath('/today').locale).toBe('es')
    expect(parsePath('/today').segment).toBe('today')
  })

  it('handles the locale root and the bare root', () => {
    expect(parsePath('/es')).toEqual({ locale: 'es', rest: '/', segment: '' })
    expect(parsePath('/')).toEqual({ locale: 'es', rest: '/', segment: '' })
  })

  it('does not mistake a path segment for a locale', () => {
    // 'english' starts with 'en' but is not a locale, so the default applies.
    expect(parsePath('/english/today').locale).toBe('es')
    expect(parsePath('/english/today').segment).toBe('english')
  })
})

describe('path classification', () => {
  it('recognises the routes that need a session', () => {
    for (const path of ['/en/today', '/es/plan', '/en/settings', '/es/onboarding']) {
      expect(isProtectedPath(path)).toBe(true)
    }
  })

  it('leaves public routes alone', () => {
    for (const path of ['/en', '/es', '/en/privacy', '/es/sign-in']) {
      expect(isProtectedPath(path)).toBe(false)
    }
  })

  it('recognises the auth routes', () => {
    expect(isAuthPath('/es/sign-in')).toBe(true)
    expect(isAuthPath('/en/check-email')).toBe(true)
    expect(isAuthPath('/en/today')).toBe(false)
  })
})

describe('routeDecision', () => {
  it('sends a signed-out visitor to sign-in in their own language', () => {
    expect(routeDecision('/es/today', false)).toEqual({
      kind: 'redirect',
      to: '/es/sign-in?next=%2Ftoday',
    })
    expect(routeDecision('/en/today', false)).toEqual({
      kind: 'redirect',
      to: '/en/sign-in?next=%2Ftoday',
    })
  })

  it('remembers where they were going', () => {
    const decision = routeDecision('/es/plan/week/3', false)

    expect(decision.kind).toBe('redirect')
    if (decision.kind !== 'redirect') return
    expect(decision.to).toContain(`next=${encodeURIComponent('/plan/week/3')}`)
  })

  it('lets a signed-out visitor see public routes', () => {
    expect(routeDecision('/es', false)).toEqual({ kind: 'allow' })
    expect(routeDecision('/es/sign-in', false)).toEqual({ kind: 'allow' })
  })

  it('moves a signed-in user off the auth routes', () => {
    expect(routeDecision('/es/sign-in', true)).toEqual({ kind: 'redirect', to: '/es/today' })
  })

  it('lets a signed-in user through everywhere else', () => {
    for (const path of ['/en/today', '/es/plan', '/en', '/es/library']) {
      expect(routeDecision(path, true)).toEqual({ kind: 'allow' })
    }
  })
})

describe('safeRedirectPath', () => {
  it('adds the locale prefix to a bare path', () => {
    expect(safeRedirectPath(encodeURIComponent('/plan'), 'es')).toBe('/es/plan')
  })

  it('leaves an already-localised path alone', () => {
    expect(safeRedirectPath(encodeURIComponent('/es/plan'), 'es')).toBe('/es/plan')
  })

  it('falls back when nothing was requested', () => {
    expect(safeRedirectPath(null, 'en')).toBe('/en/today')
    expect(safeRedirectPath('', 'es')).toBe('/es/today')
  })

  // An open redirect here would make every sign-in link a phishing vector.
  it('refuses absolute URLs to other origins', () => {
    expect(safeRedirectPath(encodeURIComponent('https://evil.example/x'), 'en')).toBe('/en/today')
  })

  it('refuses protocol-relative URLs', () => {
    expect(safeRedirectPath(encodeURIComponent('//evil.example/x'), 'en')).toBe('/en/today')
  })

  it('refuses backslash and scheme tricks browsers may normalise', () => {
    expect(safeRedirectPath(encodeURIComponent('/\\evil.example'), 'en')).toBe('/en/today')
    expect(safeRedirectPath(encodeURIComponent('javascript:alert(1)'), 'en')).toBe('/en/today')
    expect(safeRedirectPath(encodeURIComponent('/x:y'), 'en')).toBe('/en/today')
  })

  it('refuses a malformed encoding rather than throwing', () => {
    expect(safeRedirectPath('%E0%A4%A', 'en')).toBe('/en/today')
  })
})
