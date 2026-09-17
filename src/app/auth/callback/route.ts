import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, isLocale } from '@/i18n/routing'
import { safeRedirectPath } from '@/lib/auth/routes'
import { createClient } from '@/lib/supabase/server'

/**
 * Where magic links and OAuth redirects land.
 *
 * Exchanges the one-time code for a session, then forwards the visitor to
 * wherever they were originally headed — validated first, so a crafted `next`
 * cannot bounce them off-site with a fresh session in hand.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const localeParam = searchParams.get('locale')
  const locale = localeParam && isLocale(localeParam) ? localeParam : defaultLocale
  const next = safeRedirectPath(searchParams.get('next'), locale)

  if (!code) {
    return NextResponse.redirect(`${origin}/${locale}/sign-in?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/${locale}/sign-in?error=exchange_failed`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
