import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { DayHeader, type StripDay } from '@/components/today/day-header'
import { DeloadCard } from '@/components/today/deload-card'
import { SessionView, type LoggedSet } from '@/components/today/session-view'
import { ageOn } from '@/domain/profile/types'
import { estimateNutrition, type NutritionEstimate } from '@/domain/nutrition'
import { compareDates, endOfPlanWeek, fromISODate, isValidPlainDate, startOfPlanWeek, todayInZone, toISODate, weekStrip } from '@/domain/dates'
import { resolveLoads, resolveRunPaces } from '@/domain/plan'
import { applyReviewToSession } from '@/domain/review'
import { takenDeload } from '@/domain/strength/deload'
import { alternativesFor, catalogueFor } from '@/domain/plan/edit'
import { buildAthleteModel } from '@/domain/profile/athlete'
import { DEFAULT_PLATES } from '@/domain/strength/loads'
import { musclesForFocusArea } from '@/domain/strength/volume'
import type { Readiness } from '@/domain/strength/autoregulation'
import { isLocale } from '@/i18n/routing'
import { getSessionLogWithSets, lastPerformances, latestMaxDetails, type MaxDetail } from '@/lib/data/logs'
import { getCurrentPlan, getDoneDates, getPlannedDay, getPlannedDays, takenDeloadWeeks } from '@/lib/data/plan'
import { getActiveAnswers, getLatestWeightKg, getRecentWeights, requireProfile } from '@/lib/data/profile'
import { getLastWeekReview } from '@/lib/data/review'
import { getCurrentPaces } from '@/lib/data/running'
import { getDeloadAdvice, getPainReports, getSessionPain } from '@/lib/data/deload'

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
  const [recentWeights, review, running, deload, painReports] = await Promise.all([
    getRecentWeights(toISODate(today)),
    getLastWeekReview(today),
    // Paces learned from logged runs, so a runner who got faster trains faster.
    answers?.experience.recentRun
      ? getCurrentPaces(
          { km: answers.experience.recentRun.km, seconds: answers.experience.recentRun.minutes * 60 },
          answers.goals.targetRace,
        )
      : getCurrentPaces(undefined),
    getDeloadAdvice(today),
    getPainReports(today),
  ])

  // An easy week the athlete asked for lands on the same session pipeline as
  // the scheduled one, so it looks and feels like week four.
  const weekStartIso = toISODate(startOfPlanWeek(today))
  const deloadTaken = takenDeloadWeeks(plan?.settings).includes(weekStartIso)
  const maxes = Object.fromEntries(Object.entries(maxDetails).map(([id, d]) => [id, d.e1rm]))
  const units = profile.units as 'metric' | 'imperial'
  const plates = answers?.equipment.plates ?? DEFAULT_PLATES[units]

  // What the athlete did the last time they met each exercise: shown next to
  // today's prescription, and what double progression works from.
  const lastTime = day?.gym ? await lastPerformances(day.gym.exercises.map((e) => e.exerciseId), iso) : {}
  const lastSets = Object.fromEntries(Object.entries(lastTime).map(([id, p]) => [id, p.sets.map((s) => ({ ...s, done: true }))]))

  // Loads are re-derived first, then last week's verdict is applied on top:
  // the review scales what this week actually asks for, not a stale number.
  let resolved = day?.gym && plan ? { ...day, gym: resolveLoads(day.gym, day.week, plan.weeks, maxes, units, { goal: answers?.goals.primary, lastSets, plates }) } : day
  // Only the current week answers to last week's verdict. A session the
  // athlete scrolls back to already happened, and one further out will get its
  // own review when that week arrives.
  const thisWeek = compareDates(selected, startOfPlanWeek(today)) >= 0 && compareDates(selected, endOfPlanWeek(today)) <= 0
  if (resolved?.run) {
    resolved = { ...resolved, run: resolveRunPaces(resolved.run, running?.paces ?? null) }
  }
  if (resolved?.gym && deloadTaken && thisWeek) {
    const easy = takenDeload()
    resolved = { ...resolved, gym: applyReviewToSession(resolved.gym, {
      verdict: 'struggling',
      volumeMultiplier: easy.volumeMultiplier,
      loadMultiplier: easy.loadMultiplier,
      extraFocusSets: 0,
      completionRate: 1,
      plannedSessions: 0,
      completedSessions: 0,
      medianRpeDelta: null,
      messageKey: 'coach.phase.deload',
    }, { units, plates }) }
  } else if (resolved?.gym && review && thisWeek) {
    resolved = { ...resolved, gym: applyReviewToSession(resolved.gym, review, { units, plates, focus: (answers?.preferences.focusAreas ?? []).flatMap(musclesForFocusArea) }) }
  }

  // What hurt today, and how often each movement has hurt before it, so the
  // control can say "this has happened before" rather than repeating itself.
  const painToday: Record<string, number> = {}
  const painHistory: Record<string, number> = {}
  for (const [exerciseId, severities] of Object.entries(painReports)) {
    const before = severities.filter((severity) => severity >= 2).length
    painHistory[exerciseId] = before
  }
  const todaysLog = await getSessionPain(iso)
  Object.assign(painToday, todaysLog)

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
      {thisWeek && <DeloadCard advice={deload} weekStart={weekStartIso} taken={deloadTaken} />}
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
        review={thisWeek ? review : null}
        painToday={painToday}
        painHistory={painHistory}
      />
    </main>
  )
}
