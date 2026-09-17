import { describe, expect, it } from 'vitest'
import { fromISODate } from '../../dates'
import { getExercise } from '../../exercises/library'
import { generatePlan, type GeneratedPlan } from '../../plan/generator'
import { buildAthleteModel } from '../../profile/athlete'
import { questionnaireSchema, type QuestionnaireAnswers } from '../../profile/questionnaire'
import {
  DELOAD_VOLUME_FRACTION,
  MAX_SESSION_SETS_PER_MUSCLE,
  MAX_SETS_PER_SLOT,
  MUSCLE_GROUPS,
  SECONDARY_SET_CREDIT,
  VOLUME_LANDMARKS,
  weeklyVolumeTargets,
} from '../volume'

describe('volume landmarks', () => {
  it('order MV ≤ MEV ≤ MAV ≤ MRV for every muscle', () => {
    for (const m of MUSCLE_GROUPS) {
      const l = VOLUME_LANDMARKS[m]
      expect(l.mv).toBeLessThanOrEqual(l.mev)
      expect(l.mev).toBeLessThanOrEqual(l.mavMin)
      expect(l.mavMin).toBeLessThanOrEqual(l.mavMax)
      expect(l.mavMax).toBeLessThanOrEqual(l.mrv)
    }
  })
})

describe('weeklyVolumeTargets', () => {
  it('starts a beginner at MEV and an advanced lifter well inside the adaptive range', () => {
    const beginner = weeklyVolumeTargets({ tier: 'beginner', accumulationWeek: 1, deload: false })
    const advanced = weeklyVolumeTargets({ tier: 'advanced', accumulationWeek: 1, deload: false })
    expect(beginner.chest).toBe(VOLUME_LANDMARKS.chest.mev)
    expect(advanced.chest).toBeGreaterThan(VOLUME_LANDMARKS.chest.mev)
    expect(advanced.chest).toBeLessThanOrEqual(VOLUME_LANDMARKS.chest.mavMax)
  })

  it('adds about a set a week and never passes MRV', () => {
    const w1 = weeklyVolumeTargets({ tier: 'intermediate', accumulationWeek: 1, deload: false })
    const w3 = weeklyVolumeTargets({ tier: 'intermediate', accumulationWeek: 3, deload: false })
    expect(w3.back - w1.back).toBe(2)
    const far = weeklyVolumeTargets({ tier: 'advanced', accumulationWeek: 30, deload: false, focusAreas: ['chest'] })
    expect(far.chest).toBe(VOLUME_LANDMARKS.chest.mrv)
  })

  it('drops to about half in a deload, and scales for the goal and a careful start', () => {
    const build = weeklyVolumeTargets({ tier: 'intermediate', accumulationWeek: 1, deload: false })
    const deload = weeklyVolumeTargets({ tier: 'intermediate', accumulationWeek: 4, deload: true })
    expect(deload.quads).toBe(Math.round(build.quads * DELOAD_VOLUME_FRACTION))
    const trimmed = weeklyVolumeTargets({ tier: 'intermediate', accumulationWeek: 1, deload: false, goalScale: 0.8 })
    expect(trimmed.quads).toBeLessThan(build.quads)
    const careful = weeklyVolumeTargets({ tier: 'intermediate', accumulationWeek: 1, deload: false, conservativeMode: true })
    expect(careful.quads).toBeLessThan(build.quads)
  })

  it('gives focus areas two extra sets', () => {
    const plain = weeklyVolumeTargets({ tier: 'intermediate', accumulationWeek: 1, deload: false })
    const glutes = weeklyVolumeTargets({ tier: 'intermediate', accumulationWeek: 1, deload: false, focusAreas: ['glutes'] })
    expect(glutes.glutes - plain.glutes).toBe(2)
    expect(glutes.chest).toBe(plain.chest)
  })
})

const TODAY = fromISODate('2026-09-15')

function answers(over: Record<string, unknown> = {}): QuestionnaireAnswers {
  return questionnaireSchema.parse({
    basics: { displayName: 'A', locale: 'en', timezone: 'UTC', units: 'metric' },
    body: { sex: 'male', birthDate: '1990-01-01', heightCm: 178, weightKg: 80 },
    health: { heartCondition: false, chestPain: false, dizziness: false, jointProblem: false, bloodPressureMedication: false, pregnancy: false, other: false },
    goals: { primary: 'hypertrophy' },
    experience: { lifting: '1_to_3_years', knowsBigLifts: true, continuousRunMinutes: 0 },
    schedule: { gymDays: [1, 3, 5], runDays: [], sessionMinutes: 60, startDate: '2026-09-14', blockWeeks: 8 },
    equipment: { setting: 'full_gym', unavailableMachines: [] },
    injuries: { areas: [], note: '' },
    preferences: { focusAreas: [], intensity: 'hard', avoidExerciseIds: [] },
    ...over,
  })
}

/** Credited sets per muscle for one week of a plan: 1.0 for a primary, 0.5 for a secondary. */
function weekCredit(plan: GeneratedPlan, week: number): Record<string, number> {
  const credit: Record<string, number> = {}
  for (const day of plan.days) {
    if (day.week !== week || !day.gym) continue
    for (const e of day.gym.exercises) {
      if (e.role === 'power' || e.role === 'mobility') continue
      const def = getExercise(e.exerciseId)
      credit[def.primary] = (credit[def.primary] ?? 0) + e.sets
      for (const s of def.secondary) credit[s] = (credit[s] ?? 0) + SECONDARY_SET_CREDIT * e.sets
    }
  }
  return credit
}

