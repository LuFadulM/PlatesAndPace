import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { MonthCalendar } from '@/components/plan/month-calendar'
import { PlanExplanation } from '@/components/plan/plan-explanation'
import { explainPlan } from '@/domain/plan/explain'
import { buildAthleteModel } from '@/domain/profile/athlete'
import type { SessionKind } from '@/domain/strength/splits'
import { addDays, fromISODate, todayInZone, toISODate } from '@/domain/dates'
import { isLocale } from '@/i18n/routing'
import { getCurrentPlan, getDoneDates, getPlannedDays } from '@/lib/data/plan'
import { getActiveAnswers, requireProfile } from '@/lib/data/profile'

export default async function PlanPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const { locale } = await params
  const { welcome } = await searchParams
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('plan')

  const profile = await requireProfile(locale)
  const today = todayInZone(profile.timezone)
  const plan = await getCurrentPlan()
  if (!plan) return <main className="px-4 py-6"><h1 className="font-display text-3xl font-bold">{t('title')}</h1><p className="mt-2 text-(--color-ink-muted)">{t('empty')}</p></main>

  const start = fromISODate(plan.start_date)
  const end = addDays(start, plan.weeks * 7 - 1)
  const [days, done, answers] = await Promise.all([getPlannedDays(start, end), getDoneDates(start, end), getActiveAnswers()])

  // The engine explains its own plan; an athlete the model refuses simply sees the calendar.
  let lines: ReturnType<typeof explainPlan> = []
  if (answers) {
    try {
      const settings = plan.settings as { split?: SessionKind[] }
      lines = explainPlan(buildAthleteModel(answers, today), { weeks: plan.weeks, split: settings.split ?? [] })
    } catch {
      lines = []
    }
  }

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="text-sm text-(--color-ink-muted)">{t('block', { block: plan.block, weeks: plan.weeks })}</p>
      {lines.length > 0 && <PlanExplanation lines={lines} welcome={welcome === '1'} />}
      <MonthCalendar today={toISODate(today)} startDate={plan.start_date} weeks={plan.weeks} days={days} doneDates={[...done]} />
    </main>
  )
}
