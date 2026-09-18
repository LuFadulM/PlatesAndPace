import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ProgressCharts } from '@/components/progress/charts'
import { PacesCard } from '@/components/running/paces-card'
import { todayInZone } from '@/domain/dates'
import { fiveKEquivalentSeconds } from '@/domain/running'
import { isLocale } from '@/i18n/routing'
import { getProgress } from '@/lib/data/progress'
import { getActiveAnswers, requireProfile } from '@/lib/data/profile'
import { getCurrentPaces } from '@/lib/data/running'

export default async function ProgressPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('progress')
  const profile = await requireProfile(locale)
  const [data, answers] = await Promise.all([
    getProgress(todayInZone(profile.timezone)),
    getActiveAnswers(),
  ])

  const startingRun = answers?.experience.recentRun
    ? { km: answers.experience.recentRun.km, seconds: answers.experience.recentRun.minutes * 60 }
    : undefined
  const running = await getCurrentPaces(startingRun, answers?.goals.targetRace)
  // Only say a pace was learned when a logged run actually beat the answer the
  // athlete gave at signup.
  const learned = Boolean(
    running && startingRun && running.baseline.seconds < fiveKEquivalentSeconds(startingRun.km, startingRun.seconds) - 1,
  )

  return (
    <main className="flex flex-col gap-6 px-4 py-6">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <ProgressCharts data={data} />
      {running && <PacesCard paces={running.paces} baseline={running.baseline} learned={learned} locale={locale} />}
    </main>
  )
}
