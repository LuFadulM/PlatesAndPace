import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ProgressCharts } from '@/components/progress/charts'
import { todayInZone } from '@/domain/dates'
import { isLocale } from '@/i18n/routing'
import { getProgress } from '@/lib/data/progress'
import { requireProfile } from '@/lib/data/profile'

export default async function ProgressPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('progress')
  const profile = await requireProfile(locale)
  const data = await getProgress(todayInZone(profile.timezone))
  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <ProgressCharts data={data} />
    </main>
  )
}
