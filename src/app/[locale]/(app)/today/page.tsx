import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { DayHeader, type StripDay } from '@/components/today/day-header'
import { SessionView, type LoggedSet } from '@/components/today/session-view'
import { ageOn } from '@/domain/profile/types'
import { estimateNutrition, type NutritionEstimate } from '@/domain/nutrition'
import { compareDates, fromISODate, isValidPlainDate, todayInZone, toISODate, weekStrip } from '@/domain/dates'
import { resolveLoads } from '@/domain/plan'
import { alternativesFor, catalogueFor } from '@/domain/plan/edit'
import { buildAthleteModel } from '@/domain/profile/athlete'
import { DEFAULT_PLATES } from '@/domain/strength/loads'
import type { Readiness } from '@/domain/strength/autoregulation'
import { isLocale } from '@/i18n/routing'
import { getSessionLogWithSets, lastPerformances, latestMaxDetails, type MaxDetail } from '@/lib/data/logs'
import { getCurrentPlan, getDoneDates, getPlannedDay, getPlannedDays } from '@/lib/data/plan'
import { getActiveAnswers, getLatestWeightKg, getRecentWeights, requireProfile } from '@/lib/data/profile'

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

  const [day, plan, days, doneDates, { log, sets }, maxDetails, answers, weightKg] = await Promise.all([
    getPlannedDay(iso),
    getCurrentPlan(),
    getPlannedDays(strip[0]!, strip[6]!),
    getDoneDates(strip[0]!, strip[6]!),
    getSessionLogWithSets(iso),
    latestMaxDetails(today),
    getActiveAnswers(),
    getLatestWeightKg(),
  ])
  const recentWeights = await getRecentWeights(toISODate(today))
  const maxes = Object.fromEntries(Object.entries(maxDetails).map(([id, d]) => [id, d.e1rm]))
  const units = profile.units as 'metric' | 'imperial'
  const plates = answers?.equipment.plates ?? DEFAULT_PLATES[units]

  // What the athlete did the last time they met each exercise: shown next to
  // today's prescription, and what double progression works from.
  const lastTime = day?.gym ? await lastPerformances(day.gym.exercises.map((e) => e.exerciseId), iso) : {}
  const lastSets = Object.fromEntries(Object.entries(lastTime).map(([id, p]) => [id, p.sets.map((s) => ({ ...s, done: true }))]))

  const resolved = day?.gym && plan ? { ...day, gym: resolveLoads(day.gym, day.week, plan.weeks, maxes, units, { goal: answers?.goals.primary, lastSets, plates }) } : day

  const stripDays: StripDay[] = days.map((d) => ({ date: d.date, type: d.type, done: doneDates.has(d.date) }))

  // What the athlete may change today: swaps per slot and the add catalogue,
  // both filtered by the same rules the generator applies. The past is history.
  const editable = compareDates(selected, today) >= 0 && !(log?.done ?? false)
  let alternatives: Record<string, string[]> = {}
  let catalogue: string[] = []
  if (editable && resolved?.gym && answers) {
    try {
      const model = buildAthleteModel(answers, today)
      const gym = resolved.gym
      alternatives = Object.fromEntries(gym.exercises.map((e) => [e.exerciseId, alternativesFor(gym, e.exerciseId, model).map((a) => a.id)]))
      catalogue = catalogueFor(gym, model).map((e) => e.id)
    } catch {
      // An athlete the model refuses (e.g. a birth date that makes them under age) can still log; they just cannot edit.
    }
  }

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
      disorderedEating: answers.health.disorderedEating,
      recentWeights,
    })
  }

  return (
    <main className="flex flex-col gap-5 px-4 py-6">
      <DayHeader date={iso} today={toISODate(today)} strip={stripDays} />
      <SessionView
        date={iso}
        day={resolved}
        units={units}
        plates={plates}
        maxes={maxDetails as Record<string, MaxDetail>}
        initialSets={initialSets}
        initialReadiness={(log?.readiness as Readiness | null) ?? null}
        alreadyDone={log?.done ?? false}
        initialNotes={log?.notes ?? null}
        nutrition={nutrition}
        latestWeightKg={recentWeights.at(-1)?.kg ?? weightKg}
        alternatives={alternatives}
        catalogue={catalogue}
        lastTime={lastTime}
        editable={editable}
      />
    </main>
  )
}
