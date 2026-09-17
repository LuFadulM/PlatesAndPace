import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from './i18n/routing'
import { routeDecision } from './lib/auth/routes'
import { isSupabaseConfigured } from './lib/supabase/env'
import { refreshSession } from './lib/supabase/middleware'

const intlMiddleware = createIntlMiddleware(routing)

export default async function middleware(request: NextRequest) {
  // Locale resolution runs first so that every later decision — including where
  // to send a signed-out visitor — can be made in the visitor's own language.
  const response = intlMiddleware(request)

  // Without credentials the app still serves its public routes, which is what
  // lets `next build` and CI run with no Supabase project attached.
  if (!isSupabaseConfigured()) return response

  const { isSignedIn } = await refreshSession(request, response)
  const decision = routeDecision(request.nextUrl.pathname, isSignedIn)

  if (decision.kind === 'redirect') {
    const target = new URL(decision.to, request.url)
    const redirect = NextResponse.redirect(target)
    // Carry the refreshed auth cookies across, or the redirected request would
    // arrive signed out and bounce straight back.
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie)
    }
    return redirect
  }

  return response
}

export const config = {
  matcher: [
    '/',
    '/(en|es)/:path*',
    // `auth` and `offline` are excluded deliberately: both live outside the
    // [locale] segment. /auth/callback is the fixed URL Supabase redirects to,
    // and /offline is what the service worker serves when the network is gone.
    // Letting the intl middleware prefix either with a locale sends it to a
    // route that does not exist.
    '/((?!api|auth|offline|_next|_vercel|.*\\..*).*)',
  ],
}
