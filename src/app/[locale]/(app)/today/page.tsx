import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { DayHeader, type StripDay } from '@/components/today/day-header'
import { SessionView, type LoggedSet } from '@/components/today/session-view'
import { ageOn } from '@/domain/profile/types'
import { estimateNutrition, type NutritionEstimate } from '@/domain/nutrition'
import { fromISODate, isValidPlainDate, todayInZone, toISODate, weekStrip } from '@/domain/dates'
import { resolveLoads } from '@/domain/plan'
import type { Readiness } from '@/domain/strength/autoregulation'
import { isLocale } from '@/i18n/routing'
import { getSessionLogWithSets, latestMaxes } from '@/lib/data/logs'
import { getCurrentPlan, getDoneDates, getPlannedDay, getPlannedDays } from '@/lib/data/plan'
import { getActiveAnswers, getLatestWeightKg, requireProfile } from '@/lib/data/profile'

export default async function TodayPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ date?: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const profile = await requireProfile(locale)
  const today = todayInZone(profile.timezone)
  const { date: requested } = await searchParams
  const selected = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && isValidPlainDate(fromISODate(requested)) ? fromISODate(requested) : today
  const iso = toISODate(selected)
  const strip = weekStrip(selected)

  const [day, plan, days, doneDates, { log, sets }, maxes, answers, weightKg] = await Promise.all([
    getPlannedDay(iso),
    getCurrentPlan(),
    getPlannedDays(strip[0]!, strip[6]!),
    getDoneDates(strip[0]!, strip[6]!),
    getSessionLogWithSets(iso),
    latestMaxes(today),
    getActiveAnswers(),
    getLatestWeightKg(),
  ])

  const resolved = day?.gym && plan ? { ...day, gym: resolveLoads(day.gym, day.week, plan.weeks, maxes, profile.units as 'metric' | 'imperial') } : day

  const stripDays: StripDay[] = days.map((d) => ({ date: d.date, type: d.type, done: doneDates.has(d.date) }))

  const initialSets: LoggedSet[] = sets.map((s) => ({
    exerciseId: s.exercise_id,
    setIndex: s.set_index,
    kg: s.kg === null ? null : Number(s.kg),
    reps: s.reps,
    rpe: s.rpe === null ? null : Number(s.rpe),
    done: s.done,
    updatedAt: new Date(s.logged_at).getTime(),
  }))

  let nutrition: NutritionEstimate | null = null
  if (answers && profile.birth_date && weightKg && profile.height_cm) {
    nutrition = estimateNutrition({
      sex: answers.body.sex,
      ageYears: ageOn(fromISODate(profile.birth_date), today),
      weightKg,
      heightCm: Number(profile.height_cm),
      goal: answers.goals.primary,
      sessionsPerWeek: answers.schedule.gymDays.length + answers.schedule.runDays.length,
      sessionMinutes: answers.schedule.sessionMinutes,
      conservativeMode: profile.conservative_mode,
    })
  }

  return (
    <main className="flex flex-col gap-5 px-4 py-6">
      <DayHeader date={iso} today={toISODate(today)} strip={stripDays} />
      <SessionView
        date={iso}
        day={resolved}
        units={profile.units as 'metric' | 'imperial'}
        initialSets={initialSets}
        initialReadiness={(log?.readiness as Readiness | null) ?? null}
        alreadyDone={log?.done ?? false}
        nutrition={nutrition}
      />
    </main>
  )
}
