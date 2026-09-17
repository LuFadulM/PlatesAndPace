import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/routing'
import { redirect } from '@/i18n/navigation'
import { getActiveAnswers, getProfile } from '@/lib/data/profile'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { getCurrentUser } from '@/lib/supabase/server'
import { OnboardingWizard } from './wizard'

// Auth-gated: rendered per request, never prerendered at build time.
export const dynamic = 'force-dynamic'

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  // Without credentials there is no session to check; send the visitor to
  // sign-in rather than failing the request.
  if (!isSupabaseConfigured()) redirect({ href: '/sign-in', locale })

  const user = await getCurrentUser()
  if (!user) redirect({ href: '/sign-in', locale })

  const [profile, answers] = await Promise.all([getProfile(), getActiveAnswers()])
  const t = await getTranslations('onboarding')

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-8">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-xs text-(--color-ink-muted)">{t('disclaimer')}</p>
      <OnboardingWizard locale={locale} initial={answers} editing={Boolean(profile?.onboarded_at)} />
    </main>
  )
}
