import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { fromISODate, isValidPlainDate, todayInZone, toISODate } from '@/domain/dates'
import { isLocale } from '@/i18n/routing'
import { getPlannedDay } from '@/lib/data/plan'
import { getProfile } from '@/lib/data/profile'
import { GuidedRun } from './guided-run'

export default async function RunPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ date?: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const profile = (await getProfile())!
  const { date } = await searchParams
  const iso = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && isValidPlainDate(fromISODate(date)) ? date : toISODate(todayInZone(profile.timezone))
  const day = await getPlannedDay(iso)
  const t = await getTranslations('run')
  if (!day?.run) return <main className="px-4 py-6"><p className="text-(--color-ink-muted)">{t('noRun')}</p></main>
  return <GuidedRun run={day.run} date={iso} />
}
