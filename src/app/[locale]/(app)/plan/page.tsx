import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { MonthCalendar } from '@/components/plan/month-calendar'
import { addDays, fromISODate, todayInZone, toISODate } from '@/domain/dates'
import { isLocale } from '@/i18n/routing'
import { getCurrentPlan, getDoneDates, getPlannedDays } from '@/lib/data/plan'
import { getProfile } from '@/lib/data/profile'

export default async function PlanPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('plan')

  const profile = (await getProfile())!
  const today = todayInZone(profile.timezone)
  const plan = await getCurrentPlan()
  if (!plan) return <main className="px-4 py-6"><h1 className="font-display text-3xl font-bold">{t('title')}</h1><p className="mt-2 text-(--color-ink-muted)">{t('empty')}</p></main>

  const start = fromISODate(plan.start_date)
  const end = addDays(start, plan.weeks * 7 - 1)
  const [days, done] = await Promise.all([getPlannedDays(start, end), getDoneDates(start, end)])

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="text-sm text-(--color-ink-muted)">{t('block', { block: plan.block, weeks: plan.weeks })}</p>
      <MonthCalendar today={toISODate(today)} startDate={plan.start_date} weeks={plan.weeks} days={days} doneDates={[...done]} />
    </main>
  )
}
