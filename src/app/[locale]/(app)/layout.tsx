import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { isLocale } from '@/i18n/routing'
import { redirect } from '@/i18n/navigation'
import { getProfile } from '@/lib/data/profile'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { getCurrentUser } from '@/lib/supabase/server'

// Auth-gated: rendered per request, never prerendered at build time.
export const dynamic = 'force-dynamic'

/**
 * Everything behind sign-in. A signed-out visitor is bounced by the middleware
 * before reaching here; this layout adds the second gate — no profile yet
 * means the questionnaire has not been completed.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  // Without credentials there is no session to check; send the visitor to
  // sign-in rather than failing the request.
  if (!isSupabaseConfigured()) redirect({ href: '/sign-in', locale })

  const user = await getCurrentUser()
  if (!user) redirect({ href: '/sign-in', locale })

  const profile = await getProfile()
  if (!profile?.onboarded_at) redirect({ href: '/onboarding', locale })

  return (
    <div className="mx-auto min-h-screen max-w-md pb-20">
      {children}
      <AppNav />
    </div>
  )
}