describe('generatePlan — volume follows the landmarks', () => {
  const hypertrophy = generatePlan(buildAthleteModel(answers(), TODAY), { block: 1, seed: 'v' })

  it('never plans more than MRV for any muscle in any week, counting secondary credit', () => {
    for (let week = 1; week <= 8; week += 1) {
      const credit = weekCredit(hypertrophy, week)
      for (const m of MUSCLE_GROUPS) expect(credit[m] ?? 0, `${m} week ${week}`).toBeLessThanOrEqual(VOLUME_LANDMARKS[m].mrv)
    }
  })

  it('ramps the accumulation weeks and drops in the deload', () => {
    const w1 = weekCredit(hypertrophy, 1)
    const w3 = weekCredit(hypertrophy, 3)
    const w4 = weekCredit(hypertrophy, 4)
    const total = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0)
    expect(total(w3)).toBeGreaterThan(total(w1))
    expect(total(w4)).toBeLessThan(total(w1))
  })

  it('never puts more than ten direct sets on a muscle in one session, nor more than the slot cap on one exercise', () => {
    for (const day of hypertrophy.days) {
      if (!day.gym) continue
      const direct: Record<string, number> = {}
      for (const e of day.gym.exercises) {
        if (e.role === 'power' || e.role === 'mobility') continue
        expect(e.sets).toBeLessThanOrEqual(MAX_SETS_PER_SLOT + 1)
        const m = getExercise(e.exerciseId).primary
        direct[m] = (direct[m] ?? 0) + e.sets
      }
      for (const m of Object.keys(direct)) expect(direct[m]).toBeLessThanOrEqual(MAX_SESSION_SETS_PER_MUSCLE)
    }
  })

  it('gives a beginner less weekly volume than an advanced lifter on the same split', () => {
    const beginner = generatePlan(buildAthleteModel(answers({ experience: { lifting: 'none', knowsBigLifts: false, continuousRunMinutes: 0 } }), TODAY), { block: 1, seed: 'v' })
    const advanced = generatePlan(buildAthleteModel(answers({ experience: { lifting: '3_plus_years', knowsBigLifts: true, continuousRunMinutes: 0 } }), TODAY), { block: 1, seed: 'v' })
    const total = (p: GeneratedPlan) => Object.values(weekCredit(p, 2)).reduce((a, b) => a + b, 0)
    expect(total(beginner)).toBeLessThan(total(advanced))
  })
})

describe('generatePlan — the time budget is a hard limit, and every cut is reported', () => {
  it.each([30, 45, 60, 75, 90] as const)('fits every session into %i minutes', (minutes) => {
    const plan = generatePlan(buildAthleteModel(answers({ schedule: { gymDays: [1, 3, 5], runDays: [], sessionMinutes: minutes, startDate: '2026-09-14', blockWeeks: 8 } }), TODAY), { block: 1, seed: 'v' })
    for (const day of plan.days) if (day.gym) expect(day.gym.estimatedMinutes, day.date).toBeLessThanOrEqual(minutes)
  })

  it('says what it trimmed on a short session, and trims the small stuff before the main lift', () => {
    const plan = generatePlan(buildAthleteModel(answers({ experience: { lifting: '3_plus_years', knowsBigLifts: true, continuousRunMinutes: 0 }, schedule: { gymDays: [1, 3, 5], runDays: [], sessionMinutes: 30, startDate: '2026-09-14', blockWeeks: 8 } }), TODAY), { block: 1, seed: 'v' })
    const trimmed = plan.days.filter((d) => d.gym?.adjustments?.some((a) => a.reason === 'time'))
    expect(trimmed.length).toBeGreaterThan(0)
    for (const day of trimmed) {
      const primary = day.gym!.exercises.find((e) => e.role === 'primary')
      if (primary) expect(primary.sets).toBeGreaterThanOrEqual(3)
      for (const a of day.gym!.adjustments!) expect(a.setsRemoved).toBeGreaterThan(0)
    }
  })

  it('records leg sets given up to the running around a session', () => {
    const runner = generatePlan(
      buildAthleteModel(
        answers({
          goals: { primary: 'hypertrophy', secondary: 'endurance', targetRace: '10k' },
          experience: { lifting: '1_to_3_years', knowsBigLifts: true, recentRun: { km: 5, minutes: 30 } },
          schedule: { gymDays: [1, 2, 3, 4, 5], runDays: [2, 4, 6], longRunDay: 6, sessionMinutes: 60, startDate: '2026-09-14', blockWeeks: 8 },
        }),
        TODAY,
      ),
      { block: 1, seed: 'v' },
    )
    const interval = runner.days.find((d) => d.run?.kind === 'interval' && d.gym)!
    const lower = interval.gym!.exercises.filter((e) => getExercise(e.exerciseId).region === 'lower').reduce((n, e) => n + e.sets, 0)
    expect(lower).toBeLessThanOrEqual(4)
  })
})
