import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/routing'
import { redirect } from '@/i18n/navigation'
import { joinGroup } from '@/lib/actions/group'
import { getCurrentUser } from '@/lib/supabase/server'

// Auth-gated: rendered per request, never prerendered at build time.
export const dynamic = 'force-dynamic'

/** Invite links land here; signed-out visitors go through sign-in and back. */
export default async function JoinPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const user = await getCurrentUser()
  if (!user) redirect({ href: { pathname: '/sign-in', query: { next: `/join/${code}` } }, locale })
  await joinGroup(code)
  redirect({ href: '/group', locale })
}
