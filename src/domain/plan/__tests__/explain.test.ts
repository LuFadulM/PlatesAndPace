import { describe, expect, it } from 'vitest'
import en from '../../../../messages/en.json'
import es from '../../../../messages/es.json'
import { fromISODate } from '../../dates'
import { buildAthleteModel } from '../../profile/athlete'
import { questionnaireSchema, type QuestionnaireAnswers } from '../../profile/questionnaire'
import { PRIMARY_GOALS } from '../../profile/types'
import { explainPlan } from '../explain'
import { generatePlan } from '../generator'

const TODAY = fromISODate('2026-09-15')

function answers(over: Record<string, unknown> = {}): QuestionnaireAnswers {
  return questionnaireSchema.parse({
    basics: { displayName: 'A', locale: 'es', timezone: 'America/Bogota', units: 'metric' },
    body: { sex: 'female', birthDate: '1988-01-01', heightCm: 165, weightKg: 62 },
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

type Tree = { [k: string]: string | Tree }
function lookup(tree: Tree, key: string): string | undefined {
  let node: string | Tree | undefined = tree
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

describe('explainPlan', () => {
  it('emits a message key that exists in both catalogues for every line, for every goal', () => {
    for (const goal of PRIMARY_GOALS) {
      const a = answers({ goals: goal === 'endurance' ? { primary: goal, targetRace: '10k' } : { primary: goal }, experience: { lifting: '1_to_3_years', knowsBigLifts: true, recentRun: { km: 5, minutes: 30 } }, schedule: { gymDays: [1, 3, 5], runDays: [2, 6], longRunDay: 6, sessionMinutes: 60, startDate: '2026-09-14', blockWeeks: 8 } })
      const model = buildAthleteModel(a, TODAY)
      const plan = generatePlan(model, { block: 1, seed: 'x' })
      const lines = explainPlan(model, { weeks: plan.weeks, split: plan.settings.split })
      expect(lines.length).toBeGreaterThan(8)
      for (const line of lines) {
        expect(lookup(en as Tree, line.key), line.key).toBeDefined()
        expect(lookup(es as Tree, line.key), line.key).toBeDefined()
        // Every placeholder the message needs is supplied.
        for (const match of lookup(en as Tree, line.key)!.matchAll(/\{(\w+)/g)) expect(line.params ?? {}, `${line.key} needs ${match[1]}`).toHaveProperty(match[1]!)
      }
    }
  })

  it('tells a beginner why full body, a runner about paces and lift-first, a flagged athlete about clearance', () => {
    const beginner = buildAthleteModel(answers({ experience: { lifting: 'none', knowsBigLifts: false, continuousRunMinutes: 0 } }), TODAY)
    const beginnerLines = explainPlan(beginner, { weeks: 8, split: ['full_body_a', 'full_body_b', 'full_body_c'] }).map((l) => l.key)
    expect(beginnerLines).toContain('explain.split.whyFullBodyBeginner')
    expect(beginnerLines).toContain('explain.loads.calibrate')

    const runner = buildAthleteModel(answers({ goals: { primary: 'hypertrophy', secondary: 'endurance', targetRace: '10k' }, experience: { lifting: '1_to_3_years', knowsBigLifts: true, recentRun: { km: 3, minutes: 20 }, restingHr: 52 }, schedule: { gymDays: [1, 3, 5], runDays: [2, 4, 6], longRunDay: 6, sessionMinutes: 60, startDate: '2026-09-14', blockWeeks: 8 } }), TODAY)
    const runnerLines = explainPlan(runner, { weeks: 8, split: ['push', 'pull', 'legs'] })
    expect(runnerLines.map((l) => l.key)).toContain('explain.cardio.interference')
    expect(runnerLines.map((l) => l.key)).toContain('explain.cardio.zones.hrr')
    const paces = runnerLines.find((l) => l.key === 'explain.cardio.paces')!
    expect(String(paces.params!.easy)).toMatch(/^\d+:\d\d$/)

    const flagged = buildAthleteModel(answers({ health: { heartCondition: true, chestPain: false, dizziness: false, jointProblem: false, bloodPressureMedication: false, pregnancy: false, other: false, medicalAcknowledged: true } }), TODAY)
    const flaggedLines = explainPlan(flagged, { weeks: 8, split: ['push', 'pull', 'legs'] }).map((l) => l.key)
    expect(flaggedLines).toContain('explain.safety.clearance')
    expect(flaggedLines).toContain('explain.intensity.careful')
    expect(flaggedLines).toContain('explain.food.noDeficit.medical')
  })
})
